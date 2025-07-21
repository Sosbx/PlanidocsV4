import { getProposalsForExchange } from '../../../lib/firebase/directExchange';
import { firebaseTimestampToParisDate } from '../../../utils/timezoneUtils';
import { createParisDate } from '../../../utils/timezoneUtils';
import type { DirectExchangeProposal } from '../../../lib/firebase/directExchange/types';
import type { ExchangeProposal } from '../../../types/exchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

/**
 * Vérifie si un échange a des propositions et les récupère
 */
export async function checkForProposals(exchangeId: string): Promise<DirectExchangeProposal[] | null> {
  try {
    const directProposals = await getProposalsForExchange(exchangeId);
    return directProposals.length > 0 ? directProposals : null;
  } catch (error) {
    console.error('Erreur lors de la vérification des propositions:', error);
    return null;
  }
}

/**
 * Convertit une DirectExchangeProposal en ExchangeProposal
 */
export function convertToExchangeProposal(proposal: DirectExchangeProposal): ExchangeProposal {
  // Gérer les dates de manière sécurisée
  let createdAtString = createParisDate().toISOString();
  let lastModifiedString = createParisDate().toISOString();
  
  try {
    if (proposal.createdAt) {
      if (typeof proposal.createdAt === 'object' && 'toDate' in proposal.createdAt && typeof proposal.createdAt.toDate === 'function') {
        createdAtString = firebaseTimestampToParisDate(proposal.createdAt).toISOString();
      } else if (proposal.createdAt instanceof Date) {
        createdAtString = proposal.createdAt.toISOString();
      } else if (typeof proposal.createdAt === 'string') {
        createdAtString = proposal.createdAt;
      }
    }
    
    if (proposal.lastModified) {
      if (typeof proposal.lastModified === 'object' && 'toDate' in proposal.lastModified && typeof proposal.lastModified.toDate === 'function') {
        lastModifiedString = firebaseTimestampToParisDate(proposal.lastModified).toISOString();
      } else if (proposal.lastModified instanceof Date) {
        lastModifiedString = proposal.lastModified.toISOString();
      } else if (typeof proposal.lastModified === 'string') {
        lastModifiedString = proposal.lastModified;
      }
    }
  } catch (error) {
    console.error('Erreur lors de la conversion des dates:', error);
  }
  
  // S'assurer que proposedShifts est toujours un tableau
  const proposedShifts = Array.isArray(proposal.proposedShifts) ? proposal.proposedShifts : [];
  
  return {
    id: proposal.id || '',
    userId: proposal.proposingUserId,
    targetExchangeId: proposal.targetExchangeId,
    targetUserId: proposal.targetUserId,
    proposingUserId: proposal.proposingUserId,
    proposalType: proposal.proposalType || 'exchange',
    targetShift: proposal.targetShift || {
      date: '',
      period: 'M',
      shiftType: '',
      timeSlot: ''
    },
    proposedShifts: proposedShifts,
    comment: proposal.comment || '',
    status: proposal.status || 'pending',
    createdAt: createdAtString,
    lastModified: lastModifiedString
  };
}

/**
 * Prépare les données pour ouvrir le modal approprié
 */
export interface ModalData {
  type: 'proposals' | 'exchange';
  data: {
    exchange?: ExchangeShiftExchange;
    proposals?: ExchangeProposal[];
    assignment?: any;
    existingExchanges?: ExchangeShiftExchange[];
    operationTypes?: string[];
  };
}

/**
 * Détermine quel modal ouvrir en fonction des propositions trouvées
 */
export async function prepareModalData(
  primaryExchange: ExchangeShiftExchange | undefined,
  normalizedAssignment: any,
  existingExchanges: ExchangeShiftExchange[],
  existingOperationTypes: string[]
): Promise<ModalData> {
  // Si un échange existe, vérifier s'il a des propositions
  if (primaryExchange) {
    const directProposals = await checkForProposals(primaryExchange.id);
    
    if (directProposals && directProposals.length > 0) {
      console.log('Propositions trouvées pour l\'échange:', directProposals.length);
      
      // Convertir les propositions
      const proposals = directProposals.map(convertToExchangeProposal);
      
      return {
        type: 'proposals',
        data: {
          exchange: primaryExchange,
          proposals
        }
      };
    }
  }
  
  // Sinon, préparer les données pour le modal d'échange standard
  console.log('Aucune proposition trouvée, préparation du modal d\'échange standard');
  
  return {
    type: 'exchange',
    data: {
      assignment: normalizedAssignment,
      existingExchanges: existingExchanges,
      exchange: primaryExchange,
      operationTypes: existingOperationTypes
    }
  };
}