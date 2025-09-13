import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { 
  collection, 
  doc,
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
  const refreshDataRef = useRef<(() => Promise<void>) | null>(null);
  
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
    
    // En phase 3 (completed), appliquer une logique spécifique pour afficher uniquement les 3 catégories demandées
    if (bagPhaseConfig.phase === 'completed' && enableHistory) {
      const results: any[] = [];
      const addedKeys = new Set<string>();
      
      // CATÉGORIE 1: Gardes proposées par l'utilisateur qui n'ont pas trouvé preneur
      // Ces gardes sont soit 'pending' (personne ne s'est positionné) soit 'not_taken' (des gens se sont positionnés mais aucun n'a été retenu)
      const userUnprovidedShifts = exchanges.filter(exchange => 
        exchange.userId === user.id && 
        (exchange.status === 'pending' || exchange.status === 'not_taken')
      );
      
      userUnprovidedShifts.forEach(exchange => {
        const key = `${exchange.date}-${exchange.period}-${exchange.shiftType}`;
        if (!addedKeys.has(key)) {
          results.push({
            ...exchange,
            category: 'unprovided' // Pour le tri
          });
          addedKeys.add(key);
        }
      });
      
      // CATÉGORIE 2: Gardes attribuées à l'utilisateur
      const attributedToUser = history.filter(h => 
        h.status === 'completed' && 
        h.newUserId === user.id
      );
      
      attributedToUser.forEach(h => {
        const key = `${h.date}-${h.period}-${h.shiftType}`;
        if (!addedKeys.has(key)) {
          results.push({
            id: h.id,
            date: h.date,
            period: h.period,
            shiftType: h.shiftType,
            userId: h.originalUserId,
            interestedUsers: h.interestedUsers || [],
            status: 'attributed' as const,
            comment: h.comment || '',
            timeSlot: h.timeSlot,
            operationTypes: [],
            originalExchangeId: h.originalExchangeId,
            newUserId: h.newUserId,
            category: 'attributed' // Pour le tri
          });
          addedKeys.add(key);
        }
      });
      
      // CATÉGORIE 3: Gardes où l'utilisateur s'était positionné mais ne les a pas obtenues
      const notAttributedToUser = history.filter(h => 
        h.status === 'completed' && 
        h.interestedUsers?.includes(user.id) && 
        h.newUserId !== user.id
      );
      
      notAttributedToUser.forEach(h => {
        const key = `${h.date}-${h.period}-${h.shiftType}`;
        if (!addedKeys.has(key)) {
          results.push({
            id: h.id,
            date: h.date,
            period: h.period,
            shiftType: h.shiftType,
            userId: h.originalUserId,
            interestedUsers: h.interestedUsers || [],
            status: 'not_attributed' as const,
            comment: h.comment || '',
            timeSlot: h.timeSlot,
            operationTypes: [],
            originalExchangeId: h.originalExchangeId,
            newUserId: h.newUserId,
            category: 'not_obtained' // Pour le tri
          });
          addedKeys.add(key);
        }
      });
      
      // Trier pour afficher d'abord les gardes non pourvues (catégorie 1), puis les attribuées, puis les non obtenues
      return results.sort((a, b) => {
        const categoryOrder = { 'unprovided': 0, 'attributed': 1, 'not_obtained': 2 };
        const categoryA = a.category || 'other';
        const categoryB = b.category || 'other';
        
        if (categoryOrder[categoryA] !== categoryOrder[categoryB]) {
          return (categoryOrder[categoryA] || 999) - (categoryOrder[categoryB] || 999);
        }
        
        // Si même catégorie, trier par date
        return a.date.localeCompare(b.date);
      });
    }
    
    // Si "Mes positions" est activé et qu'on a l'historique
    if (showMyInterests && enableHistory) {
      // Créer une liste combinée des positions actuelles et attribuées
      const currentPositions = exchanges.filter(exchange => 
        exchange.interestedUsers?.includes(user.id)
      );
      
      // Ajouter TOUTES les positions de l'historique où l'utilisateur était impliqué
      const historicalPositions = history
        .filter(h => {
          // Inclure si l'utilisateur a reçu la garde
          if (h.newUserId === user.id && h.status === 'completed') return true;
          // Inclure si l'utilisateur était dans la liste des intéressés
          if (h.interestedUsers?.includes(user.id)) return true;
          return false;
        })
        .map(h => ({
          id: h.id,
          date: h.date,
          period: h.period,
          shiftType: h.shiftType,
          userId: h.originalUserId,
          interestedUsers: h.interestedUsers || [user.id],
          status: h.newUserId === user.id ? 'attributed' as const : 'not_attributed' as const,
          comment: h.comment || '',
          timeSlot: h.timeSlot,
          operationTypes: [],
          originalExchangeId: h.originalExchangeId,
          statusDetail: h.status // Garder le statut original pour info
        }));
      
      // Combiner toutes les positions
      const allPositions = [...currentPositions, ...historicalPositions];
      
      // Créer un Map pour gérer les doublons de manière plus intelligente
      const positionsMap = new Map();
      
      // D'abord ajouter les positions historiques
      historicalPositions.forEach(pos => {
        // Utiliser une clé unique basée sur l'ID original ou une combinaison
        const key = pos.originalExchangeId || `${pos.date}-${pos.period}-${pos.shiftType}-${pos.id}`;
        positionsMap.set(key, pos);
      });
      
      // Ensuite ajouter les positions actuelles (qui peuvent écraser les historiques si même clé)
      currentPositions.forEach(pos => {
        const key = pos.id || `${pos.date}-${pos.period}-${pos.shiftType}-current`;
        // Ne pas écraser une position historique attribuée par une position actuelle
        const existing = positionsMap.get(key);
        if (!existing || existing.status !== 'attributed') {
          positionsMap.set(key, pos);
        }
      });
      
      // Retourner toutes les positions uniques
      return Array.from(positionsMap.values());
    }
    
    // Utiliser allExchangesForPositions si on affiche "Mes positions" (ancien comportement)
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
      
      // En phase completed, montrer TOUTES les gardes qui concernent l'utilisateur
      if (bagPhaseConfig.phase === 'completed') {
        // Gardes non pourvues (prioritaires pour proposer aux remplaçants)
        const isUnprovidedShift = exchange.status === 'pending';
        
        // Gardes où l'utilisateur était intéressé
        const wasUserInterested = exchange.interestedUsers?.includes(user.id) || false;
        
        // Vérifier si c'est une garde reçue ou donnée via l'échange
        const key = `${exchange.date}-${exchange.period}`;
        const receivedShift = receivedShifts[key];
        const isReceivedByUser = receivedShift && receivedShift.newUserId === user.id;
        const wasGivenByUser = receivedShift && receivedShift.originalUserId === user.id;
        
        // Montrer TOUT ce qui concerne ou a concerné l'utilisateur
        return isUnprovidedShift || isUserShift || wasUserInterested || isReceivedByUser || wasGivenByUser;
      }
      
      return true;
    });
  }, [exchanges, allExchangesForPositions, history, user, showMyInterests, showOwnShifts, bagPhaseConfig.phase, enableHistory, receivedShifts]);
  
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
        // En phase 3 (completed), inclure aussi les gardes 'not_taken' (sans intéressés)
        const statusesToInclude = bagPhaseConfig.phase === 'completed' 
          ? ['pending', 'unavailable', 'not_taken']
          : ['pending', 'unavailable'];
          
        const queryConstraints = [
          where('date', '>=', today),
          where('status', 'in', statusesToInclude),
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
        
        // 3. Listener pour le planning utilisateur avec mises à jour temps réel
        const userPlanningRef = doc(db, 'generated_plannings', user.id);
        const unsubscribeUserPlanning = onSnapshot(
          userPlanningRef,
          (snapshot) => {
            if (!isMounted) return;
            
            if (snapshot.exists()) {
              const data = snapshot.data();
              let mergedAssignments: Record<string, ShiftAssignment> = {};
              
              // Utiliser uniquement la nouvelle structure (par périodes)
              if (data.periods) {
                Object.values(data.periods).forEach((periodData: any) => {
                  if (periodData && periodData.assignments) {
                    mergedAssignments = { ...mergedAssignments, ...periodData.assignments };
                  }
                });
              }
              
              // Vérifier si les assignments ont changé
              const hasChanged = JSON.stringify(userAssignments) !== JSON.stringify(mergedAssignments);
              
              if (hasChanged) {
                console.log('[useShiftExchangeCore] Planning utilisateur mis à jour, invalidation du cache des conflits');
                // Invalider le cache des conflits car le planning a changé
                conflictCheckCache.current.clear();
                planningCache.current[user.id] = { assignments: mergedAssignments };
                
                // Mettre à jour les assignments
                setUserAssignments(mergedAssignments);
                
                // Forcer la revérification des conflits pour les échanges où l'utilisateur est intéressé
                if (enableConflictCheck) {
                  const interestedExchanges = exchanges.filter(e => 
                    e.interestedUsers?.includes(user.id)
                  );
                  
                  // Recalculer les conflits
                  Promise.all(
                    interestedExchanges.map(async exchange => {
                      const result = await checkForConflict(exchange);
                      return { 
                        id: exchange.id, 
                        ...result
                      };
                    })
                  ).then(results => {
                    if (!isMounted) return;
                    
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
                  });
                }
              }
            } else {
              // Le planning n'existe pas/plus
              setUserAssignments({});
              planningCache.current[user.id] = { assignments: {} };
              conflictCheckCache.current.clear();
              
              // Recalculer les conflits même si le planning n'existe plus
              if (enableConflictCheck && exchanges.length > 0) {
                const interestedExchanges = exchanges.filter(e => 
                  e.interestedUsers?.includes(user.id)
                );
                
                if (interestedExchanges.length > 0) {
                  // Tous les conflits devraient être false car l'utilisateur n'a plus de planning
                  const newConflictStates: Record<string, boolean> = {};
                  interestedExchanges.forEach(exchange => {
                    newConflictStates[exchange.id] = false;
                  });
                  setConflictStates(newConflictStates);
                  setConflictDetails({});
                }
              }
            }
          }
        );
        
        unsubscribes.current.push(unsubscribeUserPlanning);
        
        // 4. Listener pour l'historique (si activé)
        if (enableHistory) {
          const historyQuery = query(
            collection(db, 'exchange_history'),
            orderBy('exchangedAt', 'desc')
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
  }, [user, enableHistory, enableConflictCheck, limitResults, checkForConflict, bagPhaseConfig.phase]);
  
  // Effet séparé pour écouter l'événement personnalisé d'annulation
  useEffect(() => {
    const handleExchangeReverted = (event: CustomEvent) => {
      console.log('[useShiftExchangeCore] Événement bag-exchange-reverted reçu:', event.detail);
      
      // Invalider tous les caches
      planningCache.current = {};
      conflictCheckCache.current.clear();
      
      // Forcer le rechargement des données si refreshData est disponible
      if (refreshDataRef.current) {
        refreshDataRef.current();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('bag-exchange-reverted', handleExchangeReverted as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('bag-exchange-reverted', handleExchangeReverted as EventListener);
      }
    };
  }, []); // Pas de dépendances, l'effet s'exécute une seule fois
  
  // Effet pour recalculer les conflits lorsque les échanges changent
  useEffect(() => {
    if (!enableConflictCheck || !user || exchanges.length === 0) return;
    
    // Recalculer les conflits pour les échanges où l'utilisateur est intéressé
    const interestedExchanges = exchanges.filter(e => 
      e.interestedUsers?.includes(user.id)
    );
    
    if (interestedExchanges.length === 0) return;
    
    // Utiliser un timeout pour éviter de recalculer trop souvent
    const timeoutId = setTimeout(async () => {
      console.log('[useShiftExchangeCore] Recalcul des conflits pour', interestedExchanges.length, 'échanges');
      
      const conflictPromises = interestedExchanges.map(async exchange => {
        const result = await checkForConflict(exchange);
        return { 
          id: exchange.id, 
          ...result
        };
      });
      
      const results = await Promise.all(conflictPromises);
      
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
    }, 500); // Debounce de 500ms
    
    return () => clearTimeout(timeoutId);
  }, [exchanges, user, enableConflictCheck, checkForConflict]);
  
  // Effet pour charger toutes les gardes quand "Mes positions" est activé
  useEffect(() => {
    if (!showMyInterests || !user || enableHistory) {
      // Si on a l'historique activé, on n'a pas besoin de cette logique
      setAllExchangesForPositions([]);
      return;
    }
    
    let unsubscribe: Unsubscribe | null = null;
    
    const loadAllExchanges = async () => {
      try {
        // Requête avec filtre de statut pour exclure les échanges validés
        const allExchangesQuery = query(
          collection(db, 'shift_exchanges'),
          where('status', 'in', ['pending', 'unavailable']),
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
    console.log('[useShiftExchangeCore] Rafraîchissement forcé des données');
    
    // Vider tous les caches
    planningCache.current = {};
    conflictCheckCache.current.clear();
    
    if (!user) return;
    
    try {
      // Recharger le planning de l'utilisateur
      const planning = await getGeneratedPlanning(user.id);
      if (planning?.assignments) {
        setUserAssignments(planning.assignments);
        planningCache.current[user.id] = planning;
      }
      
      // Forcer le recalcul des conflits pour tous les échanges où l'utilisateur est intéressé
      if (enableConflictCheck && exchanges.length > 0) {
        const interestedExchanges = exchanges.filter(e => 
          e.interestedUsers?.includes(user.id)
        );
        
        if (interestedExchanges.length > 0) {
          console.log('[useShiftExchangeCore] Recalcul forcé des conflits pour', interestedExchanges.length, 'échanges');
          
          const conflictPromises = interestedExchanges.map(async exchange => {
            const result = await checkForConflict(exchange);
            return { 
              id: exchange.id, 
              ...result
            };
          });
          
          const results = await Promise.all(conflictPromises);
          
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
    } catch (error) {
      console.error('[useShiftExchangeCore] Erreur lors du rafraîchissement:', error);
    }
  }, [user, exchanges, enableConflictCheck, checkForConflict]);
  
  // Mettre à jour la ref après la définition de refreshData
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);
  
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