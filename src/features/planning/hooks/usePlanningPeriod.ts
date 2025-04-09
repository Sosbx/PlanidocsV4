import { usePlanningPeriod as useOriginalPlanningPeriod } from '../../../context/PlanningPeriodContext';

// Type pour le contexte de période de planning
interface ContextPlanningPeriod {
  startDate: Date;
  endDate: Date;
}

/**
 * Hook pour accéder aux informations sur les périodes de planning
 * Fournit les périodes actuelles et futures, ainsi que des fonctions utilitaires
 */
export function usePlanningPeriod() {
  // Utiliser le hook original du contexte
  const {
    currentPeriod,
    futurePeriod,
    isBagActive,
    isInBagPeriod,
    isInCurrentPeriod
  } = useOriginalPlanningPeriod();
  
  return {
    /**
     * Période de planning actuelle
     */
    currentPeriod,
    
    /**
     * Période de planning future (si disponible)
     */
    futurePeriod,
    
    /**
     * Indique si la bourse aux gardes est active
     */
    isBagActive,
    
    /**
     * Vérifie si une date est dans la période de la bourse aux gardes
     */
    isInBagPeriod,
    
    /**
     * Vérifie si une date est dans la période courante
     */
    isInCurrentPeriod
  };
}

export default usePlanningPeriod;
