import { useState, useCallback } from 'react';
import type { ShiftAssignment } from '../../../types/planning';
import { OperationType, ShiftPeriod } from '../../../types/exchange';
import { useDirectExchanges } from '../../../context/directExchange';
import { useAuth } from '../../auth/hooks';

interface UseDirectExchangeOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

/**
 * Hook pour gérer les échanges directs
 * Utilise maintenant le contexte DirectExchangeContext avec le repository
 */
export const useDirectExchange = (options: UseDirectExchangeOptions = {}) => {
  const { user } = useAuth();
  const {
    createExchange,
    cancelExchange,
    myExchanges,
    loading
  } = useDirectExchanges();
  
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  /**
   * Propose une garde à l'échange direct (permutation)
   */
  const proposeDirectExchange = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return null;
    
    console.log('Proposition d\'échange direct - Données reçues:', assignment);
    
    // Vérifier que toutes les propriétés requises sont présentes
    if (!assignment.date || (!assignment.period && !assignment.type) || !assignment.shiftType || !assignment.timeSlot) {
      console.error('Données d\'assignation incomplètes pour l\'échange:', assignment);
      
      if (options.onError) {
        options.onError("Données d'assignation incomplètes pour l'échange");
      }
      return null;
    }
    
    try {
      setIsProcessing('propose-exchange');
      
      const exchange = await createExchange(
        assignment,
        ['exchange' as OperationType],
        comment
      );
      
      if (options.onSuccess) {
        options.onSuccess('Proposition d\'échange ajoutée avec succès');
      }
      
      return exchange?.id || null;
    } catch (error) {
      console.error('Erreur lors de la proposition d\'échange:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Erreur lors de la proposition');
      }
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, createExchange, options]);

  /**
   * Propose une garde à la cession directe (sans contrepartie)
   */
  const proposeDirectGive = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return null;
    
    console.log('Proposition de cession directe - Données reçues:', assignment);
    
    if (!assignment.date || (!assignment.period && !assignment.type) || !assignment.shiftType || !assignment.timeSlot) {
      console.error('Données d\'assignation incomplètes pour la cession:', assignment);
      
      if (options.onError) {
        options.onError("Données d'assignation incomplètes pour la cession");
      }
      return null;
    }
    
    try {
      setIsProcessing('propose-give');
      
      const exchange = await createExchange(
        assignment,
        ['give' as OperationType],
        comment
      );
      
      if (options.onSuccess) {
        options.onSuccess('Proposition de cession ajoutée avec succès');
      }
      
      return exchange?.id || null;
    } catch (error) {
      console.error('Erreur lors de la proposition de cession:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Erreur lors de la proposition');
      }
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, createExchange, options]);

  /**
   * Propose une garde au remplacement
   */
  const proposeDirectReplacement = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return null;
    
    console.log('Proposition de remplacement - Données reçues:', assignment);
    
    if (!assignment.date || (!assignment.period && !assignment.type) || !assignment.shiftType || !assignment.timeSlot) {
      console.error('Données d\'assignation incomplètes pour le remplacement:', assignment);
      
      if (options.onError) {
        options.onError("Données d'assignation incomplètes pour le remplacement");
      }
      return null;
    }
    
    try {
      setIsProcessing('propose-replacement');
      
      const exchange = await createExchange(
        assignment,
        ['replacement' as OperationType],
        comment
      );
      
      if (options.onSuccess) {
        options.onSuccess('Demande de remplacement ajoutée avec succès');
      }
      
      return exchange?.id || null;
    } catch (error) {
      console.error('Erreur lors de la demande de remplacement:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Erreur lors de la demande');
      }
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, createExchange, options]);

  /**
   * Retire une garde de l'échange direct
   */
  const removeFromDirectExchange = useCallback(async (exchangeId: string) => {
    if (!user || !exchangeId) return;
    
    try {
      setIsProcessing(`remove-${exchangeId}`);
      
      await cancelExchange(exchangeId);
      
      if (options.onSuccess) {
        options.onSuccess('Garde retirée avec succès');
      }
    } catch (error) {
      console.error('Erreur lors du retrait:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Erreur lors du retrait');
      }
    } finally {
      setIsProcessing(null);
    }
  }, [user, cancelExchange, options]);

  /**
   * Vérifie si une garde est déjà dans l'échange direct
   */
  const isInDirectExchange = useCallback((
    date: string,
    period: string
  ): { isInExchange: boolean; exchangeId?: string } => {
    if (!user || !myExchanges) {
      return { isInExchange: false };
    }

    const exchange = myExchanges.find(e => 
      e.date === date && 
      e.period === period &&
      e.status === 'pending'
    );

    return {
      isInExchange: !!exchange,
      exchangeId: exchange?.id
    };
  }, [user, myExchanges]);

  return {
    proposeDirectExchange,
    proposeDirectGive,
    proposeDirectReplacement,
    removeFromDirectExchange,
    isInDirectExchange,
    isProcessing,
    loading
  };
};