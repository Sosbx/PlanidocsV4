/**
 * API de planification
 * Exporte toutes les fonctions liées à la planification
 */

// Importation des fonctions depuis Firebase
import { saveGeneratedPlanning, deletePlanning } from '../../lib/firebase/planning';
import { validateBagPlanning, setNextPlanningPeriod, isDateInBagPeriod } from '../../lib/firebase/planningValidation';
import { getDesiderata, saveDesiderata, validateDesiderata } from '../../lib/firebase/desiderata';

// Ré-export des fonctions pour maintenir la compatibilité
export {
  // Plannings générés
  saveGeneratedPlanning,
  deletePlanning,
  validateBagPlanning,
  setNextPlanningPeriod,
  isDateInBagPeriod,
  
  // Desiderata
  getDesiderata,
  saveDesiderata,
  validateDesiderata
};

// Alias pour maintenir la compatibilité avec les anciens noms de fonctions
export const getGeneratedPlanning = async () => {
  // Cette fonction sera implémentée plus tard
  // Pour l'instant, elle retourne null
  return null;
};

export const updateGeneratedPlanning = saveGeneratedPlanning;
export const updateDesiderata = saveDesiderata;

// Types
export interface PlanningPeriod {
  startDate: Date;
  endDate: Date;
}

export interface PlanningConfig {
  currentPeriod: PlanningPeriod;
  futurePeriod?: PlanningPeriod;
}

// Fonctions pour la gestion des périodes de planning
export const getPlanningPeriods = async (): Promise<PlanningConfig | null> => {
  // Cette fonction sera implémentée plus tard
  // Pour l'instant, elle retourne null
  return null;
};

export const updatePlanningPeriods = async (config: PlanningConfig): Promise<void> => {
  // Cette fonction sera implémentée plus tard
  if (config.futurePeriod) {
    await setNextPlanningPeriod(config.futurePeriod.startDate, config.futurePeriod.endDate);
  }
};

interface ValidatedPlanning {
  userId: string;
  period: PlanningPeriod;
  assignments: Record<string, string>;
  validatedAt: Date;
}

export const getValidatedPlannings = async (): Promise<ValidatedPlanning[]> => {
  // Cette fonction sera implémentée plus tard
  return [];
};

// Fonctions pour la gestion de la configuration de la bourse aux gardes
export const getBagPhaseConfig = async () => {
  // Cette fonction sera implémentée plus tard
  // Pour l'instant, elle retourne un objet vide
  return {
    phase: 'submission',
    submissionDeadline: new Date(),
    isValidated: false,
    isConfigured: false
  };
};

interface BagPhaseConfig {
  phase: string;
  submissionDeadline: Date;
  isValidated: boolean;
  isConfigured: boolean;
}

export const updateBagPhaseConfig = async (_config: BagPhaseConfig): Promise<void> => {
  // Cette fonction sera implémentée plus tard
  // Pour l'instant, elle ne fait rien
};
