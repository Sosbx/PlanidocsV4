import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import type { ShiftExchange, GeneratedPlanning, ShiftAssignment } from '../types';

export const useUserAssignments = (exchanges: ShiftExchange[]) => {
  const [userAssignments, setUserAssignments] = useState<Record<string, Record<string, ShiftAssignment>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Récupérer la liste unique des utilisateurs intéressés
        const uniqueUserIds = Array.from(new Set(
          exchanges.flatMap(exchange => exchange.interestedUsers || [])
        ));

        if (uniqueUserIds.length === 0) {
          setLoading(false);
          return;
        }

        // Charger tous les plannings en parallèle
        const promises = uniqueUserIds.map(userId =>
          getDoc(doc(db, 'generated_plannings', userId)).then(doc => ({
            userId,
            assignments: doc.exists() ? (doc.data() as GeneratedPlanning).assignments : {}
          }))
        );

        const results = await Promise.all(promises);

        // Organiser les résultats
        const assignments = results.reduce((acc, { userId, assignments }) => {
          acc[userId] = assignments;
          return acc;
        }, {} as Record<string, Record<string, ShiftAssignment>>);

        setUserAssignments(assignments);
      } catch (error) {
        console.error('Error loading assignments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAssignments();
  }, [exchanges]);

  return {
    userAssignments,
    loading
  };
};

export default useUserAssignments;