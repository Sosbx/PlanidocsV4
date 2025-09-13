import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import type { ShiftExchange as PlanningShiftExchange, GeneratedPlanning, ShiftAssignment } from '../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange } from '../../../features/shiftExchange/types';

// Type union pour accepter les deux types de ShiftExchange
type ShiftExchange = PlanningShiftExchange | FeatureShiftExchange;

export const useUserAssignments = (exchanges: ShiftExchange[]) => {
  const [userAssignments, setUserAssignments] = useState<Record<string, Record<string, ShiftAssignment>>>({});
  const [loading, setLoading] = useState(true);
  const unsubscribesRef = useRef<Array<() => void>>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let isInitialLoad = true;

    const setupListeners = async () => {
      try {
        // Nettoyer les anciens listeners
        unsubscribesRef.current.forEach(unsub => unsub());
        unsubscribesRef.current = [];

        // Récupérer la liste unique des utilisateurs intéressés et des propriétaires d'échanges
        const uniqueUserIds = Array.from(new Set([
          ...exchanges.map(exchange => exchange.userId),
          ...exchanges.flatMap(exchange => exchange.interestedUsers || [])
        ]));

        if (uniqueUserIds.length === 0) {
          setLoading(false);
          return;
        }

        // Map pour stocker les assignments par utilisateur
        const currentAssignments: Record<string, Record<string, ShiftAssignment>> = {};

        // Créer un listener pour chaque utilisateur
        const setupPromises = uniqueUserIds.map(async (userId) => {
          const docRef = doc(db, 'generated_plannings', userId);
          
          // Charger les données initiales
          const initialDoc = await getDoc(docRef);
          if (initialDoc.exists()) {
            const data = initialDoc.data();
            let mergedAssignments: Record<string, ShiftAssignment> = {};
            
            // Utiliser uniquement la nouvelle structure (par périodes)
            if (data.periods) {
              Object.values(data.periods).forEach((periodData: any) => {
                if (periodData && periodData.assignments) {
                  mergedAssignments = { ...mergedAssignments, ...periodData.assignments };
                }
              });
            }
            
            currentAssignments[userId] = mergedAssignments;
          } else {
            currentAssignments[userId] = {};
          }

          // Créer le listener pour les mises à jour temps réel
          const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (!mountedRef.current) return;

            if (snapshot.exists()) {
              const data = snapshot.data();
              let mergedAssignments: Record<string, ShiftAssignment> = {};
              
              // Utiliser uniquement la nouvelle structure (par périodes)
              if (data.periods) {
                Object.values(data.periods).forEach((periodData: any) => {
                  if (periodData && periodData.assignments) {
                    mergedAssignments = { ...mergedAssignments, ...periodData.assignments };
                  }
                });
              }

              // Mettre à jour l'état seulement si les données ont changé
              setUserAssignments(prev => {
                const hasChanged = JSON.stringify(prev[userId]) !== JSON.stringify(mergedAssignments);
                if (hasChanged) {
                  console.log(`[useUserAssignments] Planning mis à jour pour l'utilisateur ${userId}`);
                  return {
                    ...prev,
                    [userId]: mergedAssignments
                  };
                }
                return prev;
              });
            } else {
              // Le document n'existe plus, supprimer les assignments
              setUserAssignments(prev => {
                if (prev[userId]) {
                  console.log(`[useUserAssignments] Planning supprimé pour l'utilisateur ${userId}`);
                  const newAssignments = { ...prev };
                  delete newAssignments[userId];
                  return newAssignments;
                }
                return prev;
              });
            }

            // Ne plus en chargement après la première mise à jour temps réel
            if (!isInitialLoad) {
              setLoading(false);
            }
          });

          unsubscribesRef.current.push(unsubscribe);
        });

        // Attendre que tous les listeners soient configurés
        await Promise.all(setupPromises);

        // Mettre à jour l'état initial
        if (mountedRef.current) {
          setUserAssignments(currentAssignments);
          setLoading(false);
          isInitialLoad = false;
        }
      } catch (error) {
        console.error('Error setting up assignment listeners:', error);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };
    
    setupListeners();

    // Cleanup
    return () => {
      mountedRef.current = false;
      unsubscribesRef.current.forEach(unsub => unsub());
      unsubscribesRef.current = [];
    };
  }, [exchanges]);

  return {
    userAssignments,
    loading
  };
};
