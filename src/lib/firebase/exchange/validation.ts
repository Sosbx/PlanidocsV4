import { collection, getDocs, query, where, Transaction, getDoc } from 'firebase/firestore';
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

/**
 * Interface pour le résultat de vérification de cohérence
 */
export interface ExchangeCoherenceResult {
  isCoherent: boolean;
  exchange: ShiftExchange;
  discrepancies?: {
    dateDiscrepancy?: {
      exchangeDate: string;
      planningDate: string;
    };
    periodDiscrepancy?: {
      exchangePeriod: string;
      planningPeriod: string;
    };
    shiftTypeDiscrepancy?: {
      exchangeShiftType: string;
      planningShiftType: string;
    };
    timeSlotDiscrepancy?: {
      exchangeTimeSlot: string;
      planningTimeSlot: string;
    };
    notInPlanning?: boolean;
  };
  planningAssignment?: ShiftAssignment;
}

/**
 * Vérifie la cohérence entre un échange et le planning de l'utilisateur
 * @param exchange L'échange à vérifier
 * @param userId ID de l'utilisateur (optionnel, utilise exchange.userId par défaut)
 * @returns Résultat de la vérification de cohérence
 */
export const verifyExchangeCoherence = async (
  exchange: ShiftExchange,
  userId?: string
): Promise<ExchangeCoherenceResult> => {
  const targetUserId = userId || exchange.userId;
  
  try {
    // Récupérer le planning de l'utilisateur
    const planningRef = doc(db, COLLECTIONS.PLANNINGS, targetUserId);
    const planningDoc = await getDoc(planningRef);
    
    if (!planningDoc.exists()) {
      return {
        isCoherent: false,
        exchange,
        discrepancies: { notInPlanning: true }
      };
    }
    
    const planning = planningDoc.data();
    const assignmentKey = `${exchange.date}-${exchange.period}`;
    
    // Debug pour AVIT
    if (targetUserId === 'naRhqjhzpWhcOMCZWCqftT8ArbH3') {
      console.log('[COHERENCE CHECK AVIT] Vérification de cohérence pour:', {
        exchangeId: exchange.id,
        exchangeDate: exchange.date,
        exchangePeriod: exchange.period,
        assignmentKey
      });
    }
    
    // Rechercher l'assignment dans toutes les structures possibles
    let assignment: ShiftAssignment | null = null;
    let foundInPeriod: string | null = null;
    
    // Vérifier l'ancienne structure (assignments directement dans le document)
    if (planning?.assignments && planning.assignments[assignmentKey]) {
      assignment = planning.assignments[assignmentKey];
      foundInPeriod = 'root';
    }
    
    // Vérifier la nouvelle structure (par périodes)
    if (!assignment && planning?.periods) {
      for (const periodId in planning.periods) {
        const periodData = planning.periods[periodId];
        if (periodData?.assignments && periodData.assignments[assignmentKey]) {
          assignment = periodData.assignments[assignmentKey];
          foundInPeriod = periodId;
          break;
        }
      }
    }
    
    // Si pas d'assignment trouvé
    if (!assignment) {
      // Vérifier si c'est un problème de décalage de date (cas AVIT)
      const possibleKeys = [
        assignmentKey, // Date exacte
        `${adjustDate(exchange.date, -1)}-${exchange.period}`, // Date -1 jour
        `${adjustDate(exchange.date, 1)}-${exchange.period}`, // Date +1 jour
      ];
      
      if (targetUserId === 'naRhqjhzpWhcOMCZWCqftT8ArbH3') {
        console.log('[COHERENCE CHECK AVIT] Recherche avec clés alternatives:', possibleKeys);
      }
      
      // Rechercher avec les dates alternatives
      for (const altKey of possibleKeys) {
        if (altKey === assignmentKey) continue; // Déjà vérifié
        
        // Vérifier l'ancienne structure
        if (planning?.assignments && planning.assignments[altKey]) {
          const altDate = altKey.split('-').slice(0, 3).join('-');
          return {
            isCoherent: false,
            exchange,
            discrepancies: {
              dateDiscrepancy: {
                exchangeDate: exchange.date,
                planningDate: altDate
              }
            },
            planningAssignment: planning.assignments[altKey]
          };
        }
        
        // Vérifier la nouvelle structure
        if (planning?.periods) {
          for (const periodId in planning.periods) {
            const periodData = planning.periods[periodId];
            if (periodData?.assignments && periodData.assignments[altKey]) {
              const altDate = altKey.split('-').slice(0, 3).join('-');
              return {
                isCoherent: false,
                exchange,
                discrepancies: {
                  dateDiscrepancy: {
                    exchangeDate: exchange.date,
                    planningDate: altDate
                  }
                },
                planningAssignment: periodData.assignments[altKey]
              };
            }
          }
        }
      }
      
      // Aucune garde trouvée même avec les dates alternatives
      return {
        isCoherent: false,
        exchange,
        discrepancies: { notInPlanning: true }
      };
    }
    
    // Vérifier la cohérence des données
    const discrepancies: ExchangeCoherenceResult['discrepancies'] = {};
    let hasDiscrepancies = false;
    
    // Vérifier le type de garde
    if (assignment.shiftType !== exchange.shiftType) {
      discrepancies.shiftTypeDiscrepancy = {
        exchangeShiftType: exchange.shiftType,
        planningShiftType: assignment.shiftType
      };
      hasDiscrepancies = true;
    }
    
    // Vérifier le créneau horaire (comparaison flexible)
    const assignmentStartTime = assignment.timeSlot.split(' - ')[0];
    const exchangeStartTime = exchange.timeSlot.split(' - ')[0];
    
    if (assignmentStartTime !== exchangeStartTime) {
      discrepancies.timeSlotDiscrepancy = {
        exchangeTimeSlot: exchange.timeSlot,
        planningTimeSlot: assignment.timeSlot
      };
      hasDiscrepancies = true;
    }
    
    // Log pour AVIT
    if (targetUserId === 'naRhqjhzpWhcOMCZWCqftT8ArbH3') {
      console.log('[COHERENCE CHECK AVIT] Résultat:', {
        isCoherent: !hasDiscrepancies,
        foundInPeriod,
        assignment,
        discrepancies: hasDiscrepancies ? discrepancies : null
      });
    }
    
    return {
      isCoherent: !hasDiscrepancies,
      exchange,
      discrepancies: hasDiscrepancies ? discrepancies : undefined,
      planningAssignment: assignment
    };
    
  } catch (error) {
    console.error('Erreur lors de la vérification de cohérence:', error);
    return {
      isCoherent: false,
      exchange,
      discrepancies: { notInPlanning: true }
    };
  }
};

/**
 * Fonction utilitaire pour ajuster une date
 * @param dateStr Date au format YYYY-MM-DD
 * @param days Nombre de jours à ajouter (négatif pour soustraire)
 * @returns Date ajustée au format YYYY-MM-DD
 */
function adjustDate(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
