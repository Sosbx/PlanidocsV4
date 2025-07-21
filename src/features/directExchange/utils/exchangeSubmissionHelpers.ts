import type { OperationType } from '../types';

interface ExchangeSubmissionHandlers {
  handleCessionSubmit: (exchangeId: string, comment: string) => void;
  handleExchangeSubmit: (exchangeId: string, userShiftKeys: string[], comment: string) => void;
}

/**
 * Crée les handlers pour les différents types de soumission d'échange
 */
export function createExchangeSubmissionHandlers(
  selectedProposedExchange: any,
  handleProposedExchangeSubmit: Function,
  setSelectedProposedExchange: Function
): ExchangeSubmissionHandlers {
  
  // Gestionnaire pour la proposition de cession
  const handleCessionSubmit = (exchangeId: string, comment: string) => {
    if (!selectedProposedExchange) return;
    
    handleProposedExchangeSubmit(
      exchangeId,
      selectedProposedExchange.exchange,
      undefined, // Pas de sélection de garde pour une cession
      comment,
      'take', // Type d'opération : cession
      () => {
        setSelectedProposedExchange(null);
      }
    );
  };
  
  // Gestionnaire pour la proposition d'échange
  const handleExchangeSubmit = (exchangeId: string, userShiftKeys: string[], comment: string) => {
    if (!selectedProposedExchange) return;
    
    handleProposedExchangeSubmit(
      exchangeId,
      selectedProposedExchange.exchange,
      userShiftKeys.join(','), // Convertir l'array en string séparé par des virgules
      comment,
      'exchange', // Type d'opération : échange
      () => {
        setSelectedProposedExchange(null);
      }
    );
  };
  
  return {
    handleCessionSubmit,
    handleExchangeSubmit
  };
}

/**
 * Crée un wrapper pour la fonction removeExchange avec typage correct
 */
export function createRemoveExchangeWrapper(
  removeExchange: (id: string, operationType: OperationType) => Promise<void>
) {
  return (id: string, operationType: string) => {
    return removeExchange(id, operationType as OperationType);
  };
}