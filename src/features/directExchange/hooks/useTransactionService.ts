import { useState, useCallback } from 'react';
import { useAuth } from '../../auth/hooks';
import { FirestoreCacheUtils } from '../../../hooks/useFirestoreCache';
import { 
  createExchangeTransaction, 
  ProposalData, 
  acceptProposalTransaction, 
  rejectProposalTransaction, 
  cancelExchangeTransaction, 
  getExchangeHistory, 
  formatExchangeHistoryEntry,
  createProposalTransaction 
} from '../../../lib/firebase/directExchange/TransactionService';
import { ShiftPeriod, OperationType } from '../../../types/exchange';

/**
 * Options du hook useTransactionService
 */
export interface UseTransactionServiceOptions {
  onSuccess?: (message: string, data?: any) => void;
  onError?: (message: string, error?: any) => void;
  onLoading?: (isLoading: boolean) => void;
}

/**
 * Hook pour utiliser le service de transactions d'échanges directs
 * Fournit une interface pour interagir avec le TransactionService
 * 
 * @param options Options du hook
 * @returns Fonctions pour effectuer des opérations sur les échanges
 */
export const useTransactionService = (options?: UseTransactionServiceOptions) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const invalidateCache = FirestoreCacheUtils.invalidate;

  /**
   * Crée un nouvel échange direct
   */
  const createExchange = useCallback(async (
    date: string,
    period: string | ShiftPeriod,
    shiftType: string,
    timeSlot: string,
    operationTypes: OperationType[],
    comment?: string
  ) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return { success: false, error: 'Vous devez être connecté pour effectuer cette action' };
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const result = await createExchangeTransaction({
        userId: user.id,
        date,
        period,
        shiftType,
        timeSlot,
        comment: comment || '',
        operationTypes: operationTypes as any[]
      });

      if (result.success) {
        // Invalider le cache pour forcer un rechargement des données
        invalidateCache('direct_exchanges_all');
        options?.onSuccess?.('Échange créé avec succès', result.data);
      } else {
        options?.onError?.(result.error || 'Erreur lors de la création de l\'échange');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, invalidateCache, options]);

  /**
   * Crée une proposition pour un échange
   */
  const proposeExchange = useCallback(async (
    exchangeId: string,
    proposalType: 'take' | 'exchange' | 'both' | 'replacement' | 'take_replacement' | 'exchange_replacement',
    proposedShifts?: Array<{
      date: string;
      period: string | ShiftPeriod;
      shiftType: string;
      timeSlot: string;
    }>,
    comment?: string
  ) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return { success: false, error: 'Vous devez être connecté pour effectuer cette action' };
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const proposalData: ProposalData = {
        exchangeId,
        proposingUserId: user.id,
        targetUserId: '', // Sera rempli par le service
        proposalType,
        proposedShifts,
        comment
      };

      const result = await createProposalTransaction(proposalData);

      if (result.success) {
        // Invalider le cache pour forcer un rechargement des données
        invalidateCache('direct_proposals');
        options?.onSuccess?.('Proposition créée avec succès', result.data);
      } else {
        options?.onError?.(result.error || 'Erreur lors de la création de la proposition');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, invalidateCache, options]);

  /**
   * Accepte une proposition d'échange
   */
  const acceptProposal = useCallback(async (
    proposalId: string,
    updatePlanning: boolean = true,
    sendNotification: boolean = true
  ) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return { success: false, error: 'Vous devez être connecté pour effectuer cette action' };
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const result = await acceptProposalTransaction(
        proposalId,
        user.id,
        updatePlanning,
        sendNotification
      );

      if (result.success) {
        // Invalider les caches pour forcer un rechargement des données
        invalidateCache('direct_exchanges_all');
        invalidateCache('direct_proposals');
        invalidateCache('user_planning');
        invalidateCache('direct_exchange_history');
        
        options?.onSuccess?.('Proposition acceptée avec succès', result);
      } else {
        options?.onError?.(result.error || 'Erreur lors de l\'acceptation de la proposition');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, invalidateCache, options]);

  /**
   * Rejette une proposition d'échange
   */
  const rejectProposal = useCallback(async (
    proposalId: string,
    sendNotification: boolean = true
  ) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return { success: false, error: 'Vous devez être connecté pour effectuer cette action' };
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const result = await rejectProposalTransaction(
        proposalId,
        user.id,
        sendNotification
      );

      if (result.success) {
        // Invalider le cache pour forcer un rechargement des données
        invalidateCache('direct_proposals');
        options?.onSuccess?.('Proposition rejetée avec succès', result);
      } else {
        options?.onError?.(result.error || 'Erreur lors du rejet de la proposition');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, invalidateCache, options]);

  /**
   * Annule un échange
   */
  const cancelExchange = useCallback(async (exchangeId: string) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return { success: false, error: 'Vous devez être connecté pour effectuer cette action' };
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const result = await cancelExchangeTransaction(exchangeId, user.id);

      if (result.success) {
        // Invalider le cache pour forcer un rechargement des données
        invalidateCache('direct_exchanges_all');
        invalidateCache('direct_proposals');
        options?.onSuccess?.('Échange annulé avec succès', result);
      } else {
        options?.onError?.(result.error || 'Erreur lors de l\'annulation de l\'échange');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, invalidateCache, options]);

  /**
   * Récupère l'historique des échanges d'un utilisateur
   */
  const getUserExchangeHistory = useCallback(async (limit: number = 50) => {
    if (!user) {
      options?.onError?.('Vous devez être connecté pour effectuer cette action');
      return [];
    }

    try {
      setIsLoading(true);
      options?.onLoading?.(true);

      const history = await getExchangeHistory(user.id, limit);
      
      // Formater l'historique pour l'affichage
      const formattedHistory = history.map(formatExchangeHistoryEntry);
      
      return formattedHistory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(`Erreur lors de la récupération de l'historique: ${errorMessage}`, error);
      return [];
    } finally {
      setIsLoading(false);
      options?.onLoading?.(false);
    }
  }, [user, options]);

  // Fonction pour créer un échange combiné (peut inclure plusieurs types d'opérations)
  const createCombinedExchange = useCallback(async (
    assignment: any,
    operationTypes: OperationType[],
    comment?: string
  ) => {
    if (!user || !assignment) {
      options?.onError?.('Données insuffisantes pour créer l\'échange');
      return { success: false, error: 'Données insuffisantes pour créer l\'échange' };
    }

    try {
      // Normaliser la période
      const period = assignment.period || assignment.type;
      
      // Créer l'échange avec les options spécifiées
      return await createExchange(
        assignment.date,
        period,
        assignment.shiftType || 'regular',
        assignment.timeSlot || 'Full Day',
        operationTypes,
        comment
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      options?.onError?.(errorMessage, error);
      return { success: false, error: errorMessage };
    }
  }, [user, createExchange, options]);

  return {
    // État et indicateurs
    isLoading,
    
    // Opérations de base
    createExchange,
    proposeExchange,
    acceptProposal,
    rejectProposal,
    cancelExchange,
    
    // Opérations avancées
    createCombinedExchange,
    getUserExchangeHistory
  };
};

// Le hook est complet