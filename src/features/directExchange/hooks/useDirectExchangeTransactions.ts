import { useCallback, useState } from 'react';
import { useTransactionService } from './useTransactionService';
import type { OperationType } from '../../../types/exchange';

/**
 * Type pour les options du hook
 */
type UseDirectExchangeTransactionsOptions = {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

/**
 * Hook de transition pour intégrer le nouveau système de transactions 
 * tout en maintenant la compatibilité avec les composants existants
 */
export const useDirectExchangeTransactions = (options?: UseDirectExchangeTransactionsOptions) => {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });

  // Utiliser le nouveau hook de service avec les callbacks adaptés
  const transactionService = useTransactionService({
    onSuccess: (message, data) => {
      setToast({ visible: true, message, type: 'success' });
      options?.onSuccess?.(message);
      
      // Log des données pour débogage
      console.log('[useDirectExchangeTransactions] Opération réussie:', { message, data });
    },
    onError: (message, error) => {
      setToast({ visible: true, message, type: 'error' });
      options?.onError?.(message);
      
      // Log de l'erreur pour débogage
      console.error('[useDirectExchangeTransactions] Erreur:', { message, error });
    }
  });
  
  // Fonction pour gérer la soumission du modal pour ses propres gardes
  // Compatibilité avec l'interface existante
  const handleModalSubmit = useCallback(async (
    selectedCell: {
      assignment: any;
      existingExchanges?: any[];
      operationTypes?: OperationType[];
    } | null,
    comment: string, 
    operationTypes: OperationType[],
    onComplete?: () => void
  ) => {
    if (!selectedCell) return;
    
    try {
      console.log('[handleModalSubmit] Soumission avec:', { 
        assignment: selectedCell.assignment,
        operationTypes,
        existingExchanges: selectedCell.existingExchanges?.length
      });
      
      // Si l'échange existe déjà, l'annuler avant d'en créer un nouveau
      if (selectedCell.existingExchanges && selectedCell.existingExchanges.length > 0) {
        const existingExchange = selectedCell.existingExchanges[0];
        console.log('[handleModalSubmit] Annulation de l\'échange existant:', existingExchange.id);
        
        await transactionService.cancelExchange(existingExchange.id);
      }
      
      // Créer un nouvel échange avec les opérations spécifiées
      const result = await transactionService.createCombinedExchange(
        selectedCell.assignment,
        operationTypes,
        comment
      );
      
      console.log('[handleModalSubmit] Résultat:', result);
      
      // Appeler le callback de complétion
      setTimeout(() => {
        onComplete?.();
      }, 800);
      
      return result;
    } catch (error) {
      console.error('[handleModalSubmit] Erreur:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      // Appeler le callback de complétion même en cas d'erreur
      onComplete?.();
      
      return { success: false, error: String(error) };
    }
  }, [transactionService]);
  
  // Fonction pour proposer un échange
  const proposeExchange = useCallback(async (
    exchangeId: string,
    proposalType: 'take' | 'exchange' | 'both' | 'replacement' | 'take_replacement' | 'exchange_replacement',
    proposedShifts?: any[],
    comment?: string
  ) => {
    try {
      console.log('[proposeExchange] Proposition pour:', { 
        exchangeId, 
        proposalType,
        proposedShifts: proposedShifts?.length
      });
      
      return await transactionService.proposeExchange(
        exchangeId,
        proposalType,
        proposedShifts,
        comment
      );
    } catch (error) {
      console.error('[proposeExchange] Erreur:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      return { success: false, error: String(error) };
    }
  }, [transactionService]);
  
  // Fonction pour accepter une proposition
  const acceptProposal = useCallback(async (
    proposalId: string
  ) => {
    try {
      console.log('[acceptProposal] Acceptation de:', { proposalId });
      
      return await transactionService.acceptProposal(proposalId);
    } catch (error) {
      console.error('[acceptProposal] Erreur:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      return { success: false, error: String(error) };
    }
  }, [transactionService]);
  
  // Fonction pour rejeter une proposition
  const rejectProposal = useCallback(async (
    proposalId: string
  ) => {
    try {
      console.log('[rejectProposal] Rejet de:', { proposalId });
      
      return await transactionService.rejectProposal(proposalId);
    } catch (error) {
      console.error('[rejectProposal] Erreur:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      return { success: false, error: String(error) };
    }
  }, [transactionService]);
  
  // Fonction d'annulation d'échange (pour compatibilité)
  const removeExchange = useCallback(async (
    exchangeId: string
  ) => {
    try {
      console.log('[removeExchange] Annulation de:', { exchangeId });
      
      return await transactionService.cancelExchange(exchangeId);
    } catch (error) {
      console.error('[removeExchange] Erreur:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      return { success: false, error: String(error) };
    }
  }, [transactionService]);
  
  return {
    // État du toast
    toast,
    setToast,
    
    // Indicateur de traitement en cours
    isProcessing: transactionService.isLoading,
    
    // Actions compatibles avec les anciennes interfaces
    proposeDirectExchange: proposeExchange,
    proposeDirectCession: proposeExchange,
    proposeDirectReplacement: proposeExchange,
    removeExchange,
    
    // Nouvelles actions via le TransactionService
    acceptProposal,
    rejectProposal,
    
    // Actions composées
    handleModalSubmit,
    
    // Historique
    getUserExchangeHistory: transactionService.getUserExchangeHistory
  };
};