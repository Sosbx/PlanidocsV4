export interface PlanningConfig {
  startDate: Date;
  endDate: Date;
  deadline: Date;
  primaryDesiderataLimit: number;
  secondaryDesiderataLimit: number;
  isConfigured: boolean;
}

export interface BagPhaseConfig {
  phase: 'submission' | 'distribution' | 'completed';
  submissionDeadline: Date;
  isConfigured: boolean;
  isValidated?: boolean; // Nouveau champ pour indiquer si le planning a été validé
  validatedAt?: Date;   // Date de validation du planning
  nextPlanningStartDate?: Date; // Date de début du prochain planning
}

export const defaultBagPhaseConfig: BagPhaseConfig = {
  phase: 'submission',
  submissionDeadline: new Date(),
  isConfigured: false,
  isValidated: false
};

export interface ShiftExchange {
  id: string;
  userId: string;
  date: string;
  period: 'M' | 'AM' | 'S';
  shiftType: string;
  timeSlot: string;
  comment?: string;
  createdAt: string;
  interestedUsers?: string[];
  status: 'pending' | 'validated' | 'cancelled' | 'unavailable';
  lastModified: string;
  proposedToReplacements?: boolean;
  // Propriétés ajoutées pour la compatibilité avec le composant GeneratedPlanningTable
  exchangeType?: 'bag' | 'direct';
  operationTypes: string[]; // Source unique de vérité pour les types d'opérations
}

export interface ExchangeHistory {
  id: string;
  originalUserId: string;
  newUserId: string;
  date: string;
  period: string;
  shiftType: string;
  timeSlot: string;
  exchangedAt: string;
  comment?: string;
  validatedBy?: string;
  interestedUsers?: string[];
  isPermutation: boolean;
  originalShiftType: string;
  newShiftType: string | null;
  status: 'completed'; // Plus de status 'reverted' car on supprime ces entrées
  createdAt?: string;
  originalExchangeId?: string; // ID de l'échange d'origine avant validation
  originalUserPeriodId?: string | null; // ID de la période d'origine pour l'utilisateur original
  interestedUserPeriodId?: string | null; // ID de la période d'origine pour l'utilisateur intéressé
}

export interface ExchangeValidationError extends Error {
  code: 'GUARD_NOT_FOUND' | 'GUARD_ALREADY_EXCHANGED' | 'USER_HAS_GUARD' | 'INVALID_EXCHANGE' | 'EXCHANGE_UNAVAILABLE';
  details?: any;
}

export type ExchangeType = 'simple' | 'permutation';

export interface ShiftAssignment {
  type: 'M' | 'AM' | 'S';  // Matin, Après-midi, Soir
  date: string;
  timeSlot: string;
  shiftType: string;
  site?: string;
  period?: 'M' | 'AM' | 'S'; // Ajouté pour compatibilité
  status?: 'active' | 'archived'; // Statut de la garde (actif ou archivé)
}

export interface PlanningPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'future' | 'archived';
  bagPhase?: 'submission' | 'distribution' | 'completed';
  isValidated?: boolean;
  validatedAt?: Date;
}

export interface PlanningPeriodData {
  assignments: Record<string, ShiftAssignment>;
  uploadedAt: Date | { toDate: () => Date };
  isArchived?: boolean; // Indique si cette période contient des gardes archivées
}

export interface GeneratedPlanning {
  periodId?: string; // ID de la période associée (ancienne structure)
  /** @deprecated Utiliser periods à la place - Maintenu pour compatibilité */
  assignments?: Record<string, ShiftAssignment>;  // Clé au format "YYYY-MM-DD-PERIOD" (ancienne structure)
  periods: Record<string, PlanningPeriodData>; // Nouvelle structure avec périodes
  uploadedAt: Date | { toDate: () => Date };  // Peut être un Date ou un Timestamp Firestore
}

export interface PeriodSelection {
  type: 'primary' | 'secondary' | null;
  comment?: string;
}

export type Selections = Record<string, PeriodSelection>;

export const defaultConfig: PlanningConfig = {
  startDate: new Date(),
  endDate: new Date(),
  deadline: new Date(),
  primaryDesiderataLimit: 0,
  secondaryDesiderataLimit: 0,
  isConfigured: false,
};

export interface ShiftReplacement {
  id: string;
  exchangeId: string;
  date: string;
  period: 'M' | 'AM' | 'S';
  shiftType: string;
  timeSlot: string;
  originalUserId: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'cancelled';
  notifiedUsers: string[];
}
