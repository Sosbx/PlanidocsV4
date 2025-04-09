import { useState, useEffect, useMemo } from 'react';
import type { ShiftExchange, ShiftAssignment } from '../../../types/planning';
import { useAuth } from '../../useAuth';
import useConflictCheck from '../../useConflictCheck';

/**
 * Hook pour détecter les conflits entre les gardes
 * Séparé pour une meilleure séparation des préoccupations
 */
export function useExchangeConflicts(
  exchanges: ShiftExchange[],
  userAssignments: Record<string, ShiftAssignment>
) {
  const { user } = useAuth();
  const { checkForConflict } = useConflictCheck();
  
  // États des conflits
  const [conflictStates, setConflictStates] = useState<Record<string, boolean>>({});
  const [conflictDetails, setConflictDetails] = useState<Record<string, {
    date: string;
    period: string;
    shiftType: string;
  }>>({});

  // Effet pour vérifier les conflits
  useEffect(() => {
    if (!user || exchanges.length === 0) return;

    // Vérifier les conflits pour les échanges intéressés
    const interestedExchanges = exchanges.filter(e => 
      e.interestedUsers?.includes(user.id)
    );
    
    Promise.all(
      interestedExchanges.map(async exchange => {
        const result = await checkForConflict(exchange);
        return { 
          id: exchange.id, 
          hasConflict: result.hasConflict,
          conflictDetails: result.conflictDetails,
          key: `${exchange.date}-${exchange.period}`
        };
      })
    ).then(results => {
      const newConflictStates: Record<string, boolean> = {};
      const newConflictDetails: Record<string, {
        date: string;
        period: string;
        shiftType: string;
      }> = {};
      
      results.forEach(({ id, hasConflict, conflictDetails, key }) => {
        newConflictStates[id] = hasConflict;
        if (hasConflict && conflictDetails) {
          newConflictDetails[key] = conflictDetails;
        }
      });
      
      setConflictStates(newConflictStates);
      setConflictDetails(newConflictDetails);
    });
  }, [exchanges, user, checkForConflict]);

  // Créer la map des périodes intéressées pour le planning flottant
  const interestedPeriodsMap = useMemo(() => {
    const periodsMap: Record<string, boolean> = {};
    exchanges.forEach(exchange => {
      if (exchange.interestedUsers?.includes(user?.id || '')) {
        const key = `${exchange.date}-${exchange.period}`;
        periodsMap[key] = true;
      }
    });
    return periodsMap;
  }, [exchanges, user?.id]);

  // Créer la map des périodes en conflit pour le planning flottant
  const conflictPeriodsMap = useMemo(() => {
    const periodsMap: Record<string, boolean> = {};
    exchanges.forEach(exchange => {
      if (exchange.interestedUsers?.includes(user?.id || '') && conflictStates[exchange.id]) {
        const key = `${exchange.date}-${exchange.period}`;
        periodsMap[key] = true;
      }
    });
    return periodsMap;
  }, [exchanges, user?.id, conflictStates]);

  return {
    conflictStates,
    conflictDetails,
    interestedPeriodsMap,
    conflictPeriodsMap
  };
}
