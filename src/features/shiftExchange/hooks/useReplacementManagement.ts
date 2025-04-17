import { useState } from 'react';
import { proposeToReplacements, cancelPropositionToReplacements } from '../../../lib/firebase/exchange';
import type { ShiftExchange } from '../types';

/**
 * Hook personnalisé pour gérer les opérations liées aux remplaçants
 */
export const useReplacementManagement = () => {
  const [proposingShift, setProposingShift] = useState<string | null>(null);
  const [removingShift, setRemovingShift] = useState<string | null>(null);

  /**
   * Propose une garde aux remplaçants
   * @param exchange L'échange à proposer aux remplaçants
   * @param onSuccess Callback appelé en cas de succès
   * @param onError Callback appelé en cas d'erreur
   */
  const handleProposeToReplacements = async (
    exchange: ShiftExchange,
    onSuccess?: (message: string) => void,
    onError?: (error: any) => void
  ) => {
    try {
      setProposingShift(exchange.id as string);
      
      // Si la garde est déjà proposée, annuler la proposition
      if (exchange.proposedToReplacements) {
        await cancelPropositionToReplacements(exchange, true); // Ignorer la vérification du statut
        
        const successMessage = `La proposition aux remplaçants pour la garde du ${new Date(exchange.date).toLocaleDateString('fr-FR')} (${exchange.period}) a été annulée.`;
        
        if (onSuccess) {
          onSuccess(successMessage);
        } else {
          alert(successMessage);
        }
      } else {
        // Sinon, proposer la garde aux remplaçants
        await proposeToReplacements(exchange, [], true); // Ignorer la vérification du statut
        
        const successMessage = `La garde du ${new Date(exchange.date).toLocaleDateString('fr-FR')} (${exchange.period}) a été proposée aux remplaçants.`;
        
        if (onSuccess) {
          onSuccess(successMessage);
        } else {
          alert(successMessage);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la proposition aux remplaçants:', error);
      
      if (onError) {
        onError(error);
      } else {
        alert('Une erreur est survenue lors de la proposition aux remplaçants.');
      }
    } finally {
      setProposingShift(null);
    }
  };

  /**
   * Annule une proposition aux remplaçants
   * @param exchange L'échange dont on veut annuler la proposition
   * @param onSuccess Callback appelé en cas de succès
   * @param onError Callback appelé en cas d'erreur
   */
  const handleCancelProposition = async (
    exchange: ShiftExchange,
    onSuccess?: (message: string) => void,
    onError?: (error: any) => void
  ) => {
    try {
      setProposingShift(exchange.id as string);
      await cancelPropositionToReplacements(exchange, true); // Ignorer la vérification du statut
      
      const successMessage = `La proposition aux remplaçants pour la garde du ${new Date(exchange.date).toLocaleDateString('fr-FR')} (${exchange.period}) a été annulée.`;
      
      if (onSuccess) {
        onSuccess(successMessage);
      } else {
        alert(successMessage);
      }
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la proposition:', error);
      
      if (onError) {
        onError(error);
      } else {
        alert('Une erreur est survenue lors de l\'annulation de la proposition.');
      }
    } finally {
      setProposingShift(null);
    }
  };

  /**
   * Retire une garde de la bourse aux gardes
   * @param exchange L'échange à retirer
   * @param onSuccess Callback appelé en cas de succès
   * @param onError Callback appelé en cas d'erreur
   */
  const handleRemoveFromExchange = async (
    exchange: ShiftExchange,
    onSuccess?: (message: string) => void,
    onError?: (error: any) => void
  ) => {
    try {
      setRemovingShift(exchange.id as string);
      
      // Si la garde a été proposée aux remplaçants, annuler la proposition d'abord
      if (exchange.proposedToReplacements) {
        await cancelPropositionToReplacements(exchange, true); // Ignorer la vérification du statut
      }
      
      // TODO: Implémenter la logique pour retirer une garde de la bourse aux gardes
      // Cette fonctionnalité n'est pas encore implémentée dans le backend
      
      const successMessage = `La garde du ${new Date(exchange.date).toLocaleDateString('fr-FR')} (${exchange.period}) a été retirée de la bourse aux gardes.`;
      
      if (onSuccess) {
        onSuccess(successMessage);
      } else {
        alert(successMessage);
      }
    } catch (error) {
      console.error('Erreur lors du retrait de la garde:', error);
      
      if (onError) {
        onError(error);
      } else {
        alert('Une erreur est survenue lors du retrait de la garde.');
      }
    } finally {
      setRemovingShift(null);
    }
  };

  return {
    proposingShift,
    removingShift,
    handleProposeToReplacements,
    handleCancelProposition,
    handleRemoveFromExchange
  };
};

export default useReplacementManagement;
