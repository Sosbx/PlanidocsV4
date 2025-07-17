/**
 * Types consolidés pour la bourse aux gardes
 * Ce fichier unifie toutes les définitions de types pour éviter les duplications
 */

import { Timestamp } from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';

/**
 * Périodes de garde
 */
export type ShiftPeriod = 'M' | 'AM' | 'S';

export const SHIFT_PERIODS = {
  M: 'Matin',
  AM: 'Après-midi',
  S: 'Soir'
} as const;

/**
 * Statuts d'échange
 */
export type ExchangeStatus = 'pending' | 'validated' | 'cancelled' | 'unavailable';

/**
 * Types d'échange
 */
export type ExchangeType = 'bag' | 'direct';

/**
 * Types d'opération pour les échanges directs
 */
export type OperationType = 'exchange' | 'give' | 'replacement';

/**
 * Phases de la bourse aux gardes
 */
export type BagPhase = 'submission' | 'distribution' | 'completed';

/**
 * Interface principale pour un échange de garde
 * Utilisée à la fois pour la bourse aux gardes et les échanges directs
 */
export interface ShiftExchange {
  id: string;
  userId: string;
  userName?: string;
  date: string; // Format: 'YYYY-MM-DD'
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  status: ExchangeStatus;
  exchangeType?: ExchangeType;
  operationTypes: OperationType[];
  comment?: string;
  interestedUsers?: string[];
  proposedToReplacements?: boolean;
  createdAt: string | Timestamp;
  lastModified: string | Timestamp;
  updatedAt?: Timestamp;
  
  // Propriétés spécifiques aux échanges validés
  matchedWith?: string;
  matchedUserId?: string;
  matchedUserName?: string;
  matchedDate?: string;
  matchedPeriod?: string;
  matchedShiftType?: string;
  matchedTimeSlot?: string;
}

/**
 * Interface pour l'historique des échanges
 */
export interface ExchangeHistory {
  id: string;
  originalUserId: string;
  newUserId: string;
  date: string;
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  exchangedAt: string | Timestamp;
  comment?: string;
  validatedBy?: string;
  interestedUsers?: string[];
  isPermutation: boolean;
  originalShiftType: string;
  newShiftType: string | null;
  status: 'completed';
  createdAt?: string | Timestamp;
  originalExchangeId?: string;
  originalUserPeriodId?: string | null;
  interestedUserPeriodId?: string | null;
}

/**
 * Configuration de la phase de bourse aux gardes
 */
export interface BagPhaseConfig {
  phase: BagPhase;
  submissionDeadline: Date;
  isConfigured: boolean;
  isValidated?: boolean;
  validatedAt?: Date;
  nextPlanningStartDate?: Date;
}

/**
 * Configuration par défaut
 */
export const defaultBagPhaseConfig: BagPhaseConfig = {
  phase: 'submission',
  submissionDeadline: createParisDate(),
  isConfigured: false,
  isValidated: false
};

/**
 * Interface pour une assignation de garde
 */
export interface ShiftAssignment {
  type: ShiftPeriod;
  date: string;
  timeSlot: string;
  shiftType: string;
  site?: string;
  period?: ShiftPeriod; // Pour compatibilité
}

/**
 * Interface pour les statistiques
 */
export interface ExchangeStats {
  totalExchanges: number;
  pendingExchanges: number;
  completedExchanges: number;
  userParticipation: Record<string, number>;
  exchangesByPeriod: Record<ShiftPeriod, number>;
  exchangesByMonth: Record<string, number>;
}

/**
 * Interface pour les conflits
 */
export interface ConflictInfo {
  hasConflict: boolean;
  shiftType?: string;
  date?: string;
  period?: ShiftPeriod;
  userId?: string;
}

/**
 * Type guards pour la validation des types
 */
export const isShiftExchange = (obj: any): obj is ShiftExchange => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.date === 'string' &&
    ['M', 'AM', 'S'].includes(obj.period) &&
    typeof obj.shiftType === 'string'
  );
};

export const isExchangeHistory = (obj: any): obj is ExchangeHistory => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.originalUserId === 'string' &&
    typeof obj.newUserId === 'string' &&
    obj.status === 'completed'
  );
};

/**
 * Helpers pour la conversion des timestamps
 */
export const timestampToString = (timestamp: Timestamp | string): string => {
  if (typeof timestamp === 'string') return timestamp;
  return firebaseTimestampToParisDate(timestamp).toISOString();
};

export const stringToTimestamp = (str: string): Timestamp => {
  return Timestamp.fromDate(new Date(str));
};