import { Timestamp } from 'firebase/firestore';
import type { ShiftExchange as PlanningShiftExchange, ExchangeHistory as PlanningExchangeHistory, ExchangeValidationError, ExchangeType, ShiftAssignment as PlanningShiftAssignment } from '../../../types/planning';
import type { ShiftExchange as FeatureShiftExchange, ExchangeHistory as FeatureExchangeHistory, ShiftAssignment as FeatureShiftAssignment } from '../../../features/shiftExchange/types';

// Type union pour accepter les deux types de ShiftExchange
export type ShiftExchange = FeatureShiftExchange | PlanningShiftExchange;

// Type union pour accepter les deux types de ExchangeHistory
export type ExchangeHistory = FeatureExchangeHistory | PlanningExchangeHistory;

// Type union pour accepter les deux types de ShiftAssignment
export type ShiftAssignment = PlanningShiftAssignment | FeatureShiftAssignment;

// Constantes
export const COLLECTIONS = {
  EXCHANGES: 'shift_exchanges',
  HISTORY: 'exchange_history',
  PLANNINGS: 'generated_plannings'
} as const;

// Type pour les erreurs de validation
export { ExchangeValidationError, ExchangeType };

/**
 * Crée une erreur de validation d'échange
 * @param code Code d'erreur
 * @param message Message d'erreur
 * @param details Détails supplémentaires
 * @returns Erreur de validation
 */
export const createExchangeValidationError = (
  code: ExchangeValidationError['code'], 
  message: string, 
  details?: Record<string, unknown>
): ExchangeValidationError => {
  const error = new Error(message) as ExchangeValidationError;
  error.code = code;
  error.details = details;
  return error;
};

// Types pour le cache
export interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
}

// Type pour les résultats de vérification de planning
export interface PlanningVerificationResult {
  hasAssignment: boolean;
  assignment?: ShiftAssignment;
  planning: Record<string, any>;
}

// Type pour les résultats de vérification de conflit
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictDetails?: {
    date: string;
    period: string;
    shiftType: string;
  };
}
