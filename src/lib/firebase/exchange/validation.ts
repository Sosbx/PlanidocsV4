import { collection, getDocs, query, where, Transaction } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS, createExchangeValidationError, PlanningVerificationResult } from './types';
import type { ShiftExchange, ShiftAssignment } from './types';
import { doc } from 'firebase/firestore';

/**
 * Valide les données d'un échange
 * @param exchange Données de l'échange à valider
 * @throws Error si les données sont invalides
 */
export const validateExchangeData = (exchange: Partial<ShiftExchange>): void => {
  if (!exchange.userId || !exchange.date || !exchange.period || !exchange.shiftType || !exchange.timeSlot) {
    throw new Error('Données manquantes pour l\'échange de garde');
  }
};

/**
 * Vérifie si un utilisateur a déjà un échange en cours pour une garde spécifique
 * @param transaction Transaction Firestore
 * @param date Date de la garde
 * @param period Période de la garde
 * @param userId ID de l'utilisateur
 * @throws ExchangeValidationError si un échange existe déjà
 */
export const verifyNoExistingExchange = async (
  transaction: Transaction,
  date: string,
  period: string,
  userId: string
): Promise<void> => {
  const exchangesRef = collection(db, COLLECTIONS.EXCHANGES);
  const q = query(
    exchangesRef,
    where('date', '==', date),
    where('period', '==', period),
    where('userId', '==', userId),
    where('status', '==', 'pending')
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    throw createExchangeValidationError(
      'GUARD_ALREADY_EXCHANGED',
      'Un échange existe déjà pour cette garde'
    );
  }
};

/**
 * Vérifie si un utilisateur a déjà reçu une garde sur une période spécifique
 * @param transaction Transaction Firestore
 * @param date Date de la garde
 * @param period Période de la garde
 * @param userId ID de l'utilisateur
 * @throws ExchangeValidationError si l'utilisateur a déjà reçu une garde
 */
export const verifyNoReceivedGuard = async (
  transaction: Transaction,
  date: string,
  period: string,
  userId: string
): Promise<void> => {
  const historyRef = collection(db, COLLECTIONS.HISTORY);
  const q = query(
    historyRef,
    where('date', '==', date),
    where('period', '==', period),
    where('newUserId', '==', userId),
    where('status', '==', 'completed')
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    throw createExchangeValidationError(
      'USER_HAS_GUARD',
      'Vous avez déjà reçu une garde sur cette période via un autre échange'
    );
  }
};

/**
 * Vérifie l'assignation d'une garde dans le planning d'un utilisateur
 * @param transaction Transaction Firestore
 * @param userId ID de l'utilisateur
 * @param date Date de la garde
 * @param period Période de la garde
 * @param options Options de vérification
 * @returns Résultat de la vérification
 * @throws ExchangeValidationError si la garde ne correspond pas aux attentes
 */
