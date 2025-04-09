import { useState, useEffect, useCallback, useRef } from 'react';
import { getShiftExchanges, validateShiftExchange, removeShiftExchange, removeUserFromExchange, getExchangeHistory } from '../lib/firebase/shifts';
import type { ShiftExchange, ExchangeHistory } from '../types/planning';
import type { User } from '../types/users';

// Fonction utilitaire pour le debounce
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

export const useExchangeManagement = (user: User | null) => {
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Références pour suivre l'état des chargements en cours
  const isLoadingExchanges = useRef(false);
  const isLoadingHistory = useRef(false);
  
  // Dernière fois que les données ont été chargées
  const lastLoadTime = useRef({
    exchanges: 0,
    history: 0
  });
  
  // Durée minimale entre les rechargements (en ms)
  const MIN_RELOAD_INTERVAL = 2000;

  const loadExchanges = useCallback(async () => {
    // Si un chargement est déjà en cours, ne pas en lancer un autre
    if (isLoadingExchanges.current) {
      return exchanges;
    }
    
    // Vérifier si on a récemment chargé les données
    const now = Date.now();
    if (now - lastLoadTime.current.exchanges < MIN_RELOAD_INTERVAL) {
      console.info('Skipping exchange reload, too soon since last load');
      return exchanges;
    }
    
    try {
      isLoadingExchanges.current = true;
      setLoading(true);
      setError(null);
      
      const data = await getShiftExchanges();
      
      // Trier les échanges par date et statut
      data.sort((a, b) => {
        // D'abord par statut (pending avant unavailable)
        if (a.status === 'pending' && b.status === 'unavailable') return -1;
        if (a.status === 'unavailable' && b.status === 'pending') return 1;
        // Ensuite par date
        return a.date.localeCompare(b.date);
      });
      
      setExchanges(data);
      lastLoadTime.current.exchanges = now;
      return data;
    } catch (err) {
      console.error('Error loading exchanges:', err);
      setError('Erreur lors du chargement des gardes');
      return exchanges; // Retourner l'état actuel en cas d'erreur
    } finally {
      isLoadingExchanges.current = false;
      setLoading(false);
    }
  }, [exchanges]);

  // Version debounced du chargement de l'historique
  const debouncedLoadHistory = useCallback(
    debounce(async () => {
      if (isLoadingHistory.current) {
        return history;
      }
      
      const now = Date.now();
      if (now - lastLoadTime.current.history < MIN_RELOAD_INTERVAL) {
        console.info('Skipping history reload, too soon since last load');
        return history;
      }
      
      try {
        isLoadingHistory.current = true;
        const data = await getExchangeHistory();
        setHistory(data);
        lastLoadTime.current.history = now;
        return data;
      } catch (err) {
        console.error('Error loading exchange history:', err);
        return history; // Retourner l'état actuel en cas d'erreur
      } finally {
        isLoadingHistory.current = false;
      }
    }, 300),
    [history]
  );
  
  // Fonction publique non-debounced pour les appels explicites
  const loadHistory = useCallback(async () => {
    try {
      if (isLoadingHistory.current) {
        return history;
      }
      
      const now = Date.now();
      if (now - lastLoadTime.current.history < MIN_RELOAD_INTERVAL) {
        console.info('Skipping history reload, too soon since last load');
        return history;
      }
      
      isLoadingHistory.current = true;
      setLoading(true);
      setError(null);
      
      const data = await getExchangeHistory();
      setHistory(data);
      lastLoadTime.current.history = now;
      return data;
    } catch (err) {
      console.error('Error loading exchange history:', err);
      setError('Erreur lors du chargement de l\'historique des échanges');
      return history; // Retourner l'état actuel en cas d'erreur
    } finally {
      isLoadingHistory.current = false;
      setLoading(false);
    }
  }, [history]);

  useEffect(() => {
    // Chargement initial des données
    loadExchanges();
    loadHistory(); // Chargement explicite, non debounced
  }, [loadExchanges, loadHistory]);

  const handleValidateExchange = useCallback(async (exchangeId: string, interestedUserId: string, hasConflict: boolean) => {
    if (!user) return false;
    
    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prev => prev.filter(exchange => exchange.id !== exchangeId));
      
      // Appel à l'API pour valider l'échange, en passant explicitement le paramètre hasConflict
      await validateShiftExchange(exchangeId, interestedUserId, user.id);
      
      // Pour réduire les requêtes répétées, utiliser Promise.all pour les rechargements parallèles
      await Promise.all([
        loadExchanges(),    // Recharger les échanges pour s'assurer de la synchronisation
        debouncedLoadHistory() // Utiliser la version debounced pour l'historique
      ]);
      
      return true;
    } catch (error) {
      console.error('Error validating exchange:', {
        error,
        exchangeId,
        interestedUserId,
        hasConflict
      });
      
      // En cas d'erreur, recharger les échanges pour rétablir l'état correct
      await loadExchanges();
      throw error;
    }
  }, [user, loadExchanges, debouncedLoadHistory]);

  const handleRejectExchange = useCallback(async (exchangeId: string) => {
    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prev => prev.filter(exchange => exchange.id !== exchangeId));
      
      // Appel à l'API pour rejeter l'échange
      await removeShiftExchange(exchangeId);
      
      // Utiliser Promise.all pour les rechargements parallèles
      await Promise.all([
        loadExchanges(),
        debouncedLoadHistory() // Version debounced
      ]);
      
      return true;
    } catch (error) {
      console.error('Error rejecting exchange:', { error, exchangeId });
      
      // En cas d'erreur, recharger les échanges pour rétablir l'état correct
      await loadExchanges();
      throw error;
    }
  }, [loadExchanges, debouncedLoadHistory]);

  const handleRemoveUser = useCallback(async (exchangeId: string, userId: string) => {
    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prev => prev.map(e => {
        if (e.id === exchangeId) {
          return {
            ...e,
            interestedUsers: (e.interestedUsers || []).filter(id => id !== userId)
          };
        }
        return e;
      }));
      
      // Appel à l'API pour supprimer l'utilisateur de l'échange
      await removeUserFromExchange(exchangeId, userId);
      
      // Utiliser Promise.all pour les rechargements parallèles
      await Promise.all([
        loadExchanges(),
        debouncedLoadHistory() // Version debounced
      ]);
      
      return true;
    } catch (error) {
      console.error('Error removing user from exchange:', { error, exchangeId, userId });
      
      // En cas d'erreur, recharger les échanges pour rétablir l'état correct
      await loadExchanges();
      throw error;
    }
  }, [loadExchanges, debouncedLoadHistory]);

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
    loadHistory
  };
};

export default useExchangeManagement;