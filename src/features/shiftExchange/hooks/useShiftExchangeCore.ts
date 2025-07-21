import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../auth/hooks';
import { useUsers } from '../../auth/hooks';
import { useBagPhase } from './useBagPhase';
import { getGeneratedPlanning } from '../../../lib/firebase/planning';
import { 
  validateShiftExchange, 
  removeShiftExchange, 
  removeUserFromExchange,
  toggleInterest 
} from '../../../lib/firebase/exchange';
import type { ShiftExchange, ShiftAssignment, ExchangeHistory } from '../types';
import type { User } from '../../../types/users';

interface ConflictInfo {
  hasConflict: boolean;
  shiftType?: string;
  date?: string;
  period?: string;
}

interface UseShiftExchangeCoreOptions {
  enableHistory?: boolean;
  enableConflictCheck?: boolean;
  limitResults?: number;
}

interface UseShiftExchangeCoreResult {
  // Data
  exchanges: ShiftExchange[];
  filteredExchanges: ShiftExchange[];
  history: ExchangeHistory[];
  userAssignments: Record<string, ShiftAssignment>;
  receivedShifts: Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  conflictStates: Record<string, boolean>;
  conflictDetails: Record<string, ConflictInfo>;
  
  // States
  loading: boolean;
  error: string | null;
  isInteractionDisabled: boolean;
  
  // Filter states
  showOwnShifts: boolean;
  showMyInterests: boolean;
  viewMode: 'list' | 'calendar';
  
  // Context data
  user: User | null;
  users: User[];
  bagPhaseConfig: any;
  
  // Actions
  setShowOwnShifts: (value: boolean) => void;
  setShowMyInterests: (value: boolean) => void;
  setViewMode: (mode: 'list' | 'calendar') => void;
  
  // Exchange actions
  toggleInterest: (exchange: ShiftExchange) => Promise<void>;
  validateExchange: (exchangeId: string, interestedUserId: string, hasConflict: boolean) => Promise<void>;
  rejectExchange: (exchangeId: string) => Promise<void>;
  removeUser: (exchangeId: string, userId: string) => Promise<void>;
  
  // Utility
  checkForConflict: (exchange: ShiftExchange, userId?: string) => Promise<ConflictInfo>;
  refreshData: () => Promise<void>;
}

/**
 * Hook centralisé pour la gestion de la bourse aux gardes
 * Optimisé pour réduire les re-renders et les appels Firebase
 */
