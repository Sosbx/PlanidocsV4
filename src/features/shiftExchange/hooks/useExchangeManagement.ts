import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getShiftExchanges, 
  validateShiftExchange, 
  removeShiftExchange, 
  removeUserFromExchange, 
  getExchangeHistory,
  subscribeToShiftExchanges,
  subscribeToExchangeHistory
} from '../../../lib/firebase/exchange';
import type { ShiftExchange as FeatureShiftExchange } from '../types';
import type { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';
import type { ExchangeHistory } from '../types';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = FeatureShiftExchange | PlanningShiftExchange;
import type { User } from '../../../types/users';

// Fonction utilitaire pour le debounce
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

// Fonction pour comparer deux tableaux d'échanges
const areExchangesEqual = (a: ShiftExchange[], b: ShiftExchange[]): boolean => {
  if (a.length !== b.length) return false;
  
  const aIds = new Set(a.map(e => e.id));
  const bIds = new Set(b.map(e => e.id));
  
  // Vérifier si tous les IDs de a sont dans b
  for (const id of aIds) {
    if (!bIds.has(id)) return false;
  }
  
  // Vérifier si tous les IDs de b sont dans a
  for (const id of bIds) {
    if (!aIds.has(id)) return false;
  }
  
  return true;
};

export const useExchangeManagement = (user: User | null) => {
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Référence pour suivre si les requêtes sont en cours
  const isLoading = useRef(false);

  const loadExchanges = useCallback(async () => {
    if (isLoading.current) return;

    try {
      isLoading.current = true;
      setLoading(true);
      setError(null);
      
      const data = await getShiftExchanges();
      
      // Trier les échanges par date et statut
      if (data && data.length > 0) {
        data.sort((a, b) => {
          // D'abord par statut (pending avant unavailable)
          if (a.status === 'pending' && b.status === 'unavailable') return -1;
          if (a.status === 'unavailable' && b.status === 'pending') return 1;
          // Ensuite par date
          return a.date.localeCompare(b.date);
        });
      } 
      
      setExchanges(data || []);
      return data;
    } catch (err) {
      console.error('Error loading exchanges:', err);
      setError('Erreur lors du chargement des gardes');
      return [] as ShiftExchange[];
    } finally {
      isLoading.current = false;
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (isLoading.current) return;
    
    try {
      isLoading.current = true;
      setError(null);
      
      const data = await getExchangeHistory();
      setHistory(data || []);
      return data;
    } catch (err) {
      console.error('Error loading exchange history:', err);
      setError('Erreur lors du chargement de l\'historique des échanges');
      return [] as ExchangeHistory[];
    } finally {
      isLoading.current = false;
    }
  }, []);

  // Utiliser la fonction d'abonnement aux changements en temps réel
  useEffect(() => {
    // Abonnement aux changements en temps réel des échanges
    const exchangesUnsubscribe = subscribeToShiftExchanges((updatedExchanges) => {
      console.log('Receiving real-time update with', updatedExchanges.length, 'exchanges');
      setExchanges(updatedExchanges);
      setLoading(false);
    });
    
    // Abonnement aux changements en temps réel de l'historique
    const historyUnsubscribe = subscribeToExchangeHistory((updatedHistory) => {
      console.log('Receiving real-time history update with', updatedHistory.length, 'entries');
      setHistory(updatedHistory);
    });
    
    // Nettoyage des abonnements lors du démontage du composant
    return () => {
      exchangesUnsubscribe();
      historyUnsubscribe();
    };
  }, []);

  const handleValidateExchange = useCallback(async (exchangeId: string, interestedUserId: string, hasConflict: boolean) => {
    if (!user) return false;
    
    try {
      // Pas besoin de mise à jour optimiste de l'état, l'abonnement temps réel s'en chargera
      
      // Appel à l'API pour valider l'échange
      await validateShiftExchange(exchangeId, interestedUserId, user.id);
      
      // Les mises à jour seront automatiques via les abonnements
      return true;
    } catch (error) {
      console.error('Error validating exchange:', error);
      throw error;
    }
  }, [user]);

  const handleRejectExchange = useCallback(async (exchangeId: string) => {
    try {
      // Pas besoin de mise à jour optimiste de l'état, l'abonnement temps réel s'en chargera
      
      // Appel à l'API pour rejeter l'échange
      await removeShiftExchange(exchangeId);
      
      // Les mises à jour seront automatiques via les abonnements
      return true;
    } catch (error) {
      console.error('Error rejecting exchange:', error);
      throw error;
    }
  }, []);

  const handleRemoveUser = useCallback(async (exchangeId: string, userId: string) => {
    try {
      // Pas besoin de mise à jour optimiste de l'état, l'abonnement temps réel s'en chargera
      
      // Appel à l'API pour supprimer l'utilisateur de l'échange
      await removeUserFromExchange(exchangeId, userId);
      
      // Pas besoin de recharger les échanges, les mises à jour viennent via l'abonnement
      
      return true;
    } catch (error) {
      console.error('Error removing user from exchange:', error);
      throw error;
    }
  }, []);

  // Fonction pour recharger toutes les données
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Refreshing all data...');
      
      // Recharger les échanges et l'historique en parallèle
      const [exchangesResult, historyResult] = await Promise.all([
        getShiftExchanges(), // Appel direct à l'API pour contourner le cache
        getExchangeHistory()  // Appel direct à l'API pour contourner le cache
      ]);
      
      console.log('Data refreshed:', {
        exchanges: exchangesResult.length,
        history: historyResult.length
      });
      
      // Mettre à jour l'état avec les nouvelles données
      setExchanges(exchangesResult);
      setHistory(historyResult);
      
      return true;
    } catch (error) {
      console.error('Error refreshing data:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    exchanges,
    history,
    setExchanges,
    loading,
    error,
    handleValidateExchange,
    handleRejectExchange,
    handleRemoveUser,
    loadExchanges,
    loadHistory,
    refreshData
  };
};

export default useExchangeManagement;
