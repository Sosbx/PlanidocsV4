import { ShiftAssignment } from './planning';

/**
 * Enum définissant les périodes standards de garde
 */
export enum ShiftPeriod {
  MORNING = 'M',
  AFTERNOON = 'AM',
  EVENING = 'S'
}

export type ExchangeType = 'bag' | 'direct';
export type OperationType = 'exchange' | 'give' | 'replacement' | 'both';
export type ExchangeStatus = 'pending' | 'validated' | 'cancelled' | 'unavailable' | 'matched' | 'rejected';

export interface BaseExchange {
  id: string;
  userId: string;
  date: string;
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  comment?: string;
  createdAt: string;
  lastModified: string;
}

export interface ShiftExchange extends BaseExchange {
  exchangeType: ExchangeType;
  operationTypes: OperationType[]; // Liste des types d'opérations sélectionnés (source unique de vérité)
  operationType?: OperationType; // Propriété legacy pour compatibilité avec le code existant
  interestedUsers?: string[];
  proposedToReplacements?: boolean;
  hasProposals?: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  status: ExchangeStatus;
}

export interface BagExchangeHistory extends BaseExchange {
  originalUserId: string;
  newUserId: string;
  exchangedAt: string;
  validatedBy?: string;
  interestedUsers?: string[];
  isPermutation: boolean;
  originalShiftType: string;
  newShiftType: string | null;
  status: 'completed' | 'reverted';
}

export interface DirectExchangeHistory extends BaseExchange {
  originalUserId: string;
  newUserId: string;
  exchangedAt: string;
  operationTypes: OperationType[];
  status: 'completed' | 'reverted';
}

export interface ExchangeFilters {
  showOwnShifts: boolean;
  showMyInterests: boolean;
  showDesiderata: boolean;
  hidePrimaryDesiderata: boolean;
  hideSecondaryDesiderata: boolean;
  filterPeriod: 'all' | ShiftPeriod.MORNING | ShiftPeriod.AFTERNOON | ShiftPeriod.EVENING;
}

export interface ExchangeValidationError extends Error {
  code: 'GUARD_NOT_FOUND' | 'GUARD_ALREADY_EXCHANGED' | 'USER_HAS_GUARD' | 'INVALID_EXCHANGE' | 'EXCHANGE_UNAVAILABLE';
  details?: any;
}