export const useShiftExchangeCore = (
  options: UseShiftExchangeCoreOptions = {}
): UseShiftExchangeCoreResult => {
  const {
    enableHistory = false,
    enableConflictCheck = true,
    limitResults = 100
  } = options;
  
  // Context hooks
  const { user } = useAuth();
  const { users } = useUsers();
  const { config: bagPhaseConfig } = useBagPhase();
  
  // Core states
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [allExchangesForPositions, setAllExchangesForPositions] = useState<ShiftExchange[]>([]);
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [userAssignments, setUserAssignments] = useState<Record<string, ShiftAssignment>>({});
  const [receivedShifts, setReceivedShifts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [showOwnShifts, setShowOwnShifts] = useState(true);
  const [showMyInterests, setShowMyInterests] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // Conflict states
  const [conflictStates, setConflictStates] = useState<Record<string, boolean>>({});
  const [conflictDetails, setConflictDetails] = useState<Record<string, ConflictInfo>>({});
  
  // Refs pour optimisation
  const unsubscribes = useRef<Unsubscribe[]>([]);
  const planningCache = useRef<Record<string, any>>({});
  const conflictCheckCache = useRef<Map<string, ConflictInfo>>(new Map());
  
  // Mémorisation de isInteractionDisabled
  const isInteractionDisabled = useMemo(
    () => bagPhaseConfig.phase !== 'submission',
    [bagPhaseConfig.phase]
  );
  
  // Fonction optimisée pour vérifier les conflits avec cache
  const checkForConflict = useCallback(async (
    exchange: ShiftExchange, 
    userId?: string
  ): Promise<ConflictInfo> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return { hasConflict: false };
    
    // Clé de cache
    const cacheKey = `${targetUserId}-${exchange.date}-${exchange.period}`;
    
    // Vérifier le cache
    if (conflictCheckCache.current.has(cacheKey)) {
      return conflictCheckCache.current.get(cacheKey)!;
    }
    
    try {
      // Utiliser le cache de planning si disponible
      let planning = planningCache.current[targetUserId];
      
      if (!planning) {
        planning = await getGeneratedPlanning(targetUserId);
        planningCache.current[targetUserId] = planning;
      }
      
      if (!planning?.assignments) return { hasConflict: false };
      
      const assignmentKey = `${exchange.date}-${exchange.period}`;
      const conflictAssignment = planning.assignments[assignmentKey];
      
      const result: ConflictInfo = conflictAssignment 
        ? {
            hasConflict: true,
            shiftType: conflictAssignment.shiftType,
            date: exchange.date,
            period: exchange.period
          }
        : { hasConflict: false };
      
      // Mettre en cache le résultat
      conflictCheckCache.current.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error checking conflict:', error);
      return { hasConflict: false };
    }
  }, [user?.id]);
  
  // Filtrage mémorisé des échanges
  const filteredExchanges = useMemo(() => {
    if (!user) return [];
    
    // Utiliser allExchangesForPositions si on affiche "Mes positions"
    const dataSource = showMyInterests && allExchangesForPositions.length > 0 
      ? allExchangesForPositions 
      : exchanges;
    
    return dataSource.filter(exchange => {
      const isUserShift = exchange.userId === user.id;
      const isUserInterested = exchange.interestedUsers?.includes(user.id) || false;
      
      // Filtre "Mes positions"
      if (showMyInterests) {
        return isUserInterested;
      }
      
      // Filtre "Mes gardes"
      if (!showOwnShifts && isUserShift) {
        return false;
      }
      
      // En phase completed, montrer uniquement les gardes de l'utilisateur
      if (bagPhaseConfig.phase === 'completed' && !isUserShift) {
        return false;
      }
      
      return true;
    });
  }, [exchanges, allExchangesForPositions, user, showMyInterests, showOwnShifts, bagPhaseConfig.phase]);
  
  // Fonction pour charger les données initiales et configurer les listeners
  useEffect(() => {
    if (!user) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    let isMounted = true;
    
    const setupListeners = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Query optimisée pour les échanges
        const queryConstraints = [
          where('date', '>=', today),
          where('status', 'in', ['pending', 'unavailable']),
          orderBy('date', 'asc')
        ];
        
        // Ajouter la limite seulement si elle est définie et > 0
        if (limitResults && limitResults > 0) {
          queryConstraints.push(limit(limitResults));
        }
        
        const exchangesQuery = query(
          collection(db, 'shift_exchanges'),
          ...queryConstraints
        );
        
        // 2. Listener principal pour les échanges
        const unsubscribeExchanges = onSnapshot(
          exchangesQuery,
          async (snapshot) => {
            if (!isMounted) return;
            
            const exchangeData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as ShiftExchange[];
            
            // Tri optimisé
            exchangeData.sort((a, b) => {
              if (a.status === 'pending' && b.status === 'unavailable') return -1;
              if (a.status === 'unavailable' && b.status === 'pending') return 1;
              return a.date.localeCompare(b.date);
            });
            
            setExchanges(exchangeData);
            
            // Vérification des conflits en batch si activée
            if (enableConflictCheck && user) {
              const interestedExchanges = exchangeData.filter(e => 
                e.interestedUsers?.includes(user.id)
              );
              
              if (interestedExchanges.length > 0) {
                const conflictPromises = interestedExchanges.map(async exchange => {
                  const result = await checkForConflict(exchange);
                  return { 
                    id: exchange.id, 
                    ...result
                  };
                });
                
                const results = await Promise.all(conflictPromises);
                
                if (isMounted) {
                  const newConflictStates: Record<string, boolean> = {};
                  const newConflictDetails: Record<string, ConflictInfo> = {};
                  
                  results.forEach(({ id, ...conflictInfo }) => {
                    newConflictStates[id] = conflictInfo.hasConflict;
                    if (conflictInfo.hasConflict) {
                      newConflictDetails[`${conflictInfo.date}-${conflictInfo.period}`] = conflictInfo;
                    }
                  });
                  
                  setConflictStates(newConflictStates);
                  setConflictDetails(newConflictDetails);
                }
              }
            }
            
            setLoading(false);
          },
          (error) => {
            console.error('Error loading exchanges:', error);
            if (isMounted) {
              setError('Erreur lors du chargement des échanges');
              setLoading(false);
            }
          }
        );
        
        unsubscribes.current.push(unsubscribeExchanges);
        
        // 3. Charger le planning utilisateur
        const planning = await getGeneratedPlanning(user.id);
        if (isMounted && planning?.assignments) {
          setUserAssignments(planning.assignments);
          planningCache.current[user.id] = planning;
        }
        
        // 4. Listener pour l'historique (si activé)
        if (enableHistory) {
          const historyQuery = query(
            collection(db, 'exchange_history'),
            where('status', '==', 'completed'),
            orderBy('exchangedAt', 'desc'),
            limit(50)
          );
          
          const unsubscribeHistory = onSnapshot(
            historyQuery,
            (snapshot) => {
              if (!isMounted) return;
              
              const historyData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as ExchangeHistory[];
              
              setHistory(historyData);
              
              // Calculer les gardes reçues
              const receivedShiftsData: Record<string, any> = {};
              historyData.forEach(item => {
                if (item.originalUserId === user.id || item.newUserId === user.id) {
                  const key = `${item.date}-${item.period}`;
                  receivedShiftsData[key] = {
                    originalUserId: item.originalUserId,
                    newUserId: item.newUserId,
                    isPermutation: item.isPermutation,
                    shiftType: item.shiftType,
                    timeSlot: item.timeSlot
                  };
                }
              });
              
              setReceivedShifts(receivedShiftsData);
            }
          );
          
          unsubscribes.current.push(unsubscribeHistory);
        }
      } catch (error) {
        console.error('Error setting up listeners:', error);
        if (isMounted) {
          setError('Erreur lors de l\'initialisation');
          setLoading(false);
        }
      }
    };
    
    setupListeners();
    
    // Cleanup
    return () => {
      isMounted = false;
      unsubscribes.current.forEach(fn => fn());
      unsubscribes.current = [];
      // Nettoyer les caches
      planningCache.current = {};
      conflictCheckCache.current.clear();
    };
  }, [user, enableHistory, enableConflictCheck, limitResults, checkForConflict]);
  
  // Effet pour charger toutes les gardes quand "Mes positions" est activé
  useEffect(() => {
    if (!showMyInterests || !user) {
      setAllExchangesForPositions([]);
      return;
    }
    
    let unsubscribe: Unsubscribe | null = null;
    
    const loadAllExchanges = async () => {
      try {
        // Requête sans filtre de statut pour récupérer TOUTES les gardes
        const allExchangesQuery = query(
          collection(db, 'shift_exchanges'),
          orderBy('date', 'asc')
        );
        
        unsubscribe = onSnapshot(allExchangesQuery, (snapshot) => {
          const allExchanges = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ShiftExchange[];
          
          setAllExchangesForPositions(allExchanges);
        });
      } catch (error) {
        console.error('Erreur lors du chargement de toutes les gardes pour Mes positions:', error);
      }
    };
    
    loadAllExchanges();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [showMyInterests, user]);
  
  // Actions optimisées
  const toggleInterestAction = useCallback(async (exchange: ShiftExchange) => {
    if (!user || isInteractionDisabled) {
      throw new Error('Action non autorisée');
    }
    
    try {
      await toggleInterest(exchange.id, user.id);
      // La mise à jour se fait via le listener
    } catch (error) {
      console.error('Error toggling interest:', error);
      throw error;
    }
  }, [user, isInteractionDisabled]);
  
  const validateExchange = useCallback(async (
    exchangeId: string, 
    interestedUserId: string, 
    hasConflict: boolean
  ) => {
    if (!user?.roles.isAdmin) {
      throw new Error('Action réservée aux administrateurs');
    }
    
    try {
      await validateShiftExchange(exchangeId, interestedUserId, user.id);
      // Invalider le cache de planning pour les utilisateurs concernés
      delete planningCache.current[interestedUserId];
      conflictCheckCache.current.clear();
    } catch (error) {
      console.error('Error validating exchange:', error);
      throw error;
    }
  }, [user]);
  
  const rejectExchange = useCallback(async (exchangeId: string) => {
    if (!user?.roles.isAdmin) {
      throw new Error('Action réservée aux administrateurs');
    }
    
    try {
      await removeShiftExchange(exchangeId);
    } catch (error) {
      console.error('Error rejecting exchange:', error);
      throw error;
    }
  }, [user]);
  
  const removeUser = useCallback(async (exchangeId: string, userId: string) => {
    if (!user?.roles.isAdmin) {
      throw new Error('Action réservée aux administrateurs');
    }
    
    try {
      await removeUserFromExchange(exchangeId, userId);
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
  }, [user]);
  
  // Fonction de rafraîchissement manuel
  const refreshData = useCallback(async () => {
    // Vider les caches
    planningCache.current = {};
    conflictCheckCache.current.clear();
    
    // Recharger le planning
    if (user) {
      const planning = await getGeneratedPlanning(user.id);
      if (planning?.assignments) {
        setUserAssignments(planning.assignments);
        planningCache.current[user.id] = planning;
      }
    }
  }, [user]);
  
  return {
    // Data
    exchanges,
    filteredExchanges,
    history,
    userAssignments,
    receivedShifts,
    conflictStates,
    conflictDetails,
    
    // States
    loading,
    error,
    isInteractionDisabled,
    
    // Filter states
    showOwnShifts,
    showMyInterests,
    viewMode,
    
    // Context data
    user,
    users,
    bagPhaseConfig,
    
    // Actions
    setShowOwnShifts,
    setShowMyInterests,
    setViewMode,
    
    // Exchange actions
    toggleInterest: toggleInterestAction,
    validateExchange,
    rejectExchange,
    removeUser,
    
    // Utility
    checkForConflict,
    refreshData
  };
};

export default useShiftExchangeCore;