export const verifyPlanningAssignment = async (
  transaction: Transaction,
  userId: string,
  date: string,
  period: string,
  options: {
    expectedShiftType?: string;
    expectedTimeSlot?: string;
    ignoreShiftTypeCheck?: boolean;
    ignoreTimeSlotCheck?: boolean;
  } = {}
): Promise<PlanningVerificationResult> => {
  const planningRef = doc(db, COLLECTIONS.PLANNINGS, userId);
  const planningDoc = await transaction.get(planningRef);
  
  if (!planningDoc.exists()) {
    return { hasAssignment: false, planning: { assignments: {} } };
  }
  
  const planning = planningDoc.data();
  const assignmentKey = `${date}-${period}`;
  
  // Vérifier d'abord si le planning utilise l'ancienne structure (assignments directement dans le document)
  if (planning?.assignments) {
    const assignment = planning.assignments[assignmentKey];
    
    if (assignment && options.expectedShiftType && options.expectedTimeSlot && !options.ignoreShiftTypeCheck) {
      // Vérifier le type de garde (toujours strict)
      if (assignment.shiftType !== options.expectedShiftType) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'Le poste a été modifié et ne correspond plus à l\'échange',
          { assignment, expected: { shiftType: options.expectedShiftType, timeSlot: options.expectedTimeSlot } }
        );
      }
      
      // Plus flexible avec le timeSlot - comparer juste les heures de début
      if (!options.ignoreTimeSlotCheck) {
        const assignmentStartTime = assignment.timeSlot.split(' - ')[0];
        const expectedStartTime = options.expectedTimeSlot.split(' - ')[0];
        
        if (assignmentStartTime !== expectedStartTime) {
          throw createExchangeValidationError(
            'GUARD_NOT_FOUND',
            'L\'horaire de début de garde a été modifié et ne correspond plus à l\'échange',
            { assignment, expected: { shiftType: options.expectedShiftType, timeSlot: options.expectedTimeSlot } }
          );
        }
      }
      
      return {
        hasAssignment: true,
        assignment,
        planning
      };
    }
    
    if (assignment) {
      return {
        hasAssignment: true,
        assignment,
        planning
      };
    }
  }
  
  // Si on n'a pas trouvé d'assignment avec l'ancienne structure, vérifier la nouvelle structure par période
  if (planning?.periods) {
    // Parcourir toutes les périodes pour trouver l'assignment
    for (const periodId in planning.periods) {
      const periodData = planning.periods[periodId];
      if (periodData && periodData.assignments && periodData.assignments[assignmentKey]) {
        const assignment = periodData.assignments[assignmentKey];
        
        if (assignment && options.expectedShiftType && options.expectedTimeSlot && !options.ignoreShiftTypeCheck) {
          // Vérifier le type de garde (toujours strict)
          if (assignment.shiftType !== options.expectedShiftType) {
            throw createExchangeValidationError(
              'GUARD_NOT_FOUND',
              'Le poste a été modifié et ne correspond plus à l\'échange',
              { assignment, expected: { shiftType: options.expectedShiftType, timeSlot: options.expectedTimeSlot } }
            );
          }
          
          // Plus flexible avec le timeSlot - comparer juste les heures de début
          if (!options.ignoreTimeSlotCheck) {
            const assignmentStartTime = assignment.timeSlot.split(' - ')[0];
            const expectedStartTime = options.expectedTimeSlot.split(' - ')[0];
            
            if (assignmentStartTime !== expectedStartTime) {
              throw createExchangeValidationError(
                'GUARD_NOT_FOUND',
                'L\'horaire de début de garde a été modifié et ne correspond plus à l\'échange',
                { assignment, expected: { shiftType: options.expectedShiftType, timeSlot: options.expectedTimeSlot } }
              );
            }
          }
          
          return {
            hasAssignment: true,
            assignment,
            planning
          };
        }
        
        if (assignment) {
          return {
            hasAssignment: true,
            assignment,
            planning
          };
        }
      }
    }
  }
  
  // Si on arrive ici, c'est qu'on n'a pas trouvé d'assignment
  return { 
    hasAssignment: false, 
    planning 
  };
};

/**
 * Vérifie le statut d'un échange
 * @param transaction Transaction Firestore
 * @param exchangeId ID de l'échange
 * @returns L'échange vérifié
 * @throws ExchangeValidationError si l'échange n'est pas valide
 */
export const verifyExchangeStatus = async (
  transaction: Transaction,
  exchangeId: string
): Promise<ShiftExchange> => {
  const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchangeId);
  const exchangeDoc = await transaction.get(exchangeRef);
  
  if (!exchangeDoc.exists()) {
    throw createExchangeValidationError(
      'INVALID_EXCHANGE',
      'Échange non trouvé'
    );
  }
  
  const exchange = exchangeDoc.data() as ShiftExchange;
  
  if (exchange.status === 'unavailable') {
    throw createExchangeValidationError(
      'EXCHANGE_UNAVAILABLE',
      'Cette garde a déjà été échangée dans une autre transaction',
      { 
        date: exchange.date, 
        period: exchange.period,
        shiftType: exchange.shiftType 
      }
    );
  }
  
  if (exchange.status !== 'pending') {
    throw createExchangeValidationError(
      'INVALID_EXCHANGE',
      'Cet échange n\'est plus disponible'
    );
  }
  
  return { ...exchange, id: exchangeDoc.id };
};
