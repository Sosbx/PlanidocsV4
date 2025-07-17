import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { batchLoadUsersPlannings, preloadPeriodMetadata } from '../../../lib/firebase/planning/batchOperations';
import type { GeneratedPlanning, ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';

interface UseOptimizedPlanningsOptions {
  users: User[];
  includeArchived?: boolean;
  associationId?: string;
}

interface UseOptimizedPlanningsReturn {
  plannings: Record<string, Record<string, GeneratedPlanning>>;
  isLoading: boolean;
  error: string | null;
  refreshPlannings: () => Promise<void>;
  metadata: {
    activePeriods: string[];
    archivedQuarters: string[];
    totalUsers: number;
  } | null;
}

// Cache global pour stocker les plannings entre les re-renders
const planningsCache = new Map<string, {
  data: Record<string, Record<string, GeneratedPlanning>>;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useOptimizedPlannings = ({
  users,
  includeArchived = false,
  associationId = 'RD'
}: UseOptimizedPlanningsOptions): UseOptimizedPlanningsReturn => {
  const [plannings, setPlannings] = useState<Record<string, Record<string, GeneratedPlanning>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    activePeriods: string[];
    archivedQuarters: string[];
    totalUsers: number;
  } | null>(null);

  // Utiliser un ref pour éviter les re-fetches inutiles
  const loadingRef = useRef(false);
  const lastUserIdsRef = useRef<string>('');

  // Générer une clé de cache basée sur les utilisateurs et options
  const cacheKey = useMemo(() => {
    const userIds = users.map(u => u.id).sort().join(',');
    return `${associationId}_${userIds}_${includeArchived}`;
  }, [users, associationId, includeArchived]);

  // Vérifier si les utilisateurs ont changé
  const currentUserIds = users.map(u => u.id).sort().join(',');
  const usersChanged = currentUserIds !== lastUserIdsRef.current;

  const loadPlannings = useCallback(async (forceRefresh = false) => {
    // Éviter les chargements multiples simultanés
    if (loadingRef.current && !forceRefresh) return;
    
    // Vérifier le cache
    if (!forceRefresh) {
      const cached = planningsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setPlannings(cached.data);
        setIsLoading(false);
        return;
      }
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Charger les métadonnées en parallèle
      const [metadataResult, planningsResult] = await Promise.all([
        preloadPeriodMetadata(associationId),
        batchLoadUsersPlannings({
          userIds: users.map(u => u.id),
          includeArchived,
          associationId
        })
      ]);

      setMetadata(metadataResult);
      setPlannings(planningsResult);

      // Mettre en cache
      planningsCache.set(cacheKey, {
        data: planningsResult,
        timestamp: Date.now()
      });

      // Nettoyer le cache ancien (garder seulement les 10 dernières entrées)
      if (planningsCache.size > 10) {
        const entries = Array.from(planningsCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < entries.length - 10; i++) {
          planningsCache.delete(entries[i][0]);
        }
      }
    } catch (err) {
      console.error('Error loading plannings:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des plannings');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [users, includeArchived, associationId, cacheKey]);

  // Charger les plannings au montage ou quand les dépendances changent
  useEffect(() => {
    if (users.length > 0) {
      // Si les utilisateurs ont changé, forcer le rechargement
      if (usersChanged) {
        lastUserIdsRef.current = currentUserIds;
        loadPlannings(true);
      } else {
        loadPlannings();
      }
    } else {
      setIsLoading(false);
    }
  }, [users, loadPlannings, usersChanged, currentUserIds]);

  const refreshPlannings = useCallback(async () => {
    await loadPlannings(true);
  }, [loadPlannings]);

  return {
    plannings,
    isLoading,
    error,
    refreshPlannings,
    metadata
  };
};

/**
 * Hook pour obtenir les assignments d'un utilisateur spécifique avec memoization
 */
export const useUserAssignments = (
  userId: string | null,
  plannings: Record<string, Record<string, GeneratedPlanning>>
): Record<string, ShiftAssignment> => {
  return useMemo(() => {
    if (!userId || Object.keys(plannings).length === 0) {
      return {};
    }

    const combinedAssignments: Record<string, ShiftAssignment> = {};
    
    Object.values(plannings).forEach(periodPlannings => {
      if (periodPlannings[userId]) {
        const assignments = periodPlannings[userId].assignments;
        if (assignments) {
          Object.entries(assignments).forEach(([key, assignment]) => {
            combinedAssignments[key] = assignment;
          });
        }
      }
    });
    
    return combinedAssignments;
  }, [userId, plannings]);
};

/**
 * Hook pour obtenir les statistiques de plannings avec memoization
 */
export const usePlanningStats = (
  plannings: Record<string, Record<string, GeneratedPlanning>>
) => {
  return useMemo(() => {
    let totalAssignments = 0;
    const totalPeriods = Object.keys(plannings).length;
    let totalUsers = 0;
    const userSet = new Set<string>();

    Object.values(plannings).forEach(periodPlannings => {
      Object.entries(periodPlannings).forEach(([userId, planning]) => {
        userSet.add(userId);
        if (planning.assignments) {
          totalAssignments += Object.keys(planning.assignments).length;
        }
      });
    });

    totalUsers = userSet.size;

    return {
      totalAssignments,
      totalPeriods,
      totalUsers,
      averageAssignmentsPerUser: totalUsers > 0 ? Math.round(totalAssignments / totalUsers) : 0
    };
  }, [plannings]);
};