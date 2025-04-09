import { Timestamp } from 'firebase/firestore';
import { DirectExchangeHistory, OperationType, ShiftExchange, ShiftPeriod } from '../../types/exchange';
import { ShiftExchange as PlanningShiftExchange } from '../../types/planning';

// Réexporter OperationType pour l'utiliser dans les composants
export type { OperationType } from '../../types/exchange';

/**
 * Collections Firestore pour les échanges directs
 */
export const DIRECT_EXCHANGE_COLLECTIONS = {
  DIRECT_EXCHANGES: 'direct_exchanges',
  DIRECT_REPLACEMENTS: 'remplacements', // Utiliser 'remplacements' au lieu de 'direct_replacements'
  DIRECT_HISTORY: 'direct_exchange_history',
  DIRECT_PROPOSALS: 'direct_exchange_proposals',
  PLANNINGS: 'generated_plannings'
};

/**
 * Type commun pour les données d'échange
 */
export type ExchangeData = Omit<ShiftExchange, 'id' | 'createdAt' | 'exchangeType' | 'operationType'>;

/**
 * Types de proposition d'échange
 */
export type ProposalType = 
  | 'take'                  // Reprise simple
  | 'exchange'              // Échange simple
  | 'both'                  // Reprise ET échange
  | 'replacement'           // Remplacement
  | 'all'                   // Tous les types
  | 'take_replacement'      // Reprise avec remplacement
  | 'exchange_replacement'; // Échange avec remplacement

/**
 * Statut d'une proposition d'échange
 */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Interface pour les propositions d'échange
 */
export interface DirectExchangeProposal {
  id?: string;
  targetExchangeId: string;        // ID de l'échange cible
  targetUserId: string;            // ID de l'utilisateur qui a proposé la garde initialement
  proposingUserId: string;         // ID de l'utilisateur qui propose l'échange/reprise
  proposalType: ProposalType;      // Type de proposition
  isCombinedProposal?: boolean;    // Indique si la proposition combine plusieurs types
  includesReplacement?: boolean;   // Indique si la proposition inclut un remplacement
  targetShift: {                   // Garde ciblée
    date: string;
    period: ShiftPeriod;           // Utilisation de l'enum ShiftPeriod
    shiftType: string;
    timeSlot: string;
  };
  proposedShifts: Array<{          // Gardes proposées en échange (vide pour une reprise)
    date: string;
    period: ShiftPeriod;           // Utilisation de l'enum ShiftPeriod
    shiftType: string;
    timeSlot: string;
  }>;
  comment: string;                 // Commentaire de l'utilisateur proposant
  status: ProposalStatus;          // Statut de la proposition
  createdAt?: Timestamp;
  lastModified?: Timestamp;
}
