import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { ShiftExchange, GeneratedPlanning } from '../types/planning';

export const useConflictCheck = (exchanges: ShiftExchange[]) => {
  const [conflictStates, setConflictStates] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConflicts = async () => {
      if (!exchanges.length) {
        setLoading(false);
        return;
      }

      try {
        // Créer un tableau de promesses pour tous les utilisateurs intéressés
        const promises: Promise<{
          exchangeId: string;
          userId: string;
          hasConflict: boolean;
        }>[] = [];

        exchanges.forEach(exchange => {
          if (exchange.interestedUsers?.length) {
            exchange.interestedUsers.forEach(userId => {
              promises.push(
                getDoc(doc(db, 'generated_plannings', userId)).then(doc => {
                  const planning = doc.exists() ? (doc.data() as GeneratedPlanning) : null;
                  const assignmentKey = `${exchange.date}-${exchange.period}`;
                  return {
                    exchangeId: exchange.id,
                    userId,
                    hasConflict: Boolean(planning?.assignments[assignmentKey])
                  };
                })
              );
            });
          }
        });

        // Exécuter toutes les promesses en parallèle
        const results = await Promise.all(promises);

        // Organiser les résultats
        const states: Record<string, Record<string, boolean>> = {};
        results.forEach(({ exchangeId, userId, hasConflict }) => {
          if (!states[exchangeId]) {
            states[exchangeId] = {};
          }
          states[exchangeId][userId] = hasConflict;
        });

        setConflictStates(states);
      } catch (error) {
        console.error('Error checking conflicts:', error);
      } finally {
        setLoading(false);
      }
    };

    checkConflicts();
  }, [exchanges]);

  return {
    conflictStates,
    loading
  };
};

export default useConflictCheck;