import { useQuery, useMutation, useQueryClient } from 'react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { GeneratedPlanning } from '../types/planning';

/**
 * Hook pour gérer le cache des données de planning avec react-query
 * Optimise le chargement et la mise à jour des données
 */
export const usePlanningCache = () => {
  const queryClient = useQueryClient();

  /**
   * Charge les plannings pour une période donnée
   * @param periodId - ID de la période
   * @returns Promise avec les plannings
   */
  const loadPlanningsByPeriod = async (periodId: string): Promise<Record<string, GeneratedPlanning>> => {
    try {
      // Simuler un délai pour montrer le chargement (à supprimer en production)
      // await new Promise(resolve => setTimeout(resolve, 500));

      // Requête Firestore optimisée pour ne charger que les plannings de la période sélectionnée
      const planningDoc = await getDoc(doc(db, 'planning_periods', periodId, 'plannings', 'all'));
      
      if (!planningDoc.exists()) {
        return {};
      }
      
      const planningsData = planningDoc.data() as Record<string, GeneratedPlanning>;
      
      // Convertir les timestamps en Date
      Object.values(planningsData).forEach(planning => {
        // Vérifier si uploadedAt est un objet Firestore Timestamp
        if (planning.uploadedAt && 
            typeof planning.uploadedAt === 'object' && 
            'toDate' in planning.uploadedAt && 
            typeof planning.uploadedAt.toDate === 'function') {
          planning.uploadedAt = planning.uploadedAt.toDate();
        } else if (!(planning.uploadedAt instanceof Date)) {
          // Si ce n'est pas un timestamp ni une Date, convertir en Date
          planning.uploadedAt = new Date(planning.uploadedAt as any);
        }
      });
      
      return planningsData;
    } catch (error) {
      console.error('Error loading plannings for period:', error);
      throw error;
    }
  };

  /**
   * Hook pour charger les plannings avec mise en cache
   * @param periodId - ID de la période
   * @returns Données de planning et état de chargement
   */
  const usePlanningsByPeriod = (periodId: string) => {
    return useQuery(
      ['plannings', periodId],
      () => loadPlanningsByPeriod(periodId),
      {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
        enabled: !!periodId // Désactiver la requête si periodId est vide
      }
    );
  };

  /**
   * Mutation pour mettre à jour un planning
   */
  const useUpdatePlanning = () => {
    return useMutation(
      async ({ userId, planning, periodId }: { userId: string; planning: GeneratedPlanning; periodId: string }) => {
        try {
          // Récupérer les plannings existants
          const planningsDoc = await getDoc(doc(db, 'planning_periods', periodId, 'plannings', 'all'));
          const plannings = planningsDoc.exists() ? planningsDoc.data() as Record<string, GeneratedPlanning> : {};
          
          // Mettre à jour le planning de l'utilisateur
          plannings[userId] = planning;
          
          // Sauvegarder les plannings mis à jour
          await setDoc(doc(db, 'planning_periods', periodId, 'plannings', 'all'), plannings);
          
          // Mettre également à jour le planning individuel de l'utilisateur
          await setDoc(doc(db, 'generated_plannings', userId), planning);
          
          return { userId, planning };
        } catch (error) {
          console.error('Error updating planning:', error);
          throw error;
        }
      },
      {
        // Invalider le cache après la mise à jour
        onSuccess: (_, { periodId }) => {
          queryClient.invalidateQueries(['plannings', periodId]);
        }
      }
    );
  };

  /**
   * Précharge les données d'une période
   * @param periodId - ID de la période à précharger
   */
  const prefetchPeriod = async (periodId: string) => {
    if (!periodId) return;
    
    await queryClient.prefetchQuery(
      ['plannings', periodId],
      () => loadPlanningsByPeriod(periodId),
      {
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    );
  };

  return {
    usePlanningsByPeriod,
    useUpdatePlanning,
    prefetchPeriod,
    loadPlanningsByPeriod
  };
};

export default usePlanningCache;
