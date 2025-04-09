import { useCallback, useState } from 'react';
import { useDirectExchange } from '../../../hooks/exchange/useDirectExchange';
import type { OperationType } from '../../../types/exchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

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
  const handleModalSubmit = useCallback((
    selectedCell: {
      assignment: any;
      existingExchanges?: ExchangeShiftExchange[];
      existingOperationTypes?: OperationType[];
    } | null,
    comment: string, 
    operationTypes: OperationType[],
    onComplete?: () => void
  ) => {
    if (!selectedCell) return;
    
    // Si aucune option n'est sélectionnée, supprimer tous les échanges existants
    if (operationTypes.length === 0 && selectedCell.existingExchanges && selectedCell.existingExchanges.length > 0) {
      // Supprimer tous les échanges existants
      selectedCell.existingExchanges.forEach(exchange => {
        if (exchange.id) {
          removeExchange(exchange.id, exchange.operationType);
        }
      });
      
      setToast({
        visible: true,
        message: 'Garde(s) retirée(s) avec succès',
        type: 'success'
      });
    } 
    // Sinon, gérer les ajouts et suppressions
    else if (operationTypes.length > 0) {
      // Déterminer quels types d'opération doivent être supprimés
      const typesToRemove = selectedCell.existingOperationTypes?.filter(
        type => !operationTypes.includes(type)
      ) || [];
      
      // Supprimer les échanges qui ne sont plus sélectionnés
      if (selectedCell.existingExchanges) {
        selectedCell.existingExchanges.forEach(exchange => {
          if (exchange.id && typesToRemove.includes(exchange.operationType)) {
            removeExchange(exchange.id, exchange.operationType);
          }
        });
      }
      
      // Déterminer quels types d'opération doivent être ajoutés
      const typesToAdd = operationTypes.filter(
        type => !selectedCell.existingOperationTypes?.includes(type)
      );
      
      // Ajouter les nouveaux types d'opération
      const operationMessages: string[] = [];
      
      // Normaliser l'assignation pour s'assurer que les données sont au bon format
      const normalizedAssignment = {
        ...selectedCell.assignment,
        // S'assurer que period est défini, sinon utiliser type
        period: selectedCell.assignment.period || selectedCell.assignment.type
      };
      
      console.log('Assignation normalisée:', normalizedAssignment);
      
      // Traiter chaque type d'opération à ajouter
      typesToAdd.forEach(type => {
        switch (type) {
          case 'exchange':
            proposeDirectExchange(normalizedAssignment, comment);
            operationMessages.push('échange');
            break;
          case 'give':
            proposeDirectCession(normalizedAssignment, comment);
            operationMessages.push('cession');
            break;
          case 'replacement':
            proposeDirectReplacement(normalizedAssignment, comment);
            operationMessages.push('remplaçant');
            break;
        }
      });
      
      // Afficher un message de succès avec les types d'opération
      if (operationMessages.length > 0) {
        setToast({
          visible: true,
          message: `Garde proposée avec succès (${operationMessages.join(', ')})`,
          type: 'success'
        });
      }
    }
    
    // Appeler le callback de complétion si fourni
    onComplete?.();
  }, [proposeDirectExchange, proposeDirectCession, proposeDirectReplacement, removeExchange]);
  
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
