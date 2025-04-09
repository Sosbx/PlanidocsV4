import { useState, useCallback } from 'react';
import type { ShiftAssignment } from '../../../types/planning';
import { OperationType, ShiftPeriod } from '../../../types/exchange';
import { 
  addDirectExchange, 
  addDirectCession, 
  addDirectReplacement, 
  removeDirectExchange, 
  getCollectionByOperationType 
} from '../../../lib/firebase/directExchange';
import { useAuth } from '../../auth/hooks';

interface UseDirectExchangeOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

/**
 * Hook pour gérer les échanges directs
 * Permet de proposer des gardes à l'échange direct, de les retirer, etc.
 */
export const useDirectExchange = (options: UseDirectExchangeOptions = {}) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  /**
   * Propose une garde à l'échange direct (permutation)
   * @param assignment La garde à proposer
   * @param comment Commentaire optionnel
   */
  const proposeDirectExchange = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return;
    
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
      
      // S'assurer que la période est au bon format
      const period = assignment.period || assignment.type;
      
      console.log('Période utilisée pour l\'échange:', period, 'depuis', {
        period: assignment.period,
        type: assignment.type,
        assignment: assignment
      });
      
      // Vérifier si la période est valide
      if (!period) {
        console.error('Période manquante pour l\'échange:', assignment);
        throw new Error('Période manquante pour l\'échange');
      }
      
      if (!period || !['M', 'AM', 'S'].includes(period)) {
        throw new Error(`Période invalide: ${period}`);
      }
      
      // Convertir la chaîne de caractères en valeur de l'enum ShiftPeriod
      let periodEnum: ShiftPeriod;
      switch (period) {
        case 'M':
          periodEnum = ShiftPeriod.MORNING;
          break;
        case 'AM':
          periodEnum = ShiftPeriod.AFTERNOON;
          break;
        case 'S':
          periodEnum = ShiftPeriod.EVENING;
          break;
        default:
          throw new Error(`Période invalide: ${period}`);
      }
      
      const exchangeId = await addDirectExchange({
        userId: user.id,
        date: assignment.date,
        period: periodEnum,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        comment: comment || '',
        status: 'pending',
        lastModified: new Date().toISOString()
      });
      
      if (options.onSuccess) {
        options.onSuccess('Proposition d\'échange ajoutée avec succès');
      }
      
      return exchangeId;
    } catch (error) {
      console.error('Error proposing direct exchange:', error);
      
      if (options.onError) {
        options.onError(`Erreur lors de l'ajout: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
      
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, options]);

  /**
   * Propose une garde à la cession directe
   * @param assignment La garde à proposer
   * @param comment Commentaire optionnel
   */
  const proposeDirectCession = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return;
    
    console.log('Proposition de cession directe - Données reçues:', assignment);
    
    // Vérifier que toutes les propriétés requises sont présentes
    if (!assignment.date || (!assignment.period && !assignment.type) || !assignment.shiftType || !assignment.timeSlot) {
      console.error('Données d\'assignation incomplètes pour la cession:', assignment);
      
      if (options.onError) {
        options.onError("Données d'assignation incomplètes pour la cession");
      }
      return null;
    }
    
    try {
      setIsProcessing('propose-cession');
      
      // S'assurer que la période est au bon format
      const period = assignment.period || assignment.type;
      
      console.log('Période utilisée pour la cession:', period, 'depuis', {
        period: assignment.period,
        type: assignment.type,
        assignment: assignment
      });
      
      // Vérifier si la période est valide
      if (!period) {
        console.error('Période manquante pour la cession:', assignment);
        throw new Error('Période manquante pour la cession');
      }
      
      if (!period || !['M', 'AM', 'S'].includes(period)) {
        throw new Error(`Période invalide: ${period}`);
      }
      
      // Convertir la chaîne de caractères en valeur de l'enum ShiftPeriod
      let periodEnum: ShiftPeriod;
      switch (period) {
        case 'M':
          periodEnum = ShiftPeriod.MORNING;
          break;
        case 'AM':
          periodEnum = ShiftPeriod.AFTERNOON;
          break;
        case 'S':
          periodEnum = ShiftPeriod.EVENING;
          break;
        default:
          throw new Error(`Période invalide: ${period}`);
      }
      
      const cessionId = await addDirectCession({
        userId: user.id,
        date: assignment.date,
        period: periodEnum,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        comment: comment || '',
        status: 'pending',
        lastModified: new Date().toISOString()
      });
      
      if (options.onSuccess) {
        options.onSuccess('Proposition de cession ajoutée avec succès');
      }
      
      return cessionId;
    } catch (error) {
      console.error('Error proposing direct cession:', error);
      
      if (options.onError) {
        options.onError(`Erreur lors de l'ajout: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
      
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, options]);

  /**
   * Propose une garde au remplacement direct
   * @param assignment La garde à proposer
   * @param comment Commentaire optionnel
   */
  const proposeDirectReplacement = useCallback(async (
    assignment: ShiftAssignment,
    comment: string
  ) => {
    if (!user) return;
    
    console.log('Proposition de remplacement direct - Données reçues:', assignment);
    
    // Vérifier que toutes les propriétés requises sont présentes
    if (!assignment.date || (!assignment.period && !assignment.type) || !assignment.shiftType || !assignment.timeSlot) {
      console.error('Données d\'assignation incomplètes pour le remplacement:', assignment);
      
      if (options.onError) {
        options.onError("Données d'assignation incomplètes pour le remplacement");
      }
      return null;
    }
    
    try {
      setIsProcessing('propose-replacement');
      
      // S'assurer que la période est au bon format
      const period = assignment.period || assignment.type;
      
      console.log('Période utilisée pour le remplacement:', period, 'depuis', {
        period: assignment.period,
        type: assignment.type,
        assignment: assignment
      });
      
      // Vérifier si la période est valide
      if (!period) {
        console.error('Période manquante pour le remplacement:', assignment);
        throw new Error('Période manquante pour le remplacement');
      }
      
      if (!period || !['M', 'AM', 'S'].includes(period)) {
        throw new Error(`Période invalide: ${period}`);
      }
      
      // Convertir la chaîne de caractères en valeur de l'enum ShiftPeriod
      let periodEnum: ShiftPeriod;
      switch (period) {
        case 'M':
          periodEnum = ShiftPeriod.MORNING;
          break;
        case 'AM':
          periodEnum = ShiftPeriod.AFTERNOON;
          break;
        case 'S':
          periodEnum = ShiftPeriod.EVENING;
          break;
        default:
          throw new Error(`Période invalide: ${period}`);
      }
      
      const replacementId = await addDirectReplacement({
        userId: user.id,
        date: assignment.date,
        period: periodEnum,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        comment: comment || '',
        status: 'pending',
        lastModified: new Date().toISOString()
      });
      
      if (options.onSuccess) {
        options.onSuccess('Proposition aux remplaçants ajoutée avec succès');
      }
      
      return replacementId;
    } catch (error) {
      console.error('Error proposing direct replacement:', error);
      
      if (options.onError) {
        options.onError(`Erreur lors de l'ajout: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
      
      return null;
    } finally {
      setIsProcessing(null);
    }
  }, [user, options]);

  /**
   * Retire une proposition d'échange direct
   * @param exchangeId ID de l'échange à retirer
   * @param operationType Type d'opération (échange, cession, remplacement)
   */
  const removeExchange = useCallback(async (
    exchangeId: string,
    operationType?: OperationType
  ) => {
    try {
      setIsProcessing('remove');
      
      await removeDirectExchange(exchangeId, operationType);
      
      if (options.onSuccess) {
        options.onSuccess('Proposition retirée avec succès');
      }
    } catch (error) {
      console.error('Error removing direct exchange:', error);
      
      if (options.onError) {
        options.onError(`Erreur lors du retrait: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    } finally {
      setIsProcessing(null);
    }
  }, [options]);

  return {
    proposeDirectExchange,
    proposeDirectCession,
    proposeDirectReplacement,
    removeExchange,
    isProcessing
  };
};