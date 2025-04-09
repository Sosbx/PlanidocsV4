import { useState, useCallback } from 'react';
import type { OperationType } from '../../../types/exchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';
import type { ExchangeProposal } from '../../../components/exchange/ExchangeProposalsModal';

/**
 * Type pour l'état du modal de cellule sélectionnée
 */
export type SelectedCellState = {
  assignment: any;
  position: { x: number; y: number };
  existingExchanges?: ExchangeShiftExchange[];
  existingExchange?: ExchangeShiftExchange;
  existingOperationTypes?: OperationType[];
} | null;

/**
 * Type pour l'état du modal d'échange proposé
 */
export type SelectedProposedExchangeState = {
  exchange: ExchangeShiftExchange;
  position: { x: number; y: number };
  existingOperationTypes?: string[];
} | null;

/**
 * Type pour l'état du modal de propositions d'échange
 */
export type SelectedExchangeWithProposalsState = {
  exchange: ExchangeShiftExchange;
  proposals: ExchangeProposal[];
} | null;

/**
 * Hook pour gérer les modals des échanges directs
 * Centralise la gestion des états des différents modals
 */
export const useDirectExchangeModals = () => {
  // États pour les modals
  const [selectedCell, setSelectedCell] = useState<SelectedCellState>(null);
  const [selectedProposedExchange, setSelectedProposedExchange] = useState<SelectedProposedExchangeState>(null);
  const [selectedExchangeWithProposals, setSelectedExchangeWithProposals] = useState<SelectedExchangeWithProposalsState>(null);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  
  // Fonction pour fermer tous les modals
  const closeAllModals = useCallback(() => {
    setSelectedCell(null);
    setSelectedProposedExchange(null);
    setSelectedExchangeWithProposals(null);
  }, []);
  
  return {
    // États des modals
    selectedCell,
    setSelectedCell,
    selectedProposedExchange,
    setSelectedProposedExchange,
    selectedExchangeWithProposals,
    setSelectedExchangeWithProposals,
    isLoadingProposals,
    setIsLoadingProposals,
    
    // Fonctions utilitaires
    closeAllModals
  };
};
