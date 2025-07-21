import { useCallback } from 'react';
import type { OperationType } from '../types';

interface CallbackOptions {
  onCancelProposal: (exchangeId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onAcceptShiftProposal: (proposalId: string, shiftIndex: number) => void;
  onRejectShiftProposal: (proposalId: string, shiftIndex: number) => void;
  onUpdateExchangeOptions: (operationTypes: OperationType[]) => void;
  selectedProposedExchange: any;
}

/**
 * Hook pour gérer les callbacks des modals d'échange direct
 * Simplifie la création des wrappers pour les différentes actions
 */
export function useDirectExchangeCallbacks(options: CallbackOptions) {
  const {
    onCancelProposal,
    onAcceptProposal,
    onRejectProposal,
    onAcceptShiftProposal,
    onRejectShiftProposal,
    onUpdateExchangeOptions,
    selectedProposedExchange
  } = options;

  // Wrapper pour onCancelProposal qui n'attend pas de paramètres
  const handleCancelProposalWrapper = useCallback(() => {
    if (!selectedProposedExchange) return;
    onCancelProposal(selectedProposedExchange.exchange.id || '');
  }, [onCancelProposal, selectedProposedExchange]);

  // Wrappers pour les fonctions passées à ExchangeProposalsModal
  const handleAcceptProposalWrapper = useCallback(async (proposalId: string) => {
    onAcceptProposal(proposalId);
  }, [onAcceptProposal]);

  const handleRejectProposalWrapper = useCallback(async (proposalId: string) => {
    onRejectProposal(proposalId);
  }, [onRejectProposal]);

  const handleAcceptShiftProposalWrapper = useCallback(async (proposalId: string, shiftIndex: number) => {
    onAcceptShiftProposal(proposalId, shiftIndex);
  }, [onAcceptShiftProposal]);

  const handleRejectShiftProposalWrapper = useCallback(async (proposalId: string, shiftIndex: number) => {
    onRejectShiftProposal(proposalId, shiftIndex);
  }, [onRejectShiftProposal]);

  const handleUpdateOptionsWrapper = useCallback(async (operationTypes: string[]) => {
    onUpdateExchangeOptions(operationTypes as OperationType[]);
  }, [onUpdateExchangeOptions]);

  return {
    handleCancelProposalWrapper,
    handleAcceptProposalWrapper,
    handleRejectProposalWrapper,
    handleAcceptShiftProposalWrapper,
    handleRejectShiftProposalWrapper,
    handleUpdateOptionsWrapper
  };
}