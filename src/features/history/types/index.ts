import { ExchangeHistory } from '../../../types/planning';
import { DirectExchange } from '../../directExchange/types';
import { Timestamp } from 'firebase/firestore';

export interface HistoryFilters {
  startDate: Date | null;
  endDate: Date | null;
  searchTerm: string;
  type?: string;
  status?: string;
}

export interface ReplacementHistory {
  id: string;
  userId: string;
  replacementUserId: string;
  date: string;
  period: 'M' | 'AM' | 'S';
  shiftType: string;
  timeSlot: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  associationId: string;
  reason?: string;
}

export interface UnifiedHistoryEntry {
  id: string;
  type: 'bag' | 'direct_exchange' | 'replacement';
  date: string;
  period: 'M' | 'AM' | 'S';
  shiftType: string;
  timeSlot: string;
  status: string;
  otherUser?: {
    id: string;
    name: string;
  };
  operation: 'give' | 'take' | 'exchange' | 'permutation' | 'replacement';
  createdAt: Date;
  completedAt?: Date;
  details?: string;
}

export type HistoryTab = 'exchanges' | 'bag' | 'replacements';