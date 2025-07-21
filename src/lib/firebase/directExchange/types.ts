import { Timestamp } from 'firebase/firestore';
import { DirectExchangeHistory, OperationType, ShiftExchange, ShiftPeriod } from '../../../types/exchange';
import { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';

// Collections
export const COLLECTIONS = {
  DIRECT_EXCHANGES: 'direct_exchanges',
  DIRECT_REPLACEMENTS: 'remplacements', // Utiliser 'remplacements' au lieu de 'direct_replacements'
  DIRECT_HISTORY: 'direct_exchange_history',
  DIRECT_PROPOSALS: 'direct_exchange_proposals',
  GENERATED_PLANNINGS: 'generated_plannings' // Nom plus clair et cohérent avec collectionUtils.ts
};

// Type commun pour les données d'échange
export type ExchangeData = Omit<ShiftExchange, 'id' | 'createdAt' | 'exchangeType' | 'operationType'>;

// Interface pour les propositions d'échange
export interface DirectExchangeProposal {
  id?: string;
  targetExchangeId: string;        // ID de l'échange cible
  targetUserId: string;            // ID de l'utilisateur qui a proposé la garde initialement
  proposingUserId: string;         // ID de l'utilisateur qui propose l'échange/reprise
  proposalType: 'take' | 'exchange' | 'both' | 'replacement' | 'all' | 'take_replacement' | 'exchange_replacement'; // Type de proposition étendu
  isCombinedProposal?: boolean;      // Indique si la proposition combine plusieurs types
  includesReplacement?: boolean;     // Indique si la proposition inclut un remplacement
  targetShift: {                   // Garde ciblée
    date: string;
    period: ShiftPeriod;      // Utilisation de l'enum ShiftPeriod
    shiftType: string;
    timeSlot: string;
  };
  proposedShifts: Array<{         // Gardes proposées en échange (vide pour une reprise)
    date: string;
    period: ShiftPeriod;      // Utilisation de l'enum ShiftPeriod
    shiftType: string;
    timeSlot: string;
  }>;
  comment: string;                // Commentaire de l'utilisateur proposant
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: Timestamp;
  lastModified?: Timestamp;
}
