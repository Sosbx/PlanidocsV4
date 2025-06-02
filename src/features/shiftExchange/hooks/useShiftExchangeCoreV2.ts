import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { Unsubscribe } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../auth/hooks';
import { useUsers } from '../../auth/hooks';
import { useBagPhase } from './useBagPhase';
import { getGeneratedPlanning } from '../../../lib/firebase/planning';
import { 
  subscribeToOptimizedExchanges,
  getOptimizedHistory,
  batchCheckConflicts,
  invalidateCache,
  batchExchangeOperations
} from '../../../lib/firebase/exchange';
import { performanceMonitor } from '../services/performanceMonitor';
import { feedbackService, FEEDBACK_MESSAGES } from '../services/feedbackService';
import type { ShiftExchange, ShiftAssignment, ExchangeHistory, ConflictInfo } from '../../../types/shiftExchange';
import type { User } from '../../../types/users';

interface UseShiftExchangeCoreV2Options {
  enableHistory?: boolean;
  enableConflictCheck?: boolean;
  limitResults?: number;
  enablePerformanceMonitoring?: boolean;
}

interface UseShiftExchangeCoreV2Result {
  // Data
  exchanges: ShiftExchange[];
  filteredExchanges: ShiftExchange[];
  history: ExchangeHistory[];
  userAssignments: Record<string, ShiftAssignment>;
  receivedShifts: Record<string, any>;
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
  
  // Performance
  performanceReport?: () => void;
}

/**
 * Version 2 du hook principal avec optimisations avancées et monitoring
 */
