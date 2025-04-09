import { Timestamp } from 'firebase/firestore';

/**
 * Types pour la fonctionnalité de bourse aux gardes
 */

/**
 * Phases de la bourse aux gardes
 */
export enum BagPhase {
  CLOSED = 'closed',
  SUBMISSION = 'submission',
  MATCHING = 'matching',
  VALIDATION = 'validation',
  COMPLETED = 'completed'
}

/**
 * Type d'échange dans la bourse aux gardes
 */
export enum ShiftExchangeType {
  GIVE = 'give',
  TAKE = 'take',
  EXCHANGE = 'exchange'
}

/**
 * Statut d'un échange dans la bourse aux gardes
 */
export enum ShiftExchangeStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  VALIDATED = 'validated',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

/**
 * Période de garde
 */
export enum ShiftPeriod {
  MORNING = 'M',
  AFTERNOON = 'AM',
  EVENING = 'S'
}

/**
 * Interface pour un échange dans la bourse aux gardes
 */
export interface ShiftExchange {
  id: string;  // Rendu obligatoire pour la compatibilité avec les fonctions Firebase
  userId: string;
  userName?: string;
  date: string;
  period: 'M' | 'AM' | 'S';  // Rendu compatible avec l'ancienne définition
  shiftType: string;
  timeSlot: string;
  exchangeType?: ShiftExchangeType | 'bag' | 'direct';  // Rendu optionnel pour la compatibilité avec l'ancienne définition
  status: 'pending' | 'validated' | 'cancelled' | 'unavailable';  // Rendu compatible avec l'ancienne définition
  comment?: string;
  matchedWith?: string;
  matchedUserId?: string;
  matchedUserName?: string;
  matchedDate?: string;
  matchedPeriod?: string;
  matchedShiftType?: string;
  matchedTimeSlot?: string;
  createdAt: string;  // Rendu compatible avec l'ancienne définition
  updatedAt?: Timestamp;
  // Propriétés supplémentaires pour la compatibilité avec le code existant
  interestedUsers?: string[];
  lastModified: string;  // Rendu obligatoire pour la compatibilité avec l'ancienne définition
  proposedToReplacements?: boolean;
  // Propriétés ajoutées pour la compatibilité avec le composant GeneratedPlanningTable
  operationTypes: string[]; // Source unique de vérité pour les types d'opérations
}

/**
 * Interface pour l'historique des échanges
 */
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
  status: 'completed'; // Modifié pour être compatible avec /src/types/planning.ts
  createdAt?: string;
  originalExchangeId?: string; // ID de l'échange d'origine avant validation
}

/**
 * Interface pour une phase de la bourse aux gardes
 */
export interface BagPhaseInfo {
  id?: string;
  phase: BagPhase;
  startDate: Timestamp;
  endDate: Timestamp;
  periodId: string;
  periodName: string;
}

/**
 * Interface pour une assignation de garde
 */
export interface ShiftAssignment {
  type: 'M' | 'AM' | 'S';  // Matin, Après-midi, Soir
  date: string;
  timeSlot: string;
  shiftType: string;
  site?: string;
  period?: 'M' | 'AM' | 'S'; // Ajouté pour compatibilité
}

/**
 * Configuration de la phase de bourse aux gardes
 */
export interface BagPhaseConfig {
  phase: 'submission' | 'distribution' | 'completed';
  submissionDeadline: Date;
  isConfigured: boolean;
  isValidated?: boolean;
  validatedAt?: Date;
  nextPlanningStartDate?: Date;
}

/**
 * Configuration par défaut de la phase de bourse aux gardes
 */
export const defaultBagPhaseConfig: BagPhaseConfig = {
  phase: 'submission',
  submissionDeadline: new Date(),
  isConfigured: false,
  isValidated: false
};
