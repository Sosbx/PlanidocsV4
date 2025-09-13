import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocs,
  Unsubscribe,
  DocumentData
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { format } from 'date-fns';
import type { ShiftExchange, ExchangeHistory } from '../types';
import type { ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';
import { getGeneratedPlanning } from '../../../lib/firebase/planning';
import { calculateUserStats, calculateGlobalStats, type UserBagStats, type GlobalBagStats } from '../../../utils/bagStatistics';
import { historyManager } from '../../../lib/firebase/exchange';

// Cache singleton pour éviter les requêtes multiples
let dataCache: {
  exchanges: ShiftExchange[];
  history: ExchangeHistory[];
  userAssignments: Map<string, Record<string, ShiftAssignment>>;
  lastUpdate: number;
} | null = null;

// Listeners singleton
let listeners: {
  exchanges: Unsubscribe | null;
  history: Unsubscribe | null;
  refCount: number;
} = {
  exchanges: null,
  history: null,
  refCount: 0
};

export interface BagDataResult {
  // Données brutes
  exchanges: ShiftExchange[];
  history: ExchangeHistory[];
  userAssignments: Map<string, Record<string, ShiftAssignment>>;
  
  // Données filtrées
  pendingExchanges: ShiftExchange[];
  completedExchanges: ShiftExchange[];
  unavailableExchanges: ShiftExchange[];
  rejectedExchanges: ShiftExchange[];
  
  // Statistiques par utilisateur
  userStats: Map<string, UserBagStats>;
  
  // Statistiques globales
  globalStats: GlobalBagStats;
  
  // État
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  
  // Actions
  refreshData: () => Promise<void>;
  getUserAssignments: (userId: string) => Promise<Record<string, ShiftAssignment>>;
  getUserStats: (userId: string) => UserBagStats | null;
}

/**
 * Hook centralisé pour toutes les données BAG
 * Utilise un cache singleton et des listeners partagés pour optimiser les performances
 */
export const useBagData = (users: User[]): BagDataResult => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // États locaux qui pointent vers le cache global
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [userAssignments, setUserAssignments] = useState<Map<string, Record<string, ShiftAssignment>>>(new Map());
  
  // Référence pour savoir si le composant est monté
  const isMounted = useRef(true);
  
  // Initialisation et gestion des listeners
  useEffect(() => {
    isMounted.current = true;
    listeners.refCount++;
    
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Si on a un cache récent (moins de 5 secondes), l'utiliser
        if (dataCache && Date.now() - dataCache.lastUpdate < 5000) {
          setExchanges(dataCache.exchanges);
          setHistory(dataCache.history);
          setUserAssignments(dataCache.userAssignments);
          setLastUpdate(new Date(dataCache.lastUpdate));
          setLoading(false);
          return;
        }
        
        // Si les listeners ne sont pas actifs, les créer
        if (!listeners.exchanges) {
          const today = format(new Date(), 'yyyy-MM-dd');
          
          // Listener pour les échanges (exclure les échanges validés)
          const exchangesQuery = query(
            collection(db, 'shift_exchanges'),
            where('status', 'in', ['pending', 'unavailable', 'not_taken']),
            orderBy('date', 'asc')
          );
          
          listeners.exchanges = onSnapshot(
            exchangesQuery,
            (snapshot) => {
              const exchangeData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as ShiftExchange[];
              
              // Mettre à jour le cache
              if (dataCache) {
                dataCache.exchanges = exchangeData;
                dataCache.lastUpdate = Date.now();
              } else {
                dataCache = {
                  exchanges: exchangeData,
                  history: [],
                  userAssignments: new Map(),
                  lastUpdate: Date.now()
                };
              }
              
              // Mettre à jour l'état local si le composant est monté
              if (isMounted.current) {
                setExchanges(exchangeData);
                setLastUpdate(new Date());
              }
            },
            (error) => {
              console.error('Error loading exchanges:', error);
              if (isMounted.current) {
                setError('Erreur lors du chargement des échanges');
              }
            }
          );
        }
        
        // Utiliser le gestionnaire d'historique centralisé
        if (!listeners.history) {
          // Démarrer l'écoute si pas déjà active
          historyManager.startListening();
          
          // S'abonner aux changements
          const unsubscribe = historyManager.subscribe((historyData) => {
            // Mettre à jour le cache
            if (dataCache) {
              dataCache.history = historyData;
              dataCache.lastUpdate = Date.now();
            }
            
            // Mettre à jour l'état local si le composant est monté
            if (isMounted.current) {
              setHistory(historyData);
              setLastUpdate(new Date());
            }
          });
          
          // Stocker la fonction de désabonnement
          listeners.history = unsubscribe;
          
          // Obtenir l'historique actuel immédiatement
          const currentHistory = historyManager.getHistory();
          if (currentHistory.length > 0 && isMounted.current) {
            setHistory(currentHistory);
            if (dataCache) {
              dataCache.history = currentHistory;
            }
          }
        }
        
        // Si on a déjà des données dans le cache, les utiliser
        if (dataCache) {
          setExchanges(dataCache.exchanges);
          setHistory(dataCache.history);
          setUserAssignments(dataCache.userAssignments);
          setLastUpdate(new Date(dataCache.lastUpdate));
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing BAG data:', error);
        if (isMounted.current) {
          setError('Erreur lors de l\'initialisation des données');
          setLoading(false);
        }
      }
    };
    
    initializeData();
    
    // Cleanup
    return () => {
      isMounted.current = false;
      listeners.refCount--;
      
      // Si c'est le dernier composant qui utilise les listeners, les nettoyer
      if (listeners.refCount === 0) {
        if (listeners.exchanges) {
          listeners.exchanges();
          listeners.exchanges = null;
        }
        if (listeners.history) {
          listeners.history();
          listeners.history = null;
        }
        // Garder le cache pendant 30 secondes après la dernière utilisation
        setTimeout(() => {
          if (listeners.refCount === 0) {
            dataCache = null;
          }
        }, 30000);
      }
    };
  }, []);
  
  // Fonction pour charger les assignations d'un utilisateur
  const getUserAssignments = useCallback(async (userId: string): Promise<Record<string, ShiftAssignment>> => {
    // Vérifier le cache d'abord
    const cached = userAssignments.get(userId);
    if (cached) return cached;
    
    try {
      const planning = await getGeneratedPlanning(userId);
      if (planning?.assignments) {
        // Mettre à jour le cache local et global
        const newMap = new Map(userAssignments);
        newMap.set(userId, planning.assignments);
        setUserAssignments(newMap);
        
        if (dataCache) {
          dataCache.userAssignments = newMap;
        }
        
        return planning.assignments;
      }
      return {};
    } catch (error) {
      console.error(`Error loading assignments for user ${userId}:`, error);
      return {};
    }
  }, [userAssignments]);
  
  // Données filtrées mémorisées
  const pendingExchanges = useMemo(
    () => exchanges.filter(e => e.status === 'pending'),
    [exchanges]
  );
  
  const completedExchanges = useMemo(
    () => history.filter(h => h.status === 'completed'),
    [history]
  );
  
  const unavailableExchanges = useMemo(
    () => exchanges.filter(e => e.status === 'unavailable'),
    [exchanges]
  );
  
  const rejectedExchanges = useMemo(
    () => history.filter(h => h.status === 'rejected'),
    [history]
  );
  
  // Calcul des statistiques par utilisateur
  const userStats = useMemo(() => {
    const stats = new Map<string, UserBagStats>();
    
    users.forEach(user => {
      if (user.roles.isUser) {
        const userStat = calculateUserStats(user.id, exchanges, history);
        stats.set(user.id, userStat);
      }
    });
    
    return stats;
  }, [users, exchanges, history]);
  
  // Calcul des statistiques globales
  const globalStats = useMemo(
    () => calculateGlobalStats(exchanges, history, users.filter(u => u.roles.isUser)),
    [exchanges, history, users]
  );
  
  // Fonction pour obtenir les stats d'un utilisateur
  const getUserStats = useCallback((userId: string): UserBagStats | null => {
    return userStats.get(userId) || null;
  }, [userStats]);
  
  // Fonction de rafraîchissement manuel
  const refreshData = useCallback(async () => {
    // Forcer le rechargement en invalidant le cache
    if (dataCache) {
      dataCache.lastUpdate = 0;
    }
    
    // Recharger les données
    setLoading(true);
    
    try {
      // Les listeners vont automatiquement recharger les données
      // On peut aussi forcer le rechargement des assignations utilisateur si nécessaire
      const newAssignments = new Map<string, Record<string, ShiftAssignment>>();
      setUserAssignments(newAssignments);
      
      if (dataCache) {
        dataCache.userAssignments = newAssignments;
      }
      
      setError(null);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Erreur lors du rafraîchissement des données');
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    // Données brutes
    exchanges,
    history,
    userAssignments,
    
    // Données filtrées
    pendingExchanges,
    completedExchanges,
    unavailableExchanges,
    rejectedExchanges,
    
    // Statistiques
    userStats,
    globalStats,
    
    // État
    loading,
    error,
    lastUpdate,
    
    // Actions
    refreshData,
    getUserAssignments,
    getUserStats
  };
};