import { useState, useCallback } from 'react';
import { submitDirectExchange } from '../../../lib/firebase/directExchange';
import { invalidateAllExchangeDataCache } from '../utils';
import type { OperationType } from '../types';
import type { ShiftAssignment } from '../../planning/types';
import type { ShiftExchange } from '../../../types/exchange';

interface ExchangeModalState {
  assignment: ShiftAssignment;
  position: { x: number; y: number };
  existingExchanges?: ShiftExchange[];
  existingExchange?: ShiftExchange;
  operationTypes?: OperationType[];
  existingExchangeId?: string;
  existingReplacementId?: string;
}

interface UseExchangeModalOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
  removeExchange?: (id: string, operationType?: OperationType) => Promise<void>;
  refreshData?: () => Promise<void>;
}

interface UseExchangeModalResult {
  selectedCell: ExchangeModalState | null;
  setSelectedCell: (cell: ExchangeModalState | null) => void;
  handleSubmit: (comment: string, operationTypes: OperationType[]) => Promise<void>;
  handleRemove: () => Promise<void>;
  isProcessing: boolean;
}

/**
 * Hook unifié pour gérer le modal d'échange direct
 * Utilisé à la fois par "Mon Planning" et "Échanges Directs"
 */
export const useExchangeModal = (
  userId: string | undefined,
  options?: UseExchangeModalOptions
): UseExchangeModalResult => {
  const [selectedCell, setSelectedCell] = useState<ExchangeModalState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = useCallback(async (comment: string, operationTypes: OperationType[]) => {
    if (!userId || !selectedCell) return;

    setIsProcessing(true);

    try {
      const { assignment, existingExchange, existingReplacementId } = selectedCell;

      // Préparer les données pour submitDirectExchange
      const exchangeData = {
        exchangeId: existingExchange?.id || selectedCell.existingExchangeId,
        userId,
        date: assignment.date,
        period: assignment.period || assignment.type,
        shiftType: assignment.shiftType || 'regular',
        timeSlot: assignment.timeSlot || 'Full Day',
        comment,
        operationType: existingExchange?.operationType,
        operationTypes: existingExchange?.operationTypes || selectedCell.operationTypes,
        existingReplacementId
      };

      console.log('useExchangeModal: Soumission avec les données:', exchangeData);

      // Appeler la fonction unifiée
      await submitDirectExchange(
        exchangeData,
        operationTypes,
        {
          removeExchange: options?.removeExchange,
          onSuccess: (message) => {
            console.log('useExchangeModal: Succès -', message);
            options?.onSuccess?.(message);
          },
          onError: (message) => {
            console.error('useExchangeModal: Erreur -', message);
            options?.onError?.(message);
          },
          onComplete: async () => {
            console.log('useExchangeModal: Traitement terminé');
            
            // Invalider le cache pour forcer le rechargement
            invalidateAllExchangeDataCache();
            
            // Attendre un court délai pour s'assurer que Firebase a terminé
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Rafraîchir les données si une fonction est fournie
            if (options?.refreshData) {
              await options.refreshData();
            }
            
            // Émettre l'événement global pour synchroniser
            window.dispatchEvent(new CustomEvent('directExchangeUpdated'));
            
            // Fermer le modal
            setSelectedCell(null);
            
            // Appeler le callback onComplete
            options?.onComplete?.();
          }
        }
      );
    } catch (error) {
      console.error('useExchangeModal: Erreur lors de la soumission:', error);
      options?.onError?.(
        `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`
      );
    } finally {
      setIsProcessing(false);
    }
  }, [userId, selectedCell, options]);

  const handleRemove = useCallback(async () => {
    if (!selectedCell) return;

    console.log('useExchangeModal: Suppression complète de l\'échange');
    
    // Utiliser handleSubmit avec une liste vide d'opérations
    // pour que submitDirectExchange supprime tout
    await handleSubmit('', []);
  }, [selectedCell, handleSubmit]);

  return {
    selectedCell,
    setSelectedCell,
    handleSubmit,
    handleRemove,
    isProcessing
  };
};