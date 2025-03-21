import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { ShiftAssignment } from '../types/planning';

// Cache pour stocker les affectations
const assignmentsCache = new Map<string, Record<string, ShiftAssignment>>();

export const useShiftAssignments = (userIds: string[]) => {
  const [assignments, setAssignments] = useState<Record<string, Record<string, ShiftAssignment>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Filtrer les IDs déjà en cache
        const uncachedIds = userIds.filter(id => !assignmentsCache.has(id));

        if (uncachedIds.length > 0) {
          // Charger les données manquantes en parallèle
          const promises = uncachedIds.map(async (userId) => {
            const docRef = doc(db, 'generated_plannings', userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              assignmentsCache.set(userId, data.assignments || {});
            }
            return null;
          });

          await Promise.all(promises);
        }

        // Construire l'objet des affectations à partir du cache
        const cachedAssignments = userIds.reduce((acc, userId) => {
          const assignments = assignmentsCache.get(userId);
          if (assignments) {
            acc[userId] = assignments;
          }
          return acc;
        }, {} as Record<string, Record<string, ShiftAssignment>>);

        setAssignments(cachedAssignments);
      } catch (error) {
        console.error('Error loading assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [userIds]);

  return { assignments, loading };
};

export default useShiftAssignments;