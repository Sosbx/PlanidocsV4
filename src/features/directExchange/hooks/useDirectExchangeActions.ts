import { useCallback, useState } from 'react';
import { useDirectExchange } from './useDirectExchange';
import type { OperationType } from '../../../types/exchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';
import { createCombinedExchange } from '../../../lib/firebase/directExchange/core';

/**
 * Type pour les options du hook
 */
type UseDirectExchangeActionsOptions = {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

/**
 * Hook pour gérer les actions sur les échanges directs
 * Centralise les opérations sur les échanges (proposer, supprimer, etc.)
 */
export const useDirectExchangeActions = (options?: UseDirectExchangeActionsOptions) => {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });
  
  // Utiliser le hook existant pour les opérations de base
  const { 
    proposeDirectExchange,
    proposeDirectCession,
    proposeDirectReplacement,
    removeExchange, 
    isProcessing 
  } = useDirectExchange({
    onSuccess: (message) => {
      setToast({ visible: true, message, type: 'success' });
      options?.onSuccess?.(message);
    },
    onError: (message) => {
      setToast({ visible: true, message, type: 'error' });
      options?.onError?.(message);
    }
  });
  
  // Fonction pour gérer la soumission du modal pour ses propres gardes
  const handleModalSubmit = useCallback(async (
    selectedCell: {
      assignment: any;
      existingExchanges?: ExchangeShiftExchange[];
      operationTypes?: OperationType[]; // Source unique de vérité pour les types d'opérations
    } | null,
    comment: string, 
    operationTypes: OperationType[],
    onComplete?: () => void
  ) => {
    if (!selectedCell) return;
    
    try {
      // Importer la fonction unifiée submitDirectExchange
      const { submitDirectExchange } = await import('../../../lib/firebase/directExchange');
      
      // Normaliser l'assignation pour s'assurer que les données sont au bon format
      const normalizedAssignment = {
        ...selectedCell.assignment,
        // S'assurer que period est défini, sinon utiliser type
        period: selectedCell.assignment.period || selectedCell.assignment.type
      };
      
      console.log('Assignation normalisée:', normalizedAssignment);
      
      // Récupérer l'échange existant s'il y en a un
      const existingExchange = selectedCell.existingExchanges && selectedCell.existingExchanges.length > 0
        ? selectedCell.existingExchanges[0]
        : undefined;
      
      // Préparer les données pour la fonction unifiée
      const exchangeData = {
        exchangeId: existingExchange?.id,
        userId: normalizedAssignment.userId,
        date: normalizedAssignment.date,
        period: normalizedAssignment.period,
        shiftType: normalizedAssignment.shiftType,
        timeSlot: normalizedAssignment.timeSlot,
        comment: comment,
        operationType: existingExchange?.operationType,
        operationTypes: existingExchange?.operationTypes || selectedCell.operationTypes
      };
      
      // Appeler la fonction unifiée
      const result = await submitDirectExchange(
        exchangeData,
        operationTypes,
        {
          removeExchange: removeExchange,
          onSuccess: (message) => {
            setToast({
              visible: true,
              message: message,
              type: 'success'
            });
            options?.onSuccess?.(message);
            
            // Forcer un rafraîchissement des données après une action réussie
            setTimeout(async () => {
              try {
                // Importer dynamiquement la fonction pour éviter les dépendances circulaires
                const { getDirectExchanges } = await import('../../../lib/firebase/directExchange');
                console.log("Rafraîchissement forcé des données après action réussie");
                // Invalider le cache avant de récupérer les données
                const { FirestoreCacheUtils } = await import('../../../utils/cacheUtils');
                FirestoreCacheUtils.invalidate('direct_exchanges_all');
                await getDirectExchanges(); // Récupérer les données fraîches
              } catch (error) {
                console.error("Erreur lors du rafraîchissement forcé:", error);
              }
            }, 500); // Petit délai pour laisser Firebase terminer ses opérations
          },
          onError: (message) => {
            setToast({
              visible: true,
              message: message,
              type: 'error'
            });
            options?.onError?.(message);
          },
          onComplete: () => {
            // Exécuter le callback de complétion après un court délai
            // pour s'assurer que les données ont eu le temps d'être mises à jour
            setTimeout(() => {
              onComplete?.();
            }, 800);
          }
        }
      );
      
      console.log('Résultat de la soumission de l\'échange:', result);
    } catch (error) {
      console.error('Erreur lors de la soumission du modal:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        type: 'error'
      });
      
      options?.onError?.(`Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`);
      
      // Appeler le callback de complétion si fourni, même en cas d'erreur
      onComplete?.();
    }
  }, [removeExchange, options]);
  
  // Fonction pour mettre à jour les options d'échange
  const updateExchangeOptions = useCallback(async (
    exchangeId: string, 
    operationTypes: OperationType[],
    onComplete?: () => void
  ) => {
    try {
      // Importer dynamiquement la fonction pour éviter les dépendances circulaires
      const { updateExchangeOptions: updateOptions } = await import('../../../lib/firebase/directExchange');
      
      // Mettre à jour les options d'échange
      await updateOptions(exchangeId, operationTypes);
      
      setToast({
        visible: true,
        message: 'Options d\'échange mises à jour avec succès',
        type: 'success'
      });
      
      // Appeler le callback de complétion si fourni
      onComplete?.();
    } catch (error) {
      console.error('Erreur lors de la mise à jour des options d\'échange:', error);
      
      setToast({
        visible: true,
        message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue lors de la mise à jour des options d\'échange'}`,
        type: 'error'
      });
    }
  }, []);
  
  return {
    // État du toast
    toast,
    setToast,
    
    // Indicateur de traitement en cours
    isProcessing,
    
    // Actions de base
    proposeDirectExchange,
    proposeDirectCession,
    proposeDirectReplacement,
    removeExchange,
    
    // Actions composées
    handleModalSubmit,
    updateExchangeOptions
  };
};
