import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
from "../../lib/firebase/config";
import { useAuth } from '../../useAuth';
import type { ExchangeHistory } from '../../../types/planning';

interface ReceivedShift {
  originalUserId: string;
  newUserId: string;
  isPermutation: boolean;
  shiftType: string;
  timeSlot: string;
}

/**
 * Hook pour récupérer les gardes reçues via des échanges
 * Séparé pour une meilleure séparation des préoccupations
 */
export function useReceivedShifts() {
  const { user } = useAuth();
  const [receivedShifts, setReceivedShifts] = useState<Record<string, ReceivedShift>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Charger l'historique des échanges pour identifier les gardes reçues
    const loadExchangeHistory = async () => {
      try {
        // Utiliser une requête avec where pour filtrer directement les échanges pertinents
        const historyQuery = query(
          collection(db, 'exchange_history'),
          where('status', '==', 'completed')
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const receivedShiftsData: Record<string, ReceivedShift> = {};

        historySnapshot.docs.forEach(doc => {
          const history = doc.data() as ExchangeHistory;
          
          // Ne prendre en compte que les échanges complétés (non annulés) et où cet utilisateur est impliqué
          if (history.status === 'completed' && 
              (history.originalUserId === user.id || history.newUserId === user.id)) {
            const key = `${history.date}-${history.period}`;
            receivedShiftsData[key] = {
              originalUserId: history.originalUserId,
              newUserId: history.newUserId,
              isPermutation: Boolean(history.isPermutation),
              shiftType: history.shiftType,
              timeSlot: history.timeSlot
            };
          }
        });

        setReceivedShifts(receivedShiftsData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading exchange history:', error);
        setLoading(false);
      }
    };

    // Charger les données initiales
    loadExchangeHistory();

    // Observer les changements d'historique
    const unsubscribeExchangeHistory = onSnapshot(
      collection(db, 'exchange_history'),
      async () => {
        // Recharger l'historique des échanges quand il y a des changements
        await loadExchangeHistory();
      },
      (error) => {
        console.error('Error monitoring exchange history:', error);
      }
    );

    // Nettoyage à la désactivation du composant
    return () => {
      unsubscribeExchangeHistory();
    };
  }, [user]);

  return {
    receivedShifts,
    loading
  };
}
