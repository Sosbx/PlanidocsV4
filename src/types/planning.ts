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
}

export const defaultBagPhaseConfig: BagPhaseConfig = {
  phase: 'submission',
  submissionDeadline: new Date(),
  isConfigured: false
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
  status: 'completed' | 'reverted';
  createdAt?: string;
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
}

export interface GeneratedPlanning {
  assignments: Record<string, ShiftAssignment>;  // Clé au format "YYYY-MM-DD-PERIOD"
  uploadedAt: Date;
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