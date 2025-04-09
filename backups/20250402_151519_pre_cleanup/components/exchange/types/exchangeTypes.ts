import { ShiftExchange } from '../../../types/exchange';
import { ShiftAssignment } from '../../../types/planning';
import { User } from '../../../types/users';
import { DirectExchangeProposal } from '../../../lib/firebase/directExchange/types';

/**
 * Types d'opérations disponibles pour les propositions d'échange
 */
export type OperationType = 'take' | 'exchange' | 'both';

// Interface ProposalState supprimée
// Type ProposalAction supprimé

/**
 * État des opérations sélectionnées
 */
export interface SelectedOperations {
  take: boolean;
  exchange: boolean;
}

/**
 * Garde formatée pour l'affichage dans le sélecteur
 */
export interface FormattedShift {
  key: string;
  originalKey: string;
  assignment: ShiftAssignment & {
    period: 'M' | 'AM' | 'S';
    tempUniqueId: string;
  };
}

// Interface ProposedExchangeModalProps supprimée

/**
 * Props pour le composant ExchangeModalHeader
 */
export interface ExchangeModalHeaderProps {
  exchange: ShiftExchange;
  exchangeUser?: User;
  formattedDate: string;
}

/**
 * Props pour le composant ExchangeModalOperationTypes
 */
export interface ExchangeModalOperationTypesProps {
  availableOperationTypes: ('take' | 'exchange')[];
  selectedOperations: SelectedOperations;
  setSelectedOperations: React.Dispatch<React.SetStateAction<SelectedOperations>>;
  updateOperationType: (type: 'take' | 'exchange', value?: boolean) => void;
  hasExistingProposal: boolean;
}

/**
 * Props pour le composant ExchangeModalShiftSelector
 */
export interface ExchangeModalShiftSelectorProps {
  userShiftsForExchange: FormattedShift[];
  selectedUserShifts: string[];
  toggleShiftSelection: (key: string | null, newSelection?: string[]) => void;
  hasExistingProposal: boolean;
}

/**
 * Props pour le composant ExchangeModalCommentField
 */
export interface ExchangeModalCommentFieldProps {
  comment: string;
  setComment: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Props pour le composant ExchangeModalFooter
 */
export interface ExchangeModalFooterProps {
  onClose: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  selectedOperations: SelectedOperations;
  selectedUserShifts: string[];
  hasExistingProposal: boolean;
  isOwner: boolean;
}

/**
 * Résultat de la correspondance de gardes
 */
export interface ShiftMatchingResult {
  matchedKeys: string[];
  matchDetails: {
    proposedShift: {
      date: string;
      period: string;
      shiftType: string;
      timeSlot: string;
    };
    matchedKey: string;
    score: number;
    matchType: 'exact' | 'partial' | 'none';
  }[];
}

// Interface UseExchangeProposalResult supprimée
