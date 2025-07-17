import { collection, doc, addDoc, getDocs, updateDoc, query, orderBy, getDoc, onSnapshot } from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import type { ShiftExchange, ExchangeHistory, ExchangeValidationError, ExchangeType, ShiftAssignment } from '../../types/planning';
import { deleteDoc, Timestamp, where, runTransaction, serverTimestamp, Transaction, deleteField } from 'firebase/firestore';
import { format } from 'date-fns';
import { createReplacement, deleteReplacement } from './replacements';
import { checkDirectExchangeConflict, getConflictErrorMessage } from './exchange/conflictChecker';

// Constantes
const COLLECTIONS = {
  EXCHANGES: 'shift_exchanges',
  HISTORY: 'exchange_history',
  PLANNINGS: 'generated_plannings'
} as const;

// Pour les abonnements en temps réel
let exchangeHistoryListener: (() => void) | null = null;
let historySubscribers: Array<(history: ExchangeHistory[]) => void> = [];

// Utilitaires de validation
const validateExchangeData = (exchange: Partial<ShiftExchange>): void => {
  if (!exchange.userId || !exchange.date || !exchange.period || !exchange.shiftType || !exchange.timeSlot) {
    throw new Error('Données manquantes pour l\'échange de garde');
  }
};

const createExchangeValidationError = (
  code: ExchangeValidationError['code'], 
  message: string, 
  details?: Record<string, unknown>
): ExchangeValidationError => {
  const error = new Error(message) as ExchangeValidationError;
  error.code = code;
  error.details = details;
  return error;
};