export const useShiftExchangeCoreV2 = (
  options: UseShiftExchangeCoreV2Options = {}
): UseShiftExchangeCoreV2Result => {
  const {
    enableHistory = false,
    enableConflictCheck = true,
    limitResults = 100,
    enablePerformanceMonitoring = process.env.NODE_ENV === 'development'
  } = options;
  
  // Context hooks
  const { user } = useAuth();
  const { users } = useUsers();
  const { config: bagPhaseConfig, isLoading: configLoading } = useBagPhase();
  
  // Core states
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
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
  const lastHistoryFetch = useRef<number>(0);
  
  // Mémorisation de isInteractionDisabled
  const isInteractionDisabled = useMemo(
    () => bagPhaseConfig.phase !== 'submission',
    [bagPhaseConfig.phase]
  );
  
  // Filtrage mémorisé avec monitoring
  const filteredExchanges = useMemo(() => {
    if (!user) return [];
    
    return performanceMonitor.measure('filterExchanges', () => {
      return exchanges.filter(exchange => {
        const isUserShift = exchange.userId === user.id;
        const isUserInterested = exchange.interestedUsers?.includes(user.id) || false;
        
        if (showMyInterests) {
          return isUserInterested;
        }
        
        if (!showOwnShifts && isUserShift) {
          return false;
        }
        
        if (bagPhaseConfig.phase === 'completed' && !isUserShift) {
          return false;
        }
        
        return true;
      });
    }, { count: exchanges.length });
  }, [exchanges, user, showMyInterests, showOwnShifts, bagPhaseConfig.phase]);
  
  // Fonction optimisée pour vérifier les conflits
  const checkForConflict = useCallback(async (
    exchange: ShiftExchange, 
    userId?: string
  ): Promise<ConflictInfo> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return { hasConflict: false };
    
    try {
      // Utiliser la fonction batch pour vérifier plusieurs conflits
      const conflictMap = await batchCheckConflicts(
        [targetUserId],
        exchange.date,
        exchange.period
      );
      
      const hasConflict = conflictMap.get(targetUserId) || false;
      
      return {
        hasConflict,
        date: exchange.date,
        period: exchange.period,
        userId: targetUserId
      };
    } catch (error) {
      console.error('Error checking conflict:', error);
      return { hasConflict: false };
    }
  }, [user?.id]);
  
  // Effet principal pour configurer les listeners
  useEffect(() => {
    if (!user || configLoading) return;
    
    let isMounted = true;
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const setupListeners = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Mesurer le temps de chargement initial
        await performanceMonitor.measureAsync('initialDataLoad', async () => {
          // 1. Listener optimisé pour les échanges
          const unsubscribeExchanges = subscribeToOptimizedExchanges(
            async (exchangeData) => {
              if (!isMounted) return;
              
              setExchanges(exchangeData);
              
              // Vérification des conflits en batch
              if (enableConflictCheck && user) {
                await performanceMonitor.measureAsync('conflictCheck', async () => {
                  const interestedExchanges = exchangeData.filter(e => 
                    e.interestedUsers?.includes(user.id)
                  );
                  
                  if (interestedExchanges.length > 0) {
                    // Grouper par date-période pour optimiser
                    const groupedExchanges = new Map<string, ShiftExchange[]>();
                    interestedExchanges.forEach(exchange => {
                      const key = `${exchange.date}-${exchange.period}`;
                      if (!groupedExchanges.has(key)) {
                        groupedExchanges.set(key, []);
                      }
                      groupedExchanges.get(key)!.push(exchange);
                    });
                    
                    // Vérifier les conflits par groupe
                    const conflictPromises = Array.from(groupedExchanges.entries()).map(
                      async ([key, exchanges]) => {
                        const [date, period] = key.split('-');
                        const conflictMap = await batchCheckConflicts([user.id], date, period as any);
                        const hasConflict = conflictMap.get(user.id) || false;
                        
                        return exchanges.map(exchange => ({
                          id: exchange.id,
                          hasConflict,
                          key
                        }));
                      }
                    );
                    
                    const results = (await Promise.all(conflictPromises)).flat();
                    
                    if (isMounted) {
                      const newConflictStates: Record<string, boolean> = {};
                      const newConflictDetails: Record<string, ConflictInfo> = {};
                      
                      results.forEach(({ id, hasConflict, key }) => {
                        newConflictStates[id] = hasConflict;
                        if (hasConflict) {
                          const [date, period] = key.split('-');
                          newConflictDetails[key] = {
                            hasConflict: true,
                            date,
                            period: period as any
                          };
                        }
                      });
                      
                      setConflictStates(newConflictStates);
                      setConflictDetails(newConflictDetails);
                    }
                  }
                });
              }
              
              setLoading(false);
            },
            today,
            limitResults
          );
          
          unsubscribes.current.push(unsubscribeExchanges);
          
          // 2. Charger le planning utilisateur
          const planning = await getGeneratedPlanning(user.id);
          if (isMounted && planning?.assignments) {
            setUserAssignments(planning.assignments);
            planningCache.current[user.id] = planning;
          }
          
          // 3. Charger l'historique si activé
          if (enableHistory) {
            const { history: historyData } = await getOptimizedHistory(50);
            if (isMounted) {
              setHistory(historyData);
              lastHistoryFetch.current = Date.now();
              
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
          }
        });
      } catch (error) {
        console.error('Error setting up listeners:', error);
        if (isMounted) {
          setError('Erreur lors de l\'initialisation');
          feedbackService.error(error as Error);
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
      planningCache.current = {};
    };
  }, [user, enableHistory, enableConflictCheck, limitResults, configLoading]);
  
  // Actions avec feedback et monitoring
  const toggleInterest = useCallback(async (exchange: ShiftExchange) => {
    if (!user || isInteractionDisabled) {
      feedbackService.warning(FEEDBACK_MESSAGES.PHASE_INCORRECT);
      return;
    }
    
    const loadingToast = feedbackService.loading('Traitement en cours...');
    
    try {
      await performanceMonitor.measureAsync('toggleInterest', async () => {
        const { toggleInterest: toggleInterestFn } = await import('../../../lib/firebase/exchange');
        await toggleInterestFn(exchange.id, user.id);
      });
      
      const isInterested = exchange.interestedUsers?.includes(user.id);
      loadingToast.success(
        isInterested ? FEEDBACK_MESSAGES.INTEREST_REMOVED : FEEDBACK_MESSAGES.INTEREST_ADDED
      );
    } catch (error) {
      console.error('Error toggling interest:', error);
      loadingToast.error('Erreur lors de l\'opération');
    }
  }, [user, isInteractionDisabled]);
  
  // Autres actions (validateExchange, rejectExchange, etc.) avec pattern similaire...
  
  // Fonction de rafraîchissement
  const refreshData = useCallback(async () => {
    invalidateCache();
    
    if (user) {
      const planning = await getGeneratedPlanning(user.id);
      if (planning?.assignments) {
        setUserAssignments(planning.assignments);
        planningCache.current[user.id] = planning;
      }
    }
    
    // Forcer la mise à jour de l'historique
    if (enableHistory && Date.now() - lastHistoryFetch.current > 30000) {
      const { history: historyData } = await getOptimizedHistory(50);
      setHistory(historyData);
      lastHistoryFetch.current = Date.now();
    }
  }, [user, enableHistory]);
  
  // Fonction pour obtenir le rapport de performance
  const performanceReport = useCallback(() => {
    if (enablePerformanceMonitoring) {
      performanceMonitor.logReports();
    }
  }, [enablePerformanceMonitoring]);
  
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
    toggleInterest,
    validateExchange: async () => {}, // À implémenter
    rejectExchange: async () => {}, // À implémenter
    removeUser: async () => {}, // À implémenter
    
    // Utility
    checkForConflict,
    refreshData,
    
    // Performance
    performanceReport: enablePerformanceMonitoring ? performanceReport : undefined
  };
};

export default useShiftExchangeCoreV2;