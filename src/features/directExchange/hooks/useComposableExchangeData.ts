import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../auth/hooks';
import { useDirectExchangeData } from './useDirectExchangeData';
import type { User } from '../../users/types';
import { getGeneratedPlanning, subscribeToUserPlanning } from '../../../lib/firebase/planning';
import { usePlanningPeriod } from '../../../context/planning/PlanningPeriodContext';
import { useBagPhase } from '../../../context/shiftExchange';

interface UseComposableExchangeDataOptions {
  startDate?: Date;
  endDate?: Date;
  filterByUser?: string;
  filterByStatus?: string;
  setToast?: (toast: { visible: boolean; message: string; type: string }) => void;
}

/**
 * Hook pour composer les données d'échanges directs
 * Combine les données d'échanges avec les assignations utilisateur et calcule les états de conflit
 */
export const useComposableExchangeData = (
  users: User[],
  options: UseComposableExchangeDataOptions = {}
) => {
  const { user } = useAuth();
  const { isInBagPeriod, isBagActive, allPeriods } = usePlanningPeriod();
  const { config: bagPhaseConfig } = useBagPhase();
  const [userAssignments, setUserAssignments] = useState<Record<string, any>>({});
  const [conflictStates, setConflictStates] = useState<Record<string, string>>({});
  const [conflictPeriodsMap, setConflictPeriodsMap] = useState<Record<string, string[]>>({});
  const [interestedPeriodsMap, setInterestedPeriodsMap] = useState<Record<string, string[]>>({});
  const [receivedShifts, setReceivedShifts] = useState<any[]>([]);

  // Utiliser le hook useDirectExchangeData pour obtenir les données de base
  const { 
    directExchanges,
    receivedProposals,
    userProposals,
    loading
  } = useDirectExchangeData(userAssignments);

  // Référence pour la fonction d'annulation de souscription
  const unsubscribePlanningRef = useRef<(() => void) | null>(null);
  
  // Charger les assignations utilisateur et s'abonner aux mises à jour en temps réel
  useEffect(() => {
    if (!user) return;
    
    console.log('Mise en place de la souscription au planning de l\'utilisateur:', user.id);
    
    // Nettoyer la souscription existante
    if (unsubscribePlanningRef.current) {
      unsubscribePlanningRef.current();
      unsubscribePlanningRef.current = null;
    }
    
    // Souscrire au planning de l'utilisateur en temps réel
    const unsubscribe = subscribeToUserPlanning(user.id, (assignments) => {
      console.log('Mise à jour en temps réel des assignations utilisateur reçue');
      
      // Filtrer les gardes pour exclure celles qui font partie d'une BaG en cours
      const filteredAssignments = Object.entries(assignments).reduce((acc, [key, assignment]) => {
        // Extraire la date de la clé (format: "YYYY-MM-DD-PERIOD")
        const dateStr = key.split('-').slice(0, 3).join('-');
        const date = new Date(dateStr);
        
        // Vérifier si cette garde fait partie d'une période future (BaG en cours)
        const isFuturePeriod = allPeriods.some(period => 
          period.status === 'future' && 
          period.bagPhase !== 'completed' &&
          date >= period.startDate && 
          date <= period.endDate
        );
        
        // Si la BaG est active et que la date est dans une période future avec BaG non complétée,
        // ne pas inclure cette garde dans les échanges directs
        if (isBagActive && isFuturePeriod) {
          return acc;
        }
        
        // Sinon, inclure la garde
        acc[key] = assignment;
        return acc;
      }, {} as Record<string, any>);
      
      setUserAssignments(filteredAssignments);
    });
    
    // Stocker la fonction d'annulation
    unsubscribePlanningRef.current = unsubscribe;
    
    // Nettoyer la souscription lors du démontage
    return () => {
      if (unsubscribePlanningRef.current) {
        console.log('Nettoyage de la souscription au planning');
        unsubscribePlanningRef.current();
        unsubscribePlanningRef.current = null;
      }
    };
  }, [user, isBagActive, allPeriods]);

  // Calculer les états de conflit
  useEffect(() => {
    if (!user || !directExchanges.length) return;

    // Simuler le calcul des états de conflit
    const conflicts: Record<string, string> = {};
    const conflictPeriods: Record<string, string[]> = {};
    
    // Dans une implémentation réelle, cela analyserait les échanges pour détecter les conflits
    
    setConflictStates(conflicts);
    setConflictPeriodsMap(conflictPeriods);
  }, [user, directExchanges]);

  // Calculer les périodes intéressées
  useEffect(() => {
    if (!user || !directExchanges.length) return;

    // Simuler le calcul des périodes intéressées
    const interested: Record<string, string[]> = {};
    
    // Dans une implémentation réelle, cela analyserait les échanges pour déterminer les intérêts
    
    setInterestedPeriodsMap(interested);
  }, [user, directExchanges]);

  // Calculer les gardes reçues
  useEffect(() => {
    if (!user || !receivedProposals.length) return;

    // Transformer les propositions reçues en format attendu
    const received = receivedProposals.map(proposal => ({
      id: proposal.id,
      date: proposal.date,
      period: proposal.period,
      userId: proposal.userId,
      status: proposal.status,
      // Ajouter d'autres propriétés nécessaires
    }));
    
    setReceivedShifts(received);
  }, [user, receivedProposals]);

  return {
    userAssignments,
    conflictStates,
    conflictPeriodsMap,
    interestedPeriodsMap,
    receivedShifts,
    loading
  };
};