// Vérifications de planning
const verifyPlanningAssignment = async (
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
): Promise<{
  hasAssignment: boolean;
  assignment?: ShiftAssignment;
  planning: Record<string, any>;
}> => {
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
      if (periodData.assignments && periodData.assignments[assignmentKey]) {
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

const verifyExchangeStatus = async (
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

// Cette fonction est utilisée dans d'autres parties du code
const verifyNoExistingExchange = async (
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

const verifyNoReceivedGuard = async (
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

// Fonctions principales
export const addShiftExchange = async (exchange: Omit<ShiftExchange, 'id' | 'createdAt'>): Promise<void> => {
  try {
    validateExchangeData(exchange);
    
    // Vérifier d'abord si la garde n'est pas déjà dans les échanges directs
    const directConflict = await checkDirectExchangeConflict(
      exchange.userId,
      exchange.date,
      exchange.period
    );
    
    if (directConflict.exists) {
      throw createExchangeValidationError(
        'GUARD_ALREADY_EXCHANGED',
        getConflictErrorMessage('direct')
      );
    }
    
    // Rechercher d'abord un échange existant pour cette garde
    const existingExchangeQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('date', '==', formatParisDate(new Date(exchange.date), 'yyyy-MM-dd')),
      where('period', '==', exchange.period),
      where('userId', '==', exchange.userId)
    );

    await runTransaction(db, async (transaction) => {
      // Vérifier la garde
      const { hasAssignment } = await verifyPlanningAssignment(
        transaction,
        exchange.userId,
        exchange.date,
        exchange.period,
        {
          expectedShiftType: exchange.shiftType,
          expectedTimeSlot: exchange.timeSlot,
          ignoreTimeSlotCheck: true // Plus flexible avec le timeSlot lors de l'ajout
        }
      );

      if (!hasAssignment) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'Cette garde n\'est plus disponible dans votre planning'
        );
      }

      // Rechercher un échange existant
      const existingExchangesSnapshot = await getDocs(existingExchangeQuery);
      const existingExchange = existingExchangesSnapshot.docs[0];

      if (existingExchange) {
        // Si un échange existe déjà, réutiliser le document
        const exchangeData = existingExchange.data();
        
        // Si l'échange n'est ni en statut 'cancelled' ni 'pending', c'est une erreur
        if (exchangeData.status !== 'cancelled' && exchangeData.status !== 'pending') {
          throw createExchangeValidationError(
            'INVALID_EXCHANGE',
            'Cette garde n\'est pas disponible pour l\'échange'
          );
        }
        
        // Mettre à jour l'échange existant
        transaction.update(existingExchange.ref, {
          status: 'pending',
          lastModified: serverTimestamp(),
          comment: exchange.comment || exchangeData.comment
        });
      } else {
        // Créer un nouvel échange si aucun n'existe
        const exchangeRef = doc(collection(db, COLLECTIONS.EXCHANGES));
        
        // S'assurer que la date est correctement formatée
        let formattedDate = exchange.date;
        if (typeof exchange.date === 'string' && exchange.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // La date est déjà au bon format
          formattedDate = exchange.date;
        } else {
          // Convertir et formater la date
          const dateObj = typeof exchange.date === 'string' ? new Date(exchange.date) : exchange.date;
          formattedDate = formatParisDate(dateObj, 'yyyy-MM-dd');
        }
        
        transaction.set(exchangeRef, {
          ...exchange,
          date: formattedDate,
          createdAt: Timestamp.now(),
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: [],
          operationTypes: ['exchange'] // Valeur par défaut pour operationTypes
        });
      }
    });
  } catch (error) {
    console.error('Error adding shift exchange:', error);
    throw error instanceof Error ? error : new Error('Erreur lors de l\'ajout de la garde à la bourse');
  }
};

export const validateShiftExchange = async (
  exchangeId: string,
  interestedUserId: string,
  validatedBy?: string
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: TOUTES LES LECTURES
      
      // 1. Vérifier l'échange - LECTURE
      const exchange = await verifyExchangeStatus(transaction, exchangeId);
      
      if (!exchange.interestedUsers?.includes(interestedUserId)) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'L\'utilisateur n\'est pas dans la liste des intéressés'
        );
      }
      
      // 2. Rechercher les autres échanges actifs pour cette même garde - LECTURE
      const conflictingExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', exchange.date),
        where('period', '==', exchange.period),
        where('userId', '==', exchange.userId),
        where('status', '==', 'pending')
      );
      
      const conflictingExchangesSnapshot = await getDocs(conflictingExchangesQuery);
      
      // 3. Rechercher les échanges où l'utilisateur intéressé offre une garde pour la même date/période - LECTURE
      const interestedUserExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', exchange.date),
        where('period', '==', exchange.period),
        where('userId', '==', interestedUserId),
        where('status', '==', 'pending')
      );
      
      const interestedUserExchangesSnapshot = await getDocs(interestedUserExchangesQuery);
      
      // 4. Vérifier les plannings - LECTURE
      const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchangeId);
      const originalUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, exchange.userId);
      const interestedUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, interestedUserId);
      
      // Précharger les documents de planning pour éviter les lectures dans la partie écriture
      const originalUserPlanningDoc = await transaction.get(originalUserPlanningRef);
      const interestedUserPlanningDoc = await transaction.get(interestedUserPlanningRef);
      
      const originalUserPlanningData = originalUserPlanningDoc.exists() ? originalUserPlanningDoc.data() : { assignments: {}, periods: {} };
      const interestedUserPlanningData = interestedUserPlanningDoc.exists() ? interestedUserPlanningDoc.data() : { assignments: {}, periods: {} };
      
      const { hasAssignment: hasOriginalAssignment, assignment: originalAssignment, planning: originalUserPlanning } = 
        await verifyPlanningAssignment(
          transaction,
          exchange.userId,
          exchange.date,
          exchange.period,
          {
            expectedShiftType: exchange.shiftType,
            expectedTimeSlot: exchange.timeSlot,
            ignoreTimeSlotCheck: true // Plus flexible avec le timeSlot lors de la validation
          }
        );

      const { hasAssignment: hasConflictingAssignment, assignment: conflictingAssignment, planning: interestedUserPlanning } = 
        await verifyPlanningAssignment(
          transaction,
          interestedUserId,
          exchange.date,
          exchange.period,
          { ignoreShiftTypeCheck: true, ignoreTimeSlotCheck: true }
        );

      if (!hasOriginalAssignment) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'La garde n\'est plus disponible dans le planning du médecin'
        );
      }

      // 5. Vérifier qu'il n'y a pas déjà reçu une garde sur cette période - LECTURE
      if (!hasConflictingAssignment) {
        await verifyNoReceivedGuard(
          transaction,
          exchange.date,
          exchange.period,
          interestedUserId
        );
      }

      // 6. Déterminer le type d'échange
      const exchangeType: ExchangeType = hasConflictingAssignment ? 'permutation' : 'simple';
      const assignmentKey = `${exchange.date}-${exchange.period}`;
      const historyRef = doc(db, COLLECTIONS.HISTORY, exchangeId);
      
      // Précharger les informations sur les périodes pour les mises à jour
      // Pour le planning de l'utilisateur original
      let originalUserPeriodId: string | null = null;
      if (originalUserPlanningData.assignments && originalUserPlanningData.assignments[assignmentKey] !== undefined) {
        // Utilise l'ancienne structure
        originalUserPeriodId = null;
      } else if (originalUserPlanningData.periods) {
        // Cherche dans la nouvelle structure
        for (const periodId in originalUserPlanningData.periods) {
          const periodData = originalUserPlanningData.periods[periodId];
          if (periodData && periodData.assignments && periodData.assignments[assignmentKey] !== undefined) {
            originalUserPeriodId = periodId;
            break;
          }
        }
        // Si aucune période ne contient l'assignation mais qu'il y a des périodes, utiliser la première
        if (originalUserPeriodId === null && Object.keys(originalUserPlanningData.periods).length > 0) {
          originalUserPeriodId = Object.keys(originalUserPlanningData.periods)[0];
        }
      }
      
      // Pour le planning de l'utilisateur intéressé
      let interestedUserPeriodId: string | null = null;
      if (interestedUserPlanningData.assignments && interestedUserPlanningData.assignments[assignmentKey] !== undefined) {
        // Utilise l'ancienne structure
        interestedUserPeriodId = null;
      } else if (interestedUserPlanningData.periods) {
        // Cherche dans la nouvelle structure
        for (const periodId in interestedUserPlanningData.periods) {
          const periodData = interestedUserPlanningData.periods[periodId];
          if (periodData && periodData.assignments && periodData.assignments[assignmentKey] !== undefined) {
            interestedUserPeriodId = periodId;
            break;
          }
        }
        // Si aucune période ne contient l'assignation mais qu'il y a des périodes, utiliser la première
        if (interestedUserPeriodId === null && Object.keys(interestedUserPlanningData.periods).length > 0) {
          interestedUserPeriodId = Object.keys(interestedUserPlanningData.periods)[0];
        }
      }
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 7. Marquer tous les autres échanges comme indisponibles - ÉCRITURE
      if (!conflictingExchangesSnapshot.empty) {
        for (const doc of conflictingExchangesSnapshot.docs) {
          if (doc.id !== exchangeId) {
            transaction.update(doc.ref, {
              status: 'unavailable',
              lastModified: serverTimestamp()
            });
          }
        }
      }
      
      // 8. Marquer tous les échanges de l'utilisateur intéressé comme indisponibles - ÉCRITURE
      if (!interestedUserExchangesSnapshot.empty) {
        for (const doc of interestedUserExchangesSnapshot.docs) {
          transaction.update(doc.ref, {
            status: 'unavailable',
            lastModified: serverTimestamp()
          });
        }
      }
      
      // 9. Mettre à jour les plannings - ÉCRITURE
      if (exchangeType === 'permutation') {
        // Pour une permutation, l'utilisateur intéressé doit avoir une garde sur ce créneau
        if (!hasConflictingAssignment || !conflictingAssignment) {
          throw createExchangeValidationError(
            'INVALID_EXCHANGE',
            'Impossible d\'effectuer une permutation car l\'utilisateur intéressé n\'a pas de garde sur ce créneau'
          );
        }

        console.log('Effectuant une permutation', { 
          originalAssignment, 
          conflictingAssignment,
          date: exchange.date,
          period: exchange.period
        });

        // IMPORTANT: Pour une permutation, nous devons d'abord supprimer les deux gardes originales
        // puis ajouter les nouvelles gardes pour éviter les conflits et les doublons

        // 1. Supprimer la garde originale de l'utilisateur A
        if (originalUserPlanningData.assignments && originalUserPlanningData.assignments[assignmentKey] !== undefined) {
          transaction.update(originalUserPlanningRef, {
            [`assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        } else if (originalUserPlanningData.periods && originalUserPeriodId) {
          transaction.update(originalUserPlanningRef, {
            [`periods.${originalUserPeriodId}.assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        }

        // 2. Supprimer la garde originale de l'utilisateur B
        if (interestedUserPlanningData.assignments && interestedUserPlanningData.assignments[assignmentKey] !== undefined) {
          transaction.update(interestedUserPlanningRef, {
            [`assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        } else if (interestedUserPlanningData.periods && interestedUserPeriodId) {
          transaction.update(interestedUserPlanningRef, {
            [`periods.${interestedUserPeriodId}.assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        }

        // 3. Ajouter la nouvelle garde à l'utilisateur A (garde de B)
        if (originalUserPlanningData.assignments) {
          transaction.update(originalUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              ...conflictingAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else if (originalUserPlanningData.periods && originalUserPeriodId) {
          transaction.update(originalUserPlanningRef, {
            [`periods.${originalUserPeriodId}.assignments.${assignmentKey}`]: {
              ...conflictingAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        }
        
        // 4. Ajouter la nouvelle garde à l'utilisateur B (garde de A)
        if (interestedUserPlanningData.assignments) {
          transaction.update(interestedUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else if (interestedUserPlanningData.periods && interestedUserPeriodId) {
          transaction.update(interestedUserPlanningRef, {
            [`periods.${interestedUserPeriodId}.assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else if (interestedUserPlanningData.periods && Object.keys(interestedUserPlanningData.periods).length > 0) {
          const firstPeriodId = Object.keys(interestedUserPlanningData.periods)[0];
          transaction.update(interestedUserPlanningRef, {
            [`periods.${firstPeriodId}.assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else {
          transaction.update(interestedUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        }
      } else {
        // Échange simple - l'utilisateur intéressé prend la garde
        
        // Supprimer la garde du planning de l'utilisateur original
        if (originalUserPlanningData.assignments && assignmentKey in originalUserPlanningData.assignments) {
          // Ancienne structure - mettre à null directement
          transaction.update(originalUserPlanningRef, {
            [`assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        } else if (originalUserPlanningData.periods && originalUserPeriodId) {
          // Nouvelle structure - utiliser la période identifiée
          transaction.update(originalUserPlanningRef, {
            [`periods.${originalUserPeriodId}.assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        }
        
        // Ajouter la garde au planning de l'utilisateur intéressé
        if (interestedUserPlanningData.assignments) {
          // Ancienne structure - ajouter directement
          transaction.update(interestedUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else if (interestedUserPlanningData.periods && interestedUserPeriodId) {
          // Nouvelle structure - utiliser la période identifiée
          transaction.update(interestedUserPlanningRef, {
            [`periods.${interestedUserPeriodId}.assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else if (interestedUserPlanningData.periods && Object.keys(interestedUserPlanningData.periods).length > 0) {
          // Fallback: utiliser la première période disponible
          const firstPeriodId = Object.keys(interestedUserPlanningData.periods)[0];
          transaction.update(interestedUserPlanningRef, {
            [`periods.${firstPeriodId}.assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        } else {
          // Fallback: créer une structure assignments si rien n'existe
          transaction.update(interestedUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              ...originalAssignment,
              date: exchange.date,
              period: exchange.period
            },
            uploadedAt: serverTimestamp()
          });
        }
      }
      
      // 10. Créer l'historique - ÉCRITURE
      if (!originalAssignment) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'La garde originale est introuvable'
        );
      }
      
      console.log('Périodes d\'origine identifiées:', {
        originalUserPeriodId,
        interestedUserPeriodId
      });
      
      transaction.set(historyRef, {
        originalUserId: exchange.userId,
        originalShiftType: originalAssignment.shiftType,
        newUserId: interestedUserId,
        newShiftType: conflictingAssignment?.shiftType || null,
        validatedBy,
        date: exchange.date,
        period: exchange.period,
        shiftType: originalAssignment.shiftType,
        timeSlot: originalAssignment.timeSlot,
        comment: exchange.comment || '',
        interestedUsers: exchange.interestedUsers || [],
        exchangedAt: createParisDate().toISOString(),
        createdAt: (() => {
          if (exchange.createdAt && typeof exchange.createdAt === 'object') {
            const timestamp = exchange.createdAt as Timestamp;
            if (typeof timestamp.toDate === 'function') {
              return firebaseTimestampToParisDate(timestamp).toISOString();
            }
          }
          return typeof exchange.createdAt === 'string' ? exchange.createdAt : createParisDate().toISOString();
        })(),
        isPermutation: exchangeType === 'permutation',
        status: 'completed',
        originalExchangeId: exchangeId, // Stocker l'ID de l'échange d'origine
        originalUserPeriodId: originalUserPeriodId || null, // Stocker la période d'origine de l'utilisateur original
        interestedUserPeriodId: interestedUserPeriodId || null // Stocker la période d'origine de l'utilisateur intéressé
      });
      
      // 11. Mettre à jour l'échange comme validé - ÉCRITURE
      transaction.update(exchangeRef, {
        status: 'validated',
        lastModified: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error validating shift exchange:', { 
      error, 
      exchangeId, 
      interestedUserId,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// Fonction utilitaire pour trouver une assignation dans un planning, quelle que soit sa structure
const findAssignmentInPlanning = (
  planningData: any,
  assignmentKey: string
): any | null => {
  if (!planningData) return null;
  
  // Vérifier dans l'ancienne structure (assignments directement dans le document)
  if (planningData.assignments && planningData.assignments[assignmentKey]) {
    return planningData.assignments[assignmentKey];
  }
  
  // Vérifier dans la nouvelle structure (periods)
  if (planningData.periods) {
    for (const periodId in planningData.periods) {
      const periodData = planningData.periods[periodId];
      if (periodData && 
          periodData.assignments && 
          periodData.assignments[assignmentKey]) {
        return periodData.assignments[assignmentKey];
      }
    }
  }
  
  return null;
};

// Fonction utilitaire pour trouver la période qui contient une assignation
const findPeriodWithAssignment = (
  planningData: any,
  assignmentKey: string
): string | null => {
  if (!planningData || !planningData.periods) return null;
  
  for (const periodId in planningData.periods) {
    const periodData = planningData.periods[periodId];
    if (periodData && 
        periodData.assignments && 
        periodData.assignments[assignmentKey]) {
      return periodId;
    }
  }
  
  // Si aucune période ne contient l'assignation mais qu'il y a des périodes, utiliser la première
  if (Object.keys(planningData.periods).length > 0) {
    return Object.keys(planningData.periods)[0];
  }
  
  return null;
};

// Fonction utilitaire pour supprimer une assignation d'un planning
const removeAssignmentFromPlanningData = (
  planningRef: any,
  planningData: any,
  assignmentKey: string,
  transaction: any
): void => {
  // Vérifier si le planning utilise l'ancienne structure
  if (planningData.assignments && assignmentKey in planningData.assignments) {
    // Ancienne structure - supprimer complètement le champ
    transaction.update(planningRef, {
      [`assignments.${assignmentKey}`]: deleteField(),
      uploadedAt: serverTimestamp()
    });
    console.log(`Suppression complète de l'assignation ${assignmentKey} dans l'ancienne structure`);
    return;
  }
  
  // Vérifier si le planning utilise la nouvelle structure
  if (planningData.periods) {
    const periodId = findPeriodWithAssignment(planningData, assignmentKey);
    if (periodId) {
      // Nouvelle structure - supprimer complètement dans la période identifiée
      transaction.update(planningRef, {
        [`periods.${periodId}.assignments.${assignmentKey}`]: deleteField(),
        uploadedAt: serverTimestamp()
      });
      console.log(`Suppression complète de l'assignation ${assignmentKey} dans la période ${periodId}`);
      return;
    }
  }
  
  console.log(`Aucune assignation ${assignmentKey} trouvée à supprimer`);
};

// Fonction utilitaire pour ajouter une assignation à un planning
const addAssignmentToPlanningData = (
  planningRef: any,
  planningData: any,
  assignmentKey: string,
  assignmentData: any,
  transaction: any,
  specificPeriodId?: string | null
): void => {
  // Vérifier d'abord si l'assignation existe déjà
  const existingAssignment = findAssignmentInPlanning(planningData, assignmentKey);
  if (existingAssignment) {
    console.warn(`L'assignation ${assignmentKey} existe déjà dans le planning, suppression pour éviter la duplication`);
    removeAssignmentFromPlanningData(planningRef, planningData, assignmentKey, transaction);
  }
  
  // Vérifier si le planning utilise la nouvelle structure avec periods
  if (planningData.periods) {
    // Utiliser la période spécifique si fournie, sinon trouver une période appropriée
    let periodId = specificPeriodId || findPeriodWithAssignment(planningData, assignmentKey);
    
    // Si aucune période n'est trouvée, essayer de trouver une période par date
    if (!periodId) {
      // Extraire la date de la clé d'assignation (format: YYYY-MM-DD-PERIOD)
      const dateParts = assignmentKey.split('-');
      if (dateParts.length >= 3) {
        const dateStr = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
        const assignmentDate = new Date(dateStr);
        
        // Parcourir toutes les périodes pour trouver celle qui contient cette date
        for (const pid in planningData.periods) {
          const period = planningData.periods[pid];
          if (period.startDate && period.endDate) {
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            
            if (assignmentDate >= startDate && assignmentDate <= endDate) {
              periodId = pid;
              break;
            }
          }
        }
      }
    }
    
    // Si toujours pas de période trouvée mais qu'il y a des périodes, utiliser la première
    if (!periodId && Object.keys(planningData.periods).length > 0) {
      periodId = Object.keys(planningData.periods)[0];
    }
    
    if (periodId) {
      // Nouvelle structure - ajouter dans la période identifiée
      transaction.update(planningRef, {
        [`periods.${periodId}.assignments.${assignmentKey}`]: assignmentData,
        uploadedAt: serverTimestamp()
      });
      console.log(`Ajout de l'assignation ${assignmentKey} dans la période ${periodId}`);
      return; // Sortir de la fonction après avoir ajouté l'assignation dans la période
    }
  }
  
  // Fallback: si aucune période n'est trouvée, mettre à jour la structure assignments principale
  // Cela ne devrait arriver que si le planning n'a pas de périodes du tout
  console.warn(`Aucune période trouvée pour l'assignation ${assignmentKey}, utilisation de la structure assignments principale`);
  transaction.update(planningRef, {
    [`assignments.${assignmentKey}`]: assignmentData,
    uploadedAt: serverTimestamp()
  });
};

export const revertToExchange = async (historyId: string): Promise<void> => {
  try {
    // Récupérer d'abord l'historique pour obtenir les informations nécessaires
    const historyRef = doc(db, COLLECTIONS.HISTORY, historyId);
    const historyDoc = await getDoc(historyRef);
    
    if (!historyDoc.exists()) {
      throw createExchangeValidationError(
        'INVALID_EXCHANGE',
        'Historique de l\'échange non trouvé'
      );
    }
    
    const history = historyDoc.data() as ExchangeHistory;
    
    // Journaliser les informations de l'échange pour le débogage
    console.log('Début de l\'annulation de l\'échange:', {
      historyId,
      originalUserId: history.originalUserId,
      newUserId: history.newUserId,
      date: history.date,
      period: history.period,
      shiftType: history.shiftType,
      isPermutation: history.isPermutation,
      originalUserPeriodId: history.originalUserPeriodId,
      interestedUserPeriodId: history.interestedUserPeriodId
    });
    
    // Exécuter la transaction avec un délai pour s'assurer que Firebase a le temps de traiter
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: TOUTES LES LECTURES
      
      // 1. Récupérer l'historique à nouveau dans la transaction - LECTURE
      const historyDocInTransaction = await transaction.get(historyRef);
      
      if (!historyDocInTransaction.exists()) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Historique de l\'échange non trouvé dans la transaction'
        );
      }
      
      // 2. Récupérer les plannings actuels - LECTURE
      const originalUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, history.originalUserId);
      const newUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, history.newUserId);
      
      const [originalUserPlanningDoc, newUserPlanningDoc] = await Promise.all([
        transaction.get(originalUserPlanningRef),
        transaction.get(newUserPlanningRef)
      ]);
      
      if (!originalUserPlanningDoc.exists() || !newUserPlanningDoc.exists()) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'Planning non trouvé'
        );
      }
      
      // 3. Vérifier si l'échange d'origine existe - LECTURE
      let exchangeRef;
      let originalExchangeDoc = null;
      
      if (history.originalExchangeId) {
        exchangeRef = doc(db, COLLECTIONS.EXCHANGES, history.originalExchangeId);
        originalExchangeDoc = await transaction.get(exchangeRef);
      }
      
      // 4. Récupérer les échanges désactivés sur la même date/période - LECTURE
      const unavailableExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', history.date),
        where('period', '==', history.period),
        where('status', '==', 'unavailable')
      );
      
      const unavailableExchangesSnapshot = await getDocs(unavailableExchangesQuery);
      
      // Extraire les données des plannings
      const originalUserPlanningData = originalUserPlanningDoc.exists() ? originalUserPlanningDoc.data() : { assignments: {}, periods: {} };
      const newUserPlanningData = newUserPlanningDoc.exists() ? newUserPlanningDoc.data() : { assignments: {}, periods: {} };
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 5. Restaurer les gardes
      const assignmentKey = `${history.date}-${history.period}`;
      
      // Vérifier si les gardes existent déjà pour éviter les duplications
      const originalUserHasAssignment = findAssignmentInPlanning(originalUserPlanningData, assignmentKey);
      const newUserHasAssignment = findAssignmentInPlanning(newUserPlanningData, assignmentKey);
      
      console.log('État initial des plannings avant restauration:', {
        originalUserHasAssignment: !!originalUserHasAssignment,
        newUserHasAssignment: !!newUserHasAssignment,
        isPermutation: history.isPermutation,
        originalUserPlanningStructure: Object.keys(originalUserPlanningData)
      });
      
      // Normaliser la structure des données pour s'assurer qu'elle est cohérente
      // Récupérer la structure originale à partir de l'historique ou utiliser une structure standard
      const standardFields = {
        shiftType: history.originalShiftType,
        timeSlot: history.timeSlot,
        period: history.period,
        date: history.date,
        status: "archived", // Ajouter le champ status qui était présent dans les données originales
        type: history.period // Ajouter le champ type qui était présent dans les données originales
      };
      
      // Utiliser les périodes stockées dans l'historique si elles existent
      const originalUserPeriodId = history.originalUserPeriodId || findPeriodWithAssignment(originalUserPlanningData, assignmentKey);
      const interestedUserPeriodId = history.interestedUserPeriodId || (history.isPermutation ? findPeriodWithAssignment(newUserPlanningData, assignmentKey) : null);
      
      console.log('Périodes identifiées pour la restauration:', {
        originalUserPeriodId,
        interestedUserPeriodId,
        fromHistory: {
          originalUserPeriodId: history.originalUserPeriodId,
          interestedUserPeriodId: history.interestedUserPeriodId
        }
      });
      
      if (history.isPermutation) {
        console.log('Annulation d\'une permutation', {
          originalShiftType: history.originalShiftType,
          newShiftType: history.newShiftType,
          date: history.date,
          period: history.period
        });

        // Pour l'utilisateur d'origine, restaurer sa garde initiale avec la structure normalisée
        const originalAssignmentData = { ...standardFields };
        
        // Supprimer d'abord pour éviter les doublons
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
        addAssignmentToPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          originalAssignmentData,
          transaction,
          originalUserPeriodId // Utiliser explicitement la période d'origine
        );
        
        // Pour le nouvel utilisateur, restaurer sa garde initiale (s'il y en avait une)
        if (history.newShiftType) {
          const newAssignmentData = {
            ...standardFields,
            shiftType: history.newShiftType
          };
          
          // Supprimer d'abord pour éviter les doublons
          removeAssignmentFromPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            transaction
          );
          
          // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
          addAssignmentToPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            newAssignmentData,
            transaction,
            interestedUserPeriodId // Utiliser explicitement la période d'origine
          );
        } else {
          // Si pas de garde initiale, s'assurer qu'elle est supprimée du planning
          removeAssignmentFromPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            transaction
          );
          
          // S'assurer que la garde est également supprimée de la structure assignments
          if (newUserPlanningData.assignments) {
            transaction.update(newUserPlanningRef, {
              [`assignments.${assignmentKey}`]: null,
              uploadedAt: serverTimestamp()
            });
            console.log(`Suppression directe de assignments.${assignmentKey} pour le nouvel utilisateur`);
          }
        }
      } else {
        // Restaurer la garde pour un échange simple
        console.log('Annulation d\'un échange simple', {
          originalShiftType: history.originalShiftType,
          date: history.date,
          period: history.period
        });
        
        // Restaurer la garde pour l'utilisateur d'origine avec la structure normalisée
        const originalAssignmentData = { ...standardFields };
        
        // Supprimer d'abord pour éviter les doublons
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
        addAssignmentToPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          originalAssignmentData,
          transaction,
          originalUserPeriodId // Utiliser explicitement la période d'origine
        );
        
        // Ne pas mettre à jour la structure assignments directement pour éviter les doublons
        
        // Supprimer la garde du planning du nouveau propriétaire
        removeAssignmentFromPlanningData(
          newUserPlanningRef,
          newUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // S'assurer que la garde est également supprimée de la structure assignments
        if (newUserPlanningData.assignments) {
          transaction.update(newUserPlanningRef, {
            [`assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
          console.log(`Suppression directe de assignments.${assignmentKey} pour le nouvel utilisateur`);
        }
      }
      
      // 6. Réactiver l'échange d'origine ou en créer un nouveau
      if (history.originalExchangeId && originalExchangeDoc && originalExchangeDoc.exists() && exchangeRef) {
        // Réactiver l'échange d'origine en conservant toutes les propriétés importantes
        console.log('Réactivation de l\'échange d\'origine:', history.originalExchangeId);
        
        // Récupérer les données originales de l'échange
        const originalExchangeData = originalExchangeDoc.data();
        
        // Mettre à jour l'échange avec les données originales + nouvelles données
        transaction.update(exchangeRef, {
          userId: history.originalUserId,
          date: history.date,
          period: history.period,
          shiftType: history.shiftType,
          timeSlot: history.timeSlot,
          comment: history.comment || '',
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: history.interestedUsers || [],
          // Conserver les types d'opérations originaux
          operationTypes: originalExchangeData.operationTypes || ['exchange'],
          // Conserver le type d'échange original
          exchangeType: originalExchangeData.exchangeType || 'bag',
          // Conserver les autres propriétés importantes
          proposedToReplacements: originalExchangeData.proposedToReplacements || false
        });
      } else {
        // Créer un nouvel échange avec toutes les propriétés nécessaires
        exchangeRef = doc(collection(db, COLLECTIONS.EXCHANGES));
        transaction.set(exchangeRef, {
          userId: history.originalUserId,
          date: history.date,
          period: history.period,
          shiftType: history.shiftType,
          timeSlot: history.timeSlot,
          comment: history.comment || '',
          createdAt: Timestamp.now(),
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: history.interestedUsers || [],
          operationTypes: ['exchange'], // Valeur par défaut pour operationTypes
          exchangeType: 'bag', // Valeur par défaut pour le type d'échange
          proposedToReplacements: false // Par défaut, pas proposé aux remplaçants
        });
      }
      
      // 7. Supprimer l'entrée d'historique
      transaction.delete(historyRef);
      
      // 8. Réactiver les échanges désactivés
      if (!unavailableExchangesSnapshot.empty) {
        for (const doc of unavailableExchangesSnapshot.docs) {
          const exchangeData = doc.data();
          if (exchangeData.status === 'unavailable') {
            transaction.update(doc.ref, {
              status: 'pending',
              lastModified: serverTimestamp()
            });
          }
        }
      }
      
      // Journalisation de l'état final attendu (sans effectuer de lectures supplémentaires)
      console.log('Annulation terminée - État attendu des plannings:', {
        originalUserShouldHaveAssignment: true, // L'utilisateur original doit toujours récupérer sa garde
        newUserShouldHaveAssignment: history.isPermutation && !!history.newShiftType, // Le nouvel utilisateur ne garde sa garde que dans le cas d'une permutation
        isPermutation: history.isPermutation
      });
    });
    
    // Ajouter un délai après la transaction pour s'assurer que les modifications sont propagées
    await new Promise(resolve => setTimeout(resolve, 1000)); // Augmenté à 1000ms pour donner plus de temps
    
    console.log('Annulation de l\'échange terminée avec succès, délai de synchronisation appliqué');
  } catch (error) {
    console.error('Error reverting exchange:', error);
    throw error;
  }
};

export const toggleInterest = async (exchangeId: string, userId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: TOUTES LES LECTURES
      
      // 1. Vérifier l'état de l'échange
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
          'Cette garde a déjà été échangée dans une autre transaction'
        );
      }
      
      if (exchange.status !== 'pending') {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange n\'est plus disponible'
        );
      }
      
      const interestedUsers = exchange.interestedUsers || [];
      const isInterested = interestedUsers.includes(userId);
      
      // 2. Vérifier s'il n'y a pas déjà une garde reçue sur cette période
      if (!isInterested) {
        await verifyNoReceivedGuard(
          transaction,
          exchange.date,
          exchange.period,
          userId
        );
      }
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 3. Mettre à jour la liste des intéressés
      transaction.update(exchangeRef, {
        interestedUsers: isInterested
          ? interestedUsers.filter(id => id !== userId)
          : [...interestedUsers, userId],
        lastModified: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error toggling interest:', error);
    throw error;
  }
};

// Cache des échanges avec durée de validité
const EXCHANGES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const exchangesCache = {
  data: null as ShiftExchange[] | null,
  timestamp: 0
};

// Fonctions pour finaliser tous les échanges ou les restaurer
export const finalizeAllExchanges = async (): Promise<void> => {
  try {
    // Chercher tous les échanges en attente
    const pendingExchangesQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('status', '==', 'pending')
    );
    
    const pendingExchangesSnapshot = await getDocs(pendingExchangesQuery);
    
    // Marquer chaque échange comme indisponible
    await runTransaction(db, async (transaction) => {
      pendingExchangesSnapshot.docs.forEach(doc => {
        transaction.update(doc.ref, {
          status: 'unavailable',
          lastModified: serverTimestamp(),
          finalizedAt: serverTimestamp()
        });
      });
    });
    
    console.log(`${pendingExchangesSnapshot.size} échanges finalisés`);
  } catch (error) {
    console.error('Erreur lors de la finalisation des échanges:', error);
    throw error;
  }
};

export const restorePendingExchanges = async (): Promise<void> => {
  try {
    // Chercher tous les échanges indisponibles
    const unavailableExchangesQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('status', '==', 'unavailable')
    );
    
    const unavailableExchangesSnapshot = await getDocs(unavailableExchangesQuery);
    
    // Récupérer l'historique des échanges validés
    const historyQuery = query(
      collection(db, COLLECTIONS.HISTORY),
      where('status', '==', 'completed')
    );
    
    const historySnapshot = await getDocs(historyQuery);
    
    // Créer un ensemble de clés date-période pour les échanges validés
    const validatedKeys = new Set(
      historySnapshot.docs.map(doc => {
        const history = doc.data();
        return `${history.date}-${history.period}`;
      })
    );
    
    // Restaurer chaque échange au statut 'pending' s'il n'a pas d'entrée dans l'historique
    await runTransaction(db, async (transaction) => {
      let restoredCount = 0;
      
      unavailableExchangesSnapshot.docs.forEach(doc => {
        const exchange = doc.data();
        
        // Vérifier si l'échange a une entrée dans l'historique
        if (exchange.date && exchange.period) {
          const key = `${exchange.date}-${exchange.period}`;
          
          // Si l'échange n'a pas d'entrée dans l'historique, le restaurer
          if (!validatedKeys.has(key)) {
            transaction.update(doc.ref, {
              status: 'pending',
              lastModified: serverTimestamp(),
              finalizedAt: null
            });
            restoredCount++;
          }
        }
      });
      
      console.log(`${restoredCount} échanges restaurés`);
    });
  } catch (error) {
    console.error('Erreur lors de la restauration des échanges:', error);
    throw error;
  }
};

export const getShiftExchanges = async (): Promise<ShiftExchange[]> => {
  try {
    // Vérifier si les données en cache sont encore valides
    const now = Date.now();
    if (exchangesCache.data && now - exchangesCache.timestamp < EXCHANGES_CACHE_DURATION) {
      return exchangesCache.data;
    }

    const today = formatParisDate(createParisDate(), 'yyyy-MM-dd');
    // Essayer d'abord avec l'index composé
    try {
      const q = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '>=', today),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('date', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const exchanges = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = createParisDate().toISOString();
        
        if (data.createdAt && typeof data.createdAt === 'object') {
          const timestamp = data.createdAt as any;
          if (typeof timestamp.toDate === 'function') {
            createdAt = firebaseTimestampToParisDate(timestamp).toISOString();
          }
        } else if (typeof data.createdAt === 'string') {
          createdAt = data.createdAt;
        }
        
        const result: ShiftExchange = {
          date: data.date || '',
          period: data.period as ('M' | 'AM' | 'S'),
          userId: data.userId || '',
          shiftType: data.shiftType || '',
          timeSlot: data.timeSlot || '',
          status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable'),
          createdAt: createdAt,
          lastModified: data.lastModified || createdAt,
          interestedUsers: Array.isArray(data.interestedUsers) ? data.interestedUsers : [],
          comment: data.comment || '',
          id: doc.id,
          exchangeType: 'bag' as const,
          operationTypes: Array.isArray(data.operationTypes) ? data.operationTypes : 
                         data.operationType === 'both' ? ['exchange', 'give'] : 
                         data.operationType ? [data.operationType] : ['exchange']
        };
        
        return result;
      });

      // Mettre à jour le cache
      exchangesCache.data = exchanges;
      exchangesCache.timestamp = now;
      
      return exchanges;
    } catch (indexError: any) {
      // Si l'index n'est pas encore prêt, faire une requête simple
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.EXCHANGES),
          where('status', 'in', ['pending', 'unavailable'])
        );
        const querySnapshot = await getDocs(simpleQuery);
        
        const exchanges = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            let createdAt = createParisDate().toISOString();
            
            if (data.createdAt && typeof data.createdAt === 'object') {
              const timestamp = data.createdAt as any;
              if (typeof timestamp.toDate === 'function') {
                createdAt = firebaseTimestampToParisDate(timestamp).toISOString();
              }
            } else if (typeof data.createdAt === 'string') {
              createdAt = data.createdAt;
            }
            
              const result: ShiftExchange = {
                date: data.date || '',
                period: data.period as ('M' | 'AM' | 'S'),
                userId: data.userId || '',
                shiftType: data.shiftType || '',
                timeSlot: data.timeSlot || '',
                status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable'),
                createdAt: createdAt,
                lastModified: data.lastModified || createdAt,
                interestedUsers: Array.isArray(data.interestedUsers) ? data.interestedUsers : [],
                comment: data.comment || '',
                id: doc.id,
                exchangeType: 'bag' as const,
                operationTypes: Array.isArray(data.operationTypes) ? data.operationTypes : 
                               data.operationType === 'both' ? ['exchange', 'give'] : 
                               data.operationType ? [data.operationType] : ['exchange']
            };
            
            return result;
          })
          .filter(exchange => 'date' in exchange && typeof exchange.date === 'string' && exchange.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));

        // Mettre à jour le cache
        exchangesCache.data = exchanges;
        exchangesCache.timestamp = now;
          
        return exchanges;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error getting shift exchanges:', error);
    return []; // Retourner un tableau vide au lieu de throw
  }
};

// Cache pour l'historique des échanges
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const historyCache = {
  data: null as ExchangeHistory[] | null,
  timestamp: 0
};

export const getExchangeHistory = async (): Promise<ExchangeHistory[]> => {
  try {
    // Vérifier si les données en cache sont encore valides
    const now = Date.now();
    if (historyCache.data && now - historyCache.timestamp < CACHE_DURATION) {
      return historyCache.data;
    }

    try {
      // Pas besoin de filtrer sur status=="completed" puisqu'on supprime maintenant les entrées "reverted"
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        orderBy('exchangedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const history = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const result: ExchangeHistory = {
          date: data.date || '',
          period: data.period || '',
          exchangedAt: data.exchangedAt || createParisDate().toISOString(),
          originalUserId: data.originalUserId || '',
          newUserId: data.newUserId || '',
          shiftType: data.shiftType || '',
          timeSlot: data.timeSlot || '',
          originalShiftType: data.originalShiftType || '',
          newShiftType: data.newShiftType || null,
          isPermutation: !!data.isPermutation,
          status: 'completed', // Puisqu'on supprime les "reverted", on a que des "completed"
          id: doc.id
        };
        return result;
      });

      // Mettre à jour le cache
      historyCache.data = history;
      historyCache.timestamp = now;
      
      return history;
    } catch (indexError: any) {
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.HISTORY)
        );
        const querySnapshot = await getDocs(simpleQuery);
        
        const history = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            const result: ExchangeHistory = {
              date: data.date || '',
              period: data.period || '',
              exchangedAt: data.exchangedAt || createParisDate().toISOString(),
              originalUserId: data.originalUserId || '',
              newUserId: data.newUserId || '',
              shiftType: data.shiftType || '',
              timeSlot: data.timeSlot || '',
              originalShiftType: data.originalShiftType || '',
              newShiftType: data.newShiftType || null,
              isPermutation: !!data.isPermutation,
              status: 'completed', // Puisqu'on supprime les "reverted", on a que des "completed"
              id: doc.id
            };
            return result;
          })
          .filter(history => 'exchangedAt' in history && typeof history.exchangedAt === 'string')
          .sort((a, b) => b.exchangedAt.localeCompare(a.exchangedAt));

        // Mettre à jour le cache
        historyCache.data = history;
        historyCache.timestamp = now;
          
        return history;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error getting exchange history:', error);
    return []; // Retourner un tableau vide au lieu de throw
  }
};

export const removeUserFromExchange = async (exchangeId: string, userId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: LECTURES
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
          'Cette garde a déjà été échangée dans une autre transaction'
        );
      }
      
      if (exchange.status !== 'pending') {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange n\'est plus disponible'
        );
      }
      
      const interestedUsers = exchange.interestedUsers || [];
      
      // PARTIE 2: ÉCRITURES
      transaction.update(exchangeRef, {
        interestedUsers: interestedUsers.filter(id => id !== userId),
        lastModified: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error removing user from exchange:', error);
    throw error;
  }
};

export const subscribeToExchangeHistory = (
  callback: (history: ExchangeHistory[]) => void
): (() => void) => {
  // Ajouter ce callback à la liste des abonnés
  historySubscribers.push(callback);
  
  // Ajouter des logs pour le débogage
  console.log('Setting up exchange history subscription, subscribers:', historySubscribers.length);
  
  // Si on n'a pas encore d'écouteur actif, en créer un
  if (!exchangeHistoryListener) {
    try {
      // Pas besoin de filtrer sur status=="completed" puisqu'on supprime maintenant les entrées "reverted"
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        orderBy('exchangedAt', 'desc')
      );
      
      exchangeHistoryListener = onSnapshot(q, { includeMetadataChanges: true }, (querySnapshot) => {
        console.log('Exchange history snapshot received, docs:', querySnapshot.docs.length, 'metadata changes:', querySnapshot.metadata.hasPendingWrites);
        
        // Vérifier si les données proviennent du cache ou du serveur
        if (querySnapshot.metadata.fromCache) {
          console.log('History data from cache, waiting for server data...');
        }
        
        const history = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const result: ExchangeHistory = {
            date: data.date || '',
            period: data.period || '',
            exchangedAt: data.exchangedAt || createParisDate().toISOString(),
            originalUserId: data.originalUserId || '',
            newUserId: data.newUserId || '',
            shiftType: data.shiftType || '',
            timeSlot: data.timeSlot || '',
            originalShiftType: data.originalShiftType || '',
            newShiftType: data.newShiftType || null,
            isPermutation: !!data.isPermutation,
            status: 'completed', // Puisqu'on supprime les "reverted", on a que des "completed"
            id: doc.id
          };
          return result;
        });
        
        console.log('Processed history entries:', history.length);
        
        // Mettre à jour le cache
        historyCache.data = history;
        historyCache.timestamp = Date.now();
        
        // Notifier tous les abonnés
        historySubscribers.forEach(subscriber => {
          console.log('Notifying history subscriber');
          subscriber(history);
        });
      }, (error) => {
        console.error('Error in exchange history subscription:', error);
        // En cas d'erreur, essayer de recharger les données depuis l'API
        getExchangeHistory().then(data => {
          console.log('Fallback to API call after history subscription error, got:', data.length, 'entries');
          // Mettre à jour le cache
          historyCache.data = data;
          historyCache.timestamp = Date.now();
          // Notifier les abonnés
          historySubscribers.forEach(subscriber => subscriber(data));
        }).catch(apiError => {
          console.error('Even API fallback failed for history:', apiError);
          historySubscribers.forEach(subscriber => subscriber([]));
        });
      });
    } catch (error) {
      console.error('Error setting up exchange history subscription:', error);
      // En cas d'erreur, essayer de recharger les données depuis l'API
      getExchangeHistory().then(data => {
        console.log('Fallback to API call after history subscription setup error, got:', data.length, 'entries');
        // Mettre à jour le cache
        historyCache.data = data;
        historyCache.timestamp = Date.now();
        // Notifier les abonnés
        historySubscribers.forEach(subscriber => subscriber(data));
      }).catch(apiError => {
        console.error('Even API fallback failed for history:', apiError);
        historySubscribers.forEach(subscriber => subscriber([]));
      });
    }
  }
  
  // Retourner une fonction pour se désabonner
  return () => {
    console.log('Unsubscribing from exchange history');
    historySubscribers = historySubscribers.filter(sub => sub !== callback);
    
    // Si plus d'abonnés, arrêter l'écouteur
    if (historySubscribers.length === 0 && exchangeHistoryListener) {
      console.log('No more history subscribers, removing listener');
      exchangeHistoryListener();
      exchangeHistoryListener = null;
    }
  };
};

export const subscribeToShiftExchanges = (
  callback: (exchanges: ShiftExchange[]) => void
): (() => void) => {
  try {
    const today = formatParisDate(createParisDate(), 'yyyy-MM-dd');
    
    // Ajouter des logs pour le débogage
    console.log('Setting up shift exchanges subscription, current date:', today);
    
    // Essayer d'abord avec l'index composé
    try {
      // Modifier la requête pour inclure les changements récents
      // Ne pas filtrer par date pour s'assurer de capturer tous les changements
      const q = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('lastModified', 'desc') // Trier par dernière modification pour voir les changements récents en premier
      );
      
      // Utiliser onSnapshot avec option includeMetadataChanges pour capturer toutes les modifications
      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (querySnapshot) => {
        console.log('Shift exchanges snapshot received, docs:', querySnapshot.docs.length, 'metadata changes:', querySnapshot.metadata.hasPendingWrites);
        
        // Vérifier si les données proviennent du cache ou du serveur
        if (querySnapshot.metadata.fromCache) {
          console.log('Data from cache, waiting for server data...');
        }
        
        const exchanges = querySnapshot.docs.map(doc => {
          const data = doc.data();
          let createdAt = createParisDate().toISOString();
          
          if (data.createdAt && typeof data.createdAt === 'object') {
            const timestamp = data.createdAt as any;
            if (typeof timestamp.toDate === 'function') {
              createdAt = firebaseTimestampToParisDate(timestamp).toISOString();
            }
          } else if (typeof data.createdAt === 'string') {
            createdAt = data.createdAt;
          }
          
          const result: ShiftExchange = {
            date: data.date || '',
            period: data.period as ('M' | 'AM' | 'S'),
            userId: data.userId || '',
            shiftType: data.shiftType || '',
            timeSlot: data.timeSlot || '',
            status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable'),
            createdAt: createdAt,
            lastModified: data.lastModified || createdAt,
            interestedUsers: Array.isArray(data.interestedUsers) ? data.interestedUsers : [],
            comment: data.comment || '',
            id: doc.id,
            // Ajouter les propriétés manquantes pour la compatibilité avec le type ShiftExchange
            exchangeType: (data.exchangeType || 'bag') as ('bag' | 'direct'),
            // operationTypes est la source unique de vérité pour les types d'opérations
            operationTypes: Array.isArray(data.operationTypes) ? data.operationTypes : 
                           data.operationType === 'both' ? ['exchange', 'give'] : 
                           data.operationType ? [data.operationType] : ['exchange'],
            proposedToReplacements: !!data.proposedToReplacements
          };
          
          return result;
        })
        // Filtrer les échanges par date après avoir récupéré tous les documents
        // pour s'assurer de capturer les changements récents
        .filter(exchange => exchange.date >= today)
        // Trier d'abord par statut puis par date
        .sort((a, b) => {
          // D'abord par statut (pending avant unavailable)
          if (a.status === 'pending' && b.status === 'unavailable') return -1;
          if (a.status === 'unavailable' && b.status === 'pending') return 1;
          // Ensuite par date
          return a.date.localeCompare(b.date);
        });
        
        console.log('Processed exchanges:', exchanges.length);
        
        // Mettre à jour le cache
        exchangesCache.data = exchanges;
        exchangesCache.timestamp = Date.now();
        
        // Appeler le callback avec les échanges
        callback(exchanges);
      }, (error) => {
        console.error('Error in shift exchanges subscription:', error);
        // En cas d'erreur, essayer de recharger les données depuis l'API
        getShiftExchanges().then(data => {
          console.log('Fallback to API call after subscription error, got:', data.length, 'exchanges');
          callback(data);
        }).catch(apiError => {
          console.error('Even API fallback failed:', apiError);
          callback([]);
        });
      });
      
      // Retourner la fonction de désabonnement
      return unsubscribe;
    } catch (indexError: any) {
      // Si l'index n'est pas encore prêt, faire une requête simple
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query for subscription');
        const simpleQuery = query(
          collection(db, COLLECTIONS.EXCHANGES),
          where('status', 'in', ['pending', 'unavailable'])
        );
        
        const unsubscribe = onSnapshot(simpleQuery, { includeMetadataChanges: true }, (querySnapshot) => {
          console.log('Simple query snapshot received, docs:', querySnapshot.docs.length);
          
          const exchanges = querySnapshot.docs
            .map(doc => {
              const data = doc.data();
              let createdAt = createParisDate().toISOString();
              
              if (data.createdAt && typeof data.createdAt === 'object') {
                const timestamp = data.createdAt as any;
                if (typeof timestamp.toDate === 'function') {
                  createdAt = firebaseTimestampToParisDate(timestamp).toISOString();
                }
              } else if (typeof data.createdAt === 'string') {
                createdAt = data.createdAt;
              }
              
              const result: ShiftExchange = {
                date: data.date || '',
                period: data.period as ('M' | 'AM' | 'S'),
                userId: data.userId || '',
                shiftType: data.shiftType || '',
                timeSlot: data.timeSlot || '',
                status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable'),
                createdAt: createdAt,
                lastModified: data.lastModified || createdAt,
                interestedUsers: Array.isArray(data.interestedUsers) ? data.interestedUsers : [],
                comment: data.comment || '',
                id: doc.id,
                exchangeType: 'bag' as const,
                operationTypes: Array.isArray(data.operationTypes) ? data.operationTypes : 
                               data.operationType === 'both' ? ['exchange', 'give'] : 
                               data.operationType ? [data.operationType] : ['exchange']
              };
              
              return result;
            })
            .filter(exchange => 'date' in exchange && typeof exchange.date === 'string' && exchange.date >= today)
            .sort((a, b) => {
              // D'abord par statut (pending avant unavailable)
              if (a.status === 'pending' && b.status === 'unavailable') return -1;
              if (a.status === 'unavailable' && b.status === 'pending') return 1;
              // Ensuite par date
              return a.date.localeCompare(b.date);
            });
          
          console.log('Processed exchanges (simple query):', exchanges.length);
          
          // Mettre à jour le cache
          exchangesCache.data = exchanges;
          exchangesCache.timestamp = Date.now();
          
          // Appeler le callback avec les échanges
          callback(exchanges);
        }, (error) => {
          console.error('Error in shift exchanges subscription (simple query):', error);
          // En cas d'erreur, essayer de recharger les données depuis l'API
          getShiftExchanges().then(data => {
            console.log('Fallback to API call after subscription error, got:', data.length, 'exchanges');
            callback(data);
          }).catch(apiError => {
            console.error('Even API fallback failed:', apiError);
            callback([]);
          });
        });
        
        return unsubscribe;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error subscribing to shift exchanges:', error);
    // En cas d'erreur, essayer de recharger les données depuis l'API
    getShiftExchanges().then(data => {
      console.log('Fallback to API call after subscription setup error, got:', data.length, 'exchanges');
      callback(data);
    }).catch(apiError => {
      console.error('Even API fallback failed:', apiError);
      callback([]);
    });
    
    return () => {}; // Fonction de désabonnement vide en cas d'erreur
  }
};

export const removeShiftExchange = async (exchangeId: string): Promise<void> => {
  try {
    const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchangeId);
    const exchangeDoc = await getDoc(exchangeRef);
    
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
        'Cette garde a déjà été échangée dans une autre transaction'
      );
    }
    
    if (exchange.status !== 'pending' && exchange.status !== 'cancelled') { 
      throw createExchangeValidationError(
        'INVALID_EXCHANGE',
        'Cet échange n\'est plus disponible'
      );
    }
    
    // Supprimer complètement le document au lieu de changer son statut
    await deleteDoc(exchangeRef);
  } catch (error) {
    console.error('Error removing shift exchange:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erreur lors de la suppression de l\'échange');
  }
};

// Fonction pour proposer une garde à des utilisateurs spécifiques
export const proposeToReplacements = async (
  exchange: ShiftExchange,
  userIds: string[] = [],
  ignoreStatusCheck: boolean = false
): Promise<void> => {
  if (!exchange || typeof exchange !== 'object') {
    throw new Error('Invalid exchange object');
  }
  
  try {
    await runTransaction(db, async (transaction) => {
      // Vérifier l'échange
      const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchange.id);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Échange non trouvé'
        );
      }
      
      const currentExchange = exchangeDoc.data() as ShiftExchange;
      
      // Vérifier le statut seulement si ignoreStatusCheck est false
      if (!ignoreStatusCheck && currentExchange.status !== 'pending') {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange n\'est plus disponible'
        );
      }
      
      // Si userIds est fourni, mettre à jour la liste des utilisateurs intéressés
      if (Array.isArray(userIds) && userIds.length > 0) {
        const currentInterestedUsers = currentExchange.interestedUsers || [];
        const newInterestedUsers = [...new Set([...currentInterestedUsers, ...userIds])];
        
        transaction.update(exchangeRef, {
          interestedUsers: newInterestedUsers,
          lastModified: serverTimestamp()
        });
      } else {
        // Si aucun utilisateur spécifié, juste marquer l'échange comme proposé aux remplaçants
        transaction.update(exchangeRef, {
          proposedToReplacements: true,
          lastModified: serverTimestamp()
        });
      }
    });
    
    // Créer un document dans la collection "remplacements"
    if (!exchange.proposedToReplacements) {
      await createReplacement(exchange);
    }
  } catch (error) {
    console.error('Error proposing to replacements:', error);
    throw error;
  }
};

/**
 * Annule une proposition aux remplaçants
 * @param exchange L'échange dont on veut annuler la proposition
 * @param ignoreStatusCheck Ignorer la vérification du statut de l'échange
 * @returns Promise<void>
 */
export const cancelPropositionToReplacements = async (
  exchange: ShiftExchange,
  ignoreStatusCheck: boolean = false
): Promise<void> => {
  if (!exchange || typeof exchange !== 'object') {
    throw new Error('Invalid exchange object');
  }
  
  try {
    await runTransaction(db, async (transaction) => {
      // Vérifier l'échange
      const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchange.id);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Échange non trouvé'
        );
      }
      
      const currentExchange = exchangeDoc.data() as ShiftExchange;
      
      // Vérifier le statut seulement si ignoreStatusCheck est false
      if (!ignoreStatusCheck && currentExchange.status !== 'pending') {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange n\'est plus disponible'
        );
      }
      
      // Mettre à jour l'échange pour retirer la proposition
      transaction.update(exchangeRef, {
        proposedToReplacements: false,
        lastModified: serverTimestamp()
      });
    });
    
    // Supprimer le document de la collection "remplacements"
    if (exchange.proposedToReplacements) {
      await deleteReplacement(exchange.id);
    }
  } catch (error) {
    console.error('Error canceling proposition to replacements:', error);
    throw error;
  }
};
