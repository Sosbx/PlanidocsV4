import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import type { ShiftExchange as PlanningShiftExchange, GeneratedPlanning, ShiftAssignment } from '../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange } from '../../../features/shiftExchange/types';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = PlanningShiftExchange | FeatureShiftExchange;

export const useUserAssignments = (exchanges: ShiftExchange[]) => {
  const [userAssignments, setUserAssignments] = useState<Record<string, Record<string, ShiftAssignment>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Récupérer la liste unique des utilisateurs intéressés et des propriétaires d'échanges
        const uniqueUserIds = Array.from(new Set([
          ...exchanges.map(exchange => exchange.userId),
          ...exchanges.flatMap(exchange => exchange.interestedUsers || [])
        ]));

        if (uniqueUserIds.length === 0) {
          setLoading(false);
          return;
        }

        // Charger tous les plannings en parallèle
        const promises = uniqueUserIds.map(async userId => {
          const docRef = doc(db, 'generated_plannings', userId);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            return { userId, assignments: {} };
          }
          
          const data = docSnap.data();
          let mergedAssignments: Record<string, ShiftAssignment> = {};
          
          // Utiliser uniquement la nouvelle structure (par périodes)
          if (data.periods) {
            // Parcourir toutes les périodes
            Object.values(data.periods).forEach((periodData: any) => {
              if (periodData && periodData.assignments) {
                // Fusionner les assignments de cette période
                mergedAssignments = { ...mergedAssignments, ...periodData.assignments };
              }
            });
          }
          
          return { userId, assignments: mergedAssignments };
        });

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
