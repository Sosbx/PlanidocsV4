import { useState, useEffect, useCallback } from 'react';
import { getShiftExchanges, validateShiftExchange, removeShiftExchange, removeUserFromExchange, getExchangeHistory } from '../lib/firebase/shifts';
import type { ShiftExchange, ExchangeHistory } from '../types/planning';
import type { User } from '../types/users';

export const useExchangeManagement = (user: User | null) => {
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExchanges = useCallback(async () => {
    try {
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
      return data;
    } catch (err) {
      console.error('Error loading exchanges:', err);
      setError('Erreur lors du chargement des gardes');
      setExchanges([]); // Initialiser avec un tableau vide en cas d'erreur
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getExchangeHistory();
      setHistory(data);
      return data;
    } catch (err) {
      console.error('Error loading exchange history:', err);
      setError('Erreur lors du chargement de l\'historique des échanges');
      setHistory([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExchanges();
    loadHistory(); // Charger également l'historique au démarrage
  }, [loadExchanges, loadHistory]);

  const handleValidateExchange = useCallback(async (exchangeId: string, interestedUserId: string, hasConflict: boolean) => {
    if (!user) return false;
    
    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prev => prev.filter(exchange => exchange.id !== exchangeId));
      
      // Appel à l'API pour valider l'échange, en passant explicitement le paramètre hasConflict
      await validateShiftExchange(exchangeId, interestedUserId, user.id);
      
      // Recharger les échanges pour s'assurer de la synchronisation après la transaction
      await loadExchanges();
      // Également recharger l'historique pour mettre à jour les statistiques
      await loadHistory();
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
  }, [user, loadExchanges, loadHistory]);

  const handleRejectExchange = useCallback(async (exchangeId: string) => {
    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prev => prev.filter(exchange => exchange.id !== exchangeId));
      
      // Appel à l'API pour rejeter l'échange
      await removeShiftExchange(exchangeId);
      
      // Recharger les échanges pour s'assurer de la synchronisation
      await loadExchanges();
      // Mise à jour des statistiques
      await loadHistory();
      return true;
    } catch (error) {
      console.error('Error rejecting exchange:', { error, exchangeId });
      
      // En cas d'erreur, recharger les échanges pour rétablir l'état correct
      await loadExchanges();
      throw error;
    }
  }, [loadExchanges, loadHistory]);

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
      
      // Recharger les échanges pour s'assurer de la synchronisation
      await loadExchanges();
      // Mise à jour des statistiques
      await loadHistory();
      return true;
    } catch (error) {
      console.error('Error removing user from exchange:', { error, exchangeId, userId });
      
      // En cas d'erreur, recharger les échanges pour rétablir l'état correct
      await loadExchanges();
      throw error;
    }
  }, [loadExchanges, loadHistory]);

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