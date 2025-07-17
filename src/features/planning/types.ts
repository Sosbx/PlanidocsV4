import { createParisDate } from '@/utils/timezoneUtils';

/**
 * Types pour le module de planning
 */

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
  isValidated?: boolean;
  validatedAt?: Date;
  nextPlanningStartDate?: Date;
}

export const defaultBagPhaseConfig: BagPhaseConfig = {
  phase: 'submission',
  submissionDeadline: createParisDate(),
  isConfigured: false,
  isValidated: false
};

export interface ShiftAssignment {
  type: 'M' | 'AM' | 'S';
  date: string;
  timeSlot: string;
  shiftType: string;
  site?: string;
  period?: 'M' | 'AM' | 'S';
}

export interface PeriodSelection {
  type: 'primary' | 'secondary' | null;
  comment?: string;
}

export type Selections = Record<string, PeriodSelection>;

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
}

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
  comment?: string;
  lastModified?: string;
}

export interface GeneratedPlanning {
  assignments: Record<string, ShiftAssignment>;
  uploadedAt: Date | { toDate: () => Date };
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

export const defaultConfig: PlanningConfig = {
  startDate: createParisDate(),
  endDate: createParisDate(),
  deadline: createParisDate(),
  primaryDesiderataLimit: 0,
  secondaryDesiderataLimit: 0,
  isConfigured: false,
};

export type ExchangeType = 'simple' | 'permutation';

export interface ExchangeValidationError extends Error {
  code: 'GUARD_NOT_FOUND' | 'GUARD_ALREADY_EXCHANGED' | 'USER_HAS_GUARD' | 'INVALID_EXCHANGE' | 'EXCHANGE_UNAVAILABLE';
  details?: any;
}
