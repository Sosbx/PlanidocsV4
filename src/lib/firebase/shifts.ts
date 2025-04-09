import { collection, doc, addDoc, getDocs, updateDoc, query, orderBy, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { ShiftExchange, ExchangeHistory, ExchangeValidationError, ExchangeType, ShiftAssignment } from '../../types/planning';
import { deleteDoc, Timestamp, where, runTransaction, serverTimestamp, Transaction } from 'firebase/firestore';
import { format } from 'date-fns';
import { createReplacement, deleteReplacement } from './replacements';

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
  const assignments = planning?.assignments || {};
  const assignmentKey = `${date}-${period}`;
  const assignment = assignments[assignmentKey];
  
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
  }
  
  return {
    hasAssignment: Boolean(assignment),
    assignment,
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
    
    // Rechercher d'abord un échange existant pour cette garde
    const existingExchangeQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('date', '==', format(new Date(exchange.date), 'yyyy-MM-dd')),
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
        transaction.set(exchangeRef, {
          ...exchange,
          date: format(new Date(exchange.date), 'yyyy-MM-dd'),
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

        // Permutation - échanger les deux gardes
        transaction.update(originalUserPlanningRef, {
          [`assignments.${assignmentKey}`]: {
            ...conflictingAssignment,
            date: exchange.date,
            period: exchange.period
          },
          uploadedAt: serverTimestamp()
        });
        
        transaction.update(interestedUserPlanningRef, {
          [`assignments.${assignmentKey}`]: {
            ...originalAssignment,
            date: exchange.date,
            period: exchange.period
          },
          uploadedAt: serverTimestamp()
        });
      } else {
        // Échange simple - l'utilisateur intéressé prend la garde
        transaction.update(originalUserPlanningRef, {
          [`assignments.${assignmentKey}`]: null,
          uploadedAt: serverTimestamp()
        });
        
        transaction.update(interestedUserPlanningRef, {
          [`assignments.${assignmentKey}`]: {
            ...originalAssignment,
            date: exchange.date,
            period: exchange.period
          },
          uploadedAt: serverTimestamp()
        });
      }
      
      // 10. Créer l'historique - ÉCRITURE
      if (!originalAssignment) {
        throw createExchangeValidationError(
          'GUARD_NOT_FOUND',
          'La garde originale est introuvable'
        );
      }
      
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
        exchangedAt: new Date().toISOString(),
        createdAt: (() => {
          if (exchange.createdAt && typeof exchange.createdAt === 'object') {
            const timestamp = exchange.createdAt as Timestamp;
            if (typeof timestamp.toDate === 'function') {
              return timestamp.toDate().toISOString();
            }
          }
          return typeof exchange.createdAt === 'string' ? exchange.createdAt : new Date().toISOString();
        })(),
        isPermutation: exchangeType === 'permutation',
        status: 'completed',
        originalExchangeId: exchangeId // Stocker l'ID de l'échange d'origine
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

export const revertToExchange = async (historyId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: TOUTES LES LECTURES
      
      // 1. Récupérer l'historique - LECTURE
      const historyRef = doc(db, COLLECTIONS.HISTORY, historyId);
      const historyDoc = await transaction.get(historyRef);
      
      if (!historyDoc.exists()) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Historique de l\'échange non trouvé'
        );
      }
      
      const history = historyDoc.data() as ExchangeHistory;
      
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
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 5. Restaurer les gardes
      const assignmentKey = `${history.date}-${history.period}`;
      
      if (history.isPermutation) {
        console.log('Annulation d\'une permutation', {
          originalShiftType: history.originalShiftType,
          newShiftType: history.newShiftType,
          date: history.date,
          period: history.period
        });

        // Pour l'utilisateur d'origine, restaurer sa garde initiale
        transaction.update(originalUserPlanningRef, {
          [`assignments.${assignmentKey}`]: {
            shiftType: history.originalShiftType,
            timeSlot: history.timeSlot,
            period: history.period,
            date: history.date
          },
          uploadedAt: serverTimestamp()
        });
        
        // Pour le nouvel utilisateur, restaurer sa garde initiale (s'il y en avait une)
        if (history.newShiftType) {
          transaction.update(newUserPlanningRef, {
            [`assignments.${assignmentKey}`]: {
              shiftType: history.newShiftType,
              timeSlot: history.timeSlot,
              period: history.period,
              date: history.date
            },
            uploadedAt: serverTimestamp()
          });
        } else {
          // Si pas de garde initiale, supprimer cette garde du planning
          transaction.update(newUserPlanningRef, {
            [`assignments.${assignmentKey}`]: null,
            uploadedAt: serverTimestamp()
          });
        }
      } else {
        // Restaurer la garde pour un échange simple
        transaction.update(originalUserPlanningRef, {
          [`assignments.${assignmentKey}`]: {
            shiftType: history.originalShiftType,
            timeSlot: history.timeSlot,
            period: history.period,
            date: history.date
          },
          uploadedAt: serverTimestamp()
        });
        
        // Supprimer la garde du planning du nouveau propriétaire
        transaction.update(newUserPlanningRef, {
          [`assignments.${assignmentKey}`]: null,
          uploadedAt: serverTimestamp()
        });
      }
      
      // 6. Réactiver l'échange d'origine ou en créer un nouveau
      if (history.originalExchangeId && originalExchangeDoc && originalExchangeDoc.exists() && exchangeRef) {
        // Réactiver l'échange d'origine
        console.log('Réactivation de l\'échange d\'origine:', history.originalExchangeId);
        transaction.update(exchangeRef, {
          userId: history.originalUserId,
          date: history.date,
          period: history.period,
          shiftType: history.shiftType,
          timeSlot: history.timeSlot,
          comment: history.comment || '',
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: history.interestedUsers || []
        });
      } else {
        // Créer un nouvel échange
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
          operationTypes: ['exchange'] // Valeur par défaut pour operationTypes
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
    });
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

    const today = format(new Date(), 'yyyy-MM-dd');
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
        let createdAt = new Date().toISOString();
        
        if (data.createdAt && typeof data.createdAt === 'object') {
          const timestamp = data.createdAt as any;
          if (typeof timestamp.toDate === 'function') {
            createdAt = timestamp.toDate().toISOString();
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
            let createdAt = new Date().toISOString();
            
            if (data.createdAt && typeof data.createdAt === 'object') {
              const timestamp = data.createdAt as any;
              if (typeof timestamp.toDate === 'function') {
                createdAt = timestamp.toDate().toISOString();
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
          exchangedAt: data.exchangedAt || new Date().toISOString(),
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
              exchangedAt: data.exchangedAt || new Date().toISOString(),
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
  
  // Si on n'a pas encore d'écouteur actif, en créer un
  if (!exchangeHistoryListener) {
    try {
      // Pas besoin de filtrer sur status=="completed" puisqu'on supprime maintenant les entrées "reverted"
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        orderBy('exchangedAt', 'desc')
      );
      
      exchangeHistoryListener = onSnapshot(q, (querySnapshot) => {
        const history = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const result: ExchangeHistory = {
            date: data.date || '',
            period: data.period || '',
            exchangedAt: data.exchangedAt || new Date().toISOString(),
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
        historyCache.timestamp = Date.now();
        
        // Notifier tous les abonnés
        historySubscribers.forEach(subscriber => subscriber(history));
      }, (error) => {
        console.error('Error in exchange history subscription:', error);
        // Notifier les abonnés avec une liste vide en cas d'erreur
        historySubscribers.forEach(subscriber => subscriber([]));
      });
    } catch (error) {
      console.error('Error setting up exchange history subscription:', error);
    }
  }
  
  // Retourner une fonction pour se désabonner
  return () => {
    historySubscribers = historySubscribers.filter(sub => sub !== callback);
    
    // Si plus d'abonnés, arrêter l'écouteur
    if (historySubscribers.length === 0 && exchangeHistoryListener) {
      exchangeHistoryListener();
      exchangeHistoryListener = null;
    }
  };
};

export const subscribeToShiftExchanges = (
  callback: (exchanges: ShiftExchange[]) => void
): (() => void) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Essayer d'abord avec l'index composé
    try {
      const q = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '>=', today),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('date', 'asc')
      );
      
      // Utiliser onSnapshot pour s'abonner aux changements en temps réel
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const exchanges = querySnapshot.docs.map(doc => {
          const data = doc.data();
          let createdAt = new Date().toISOString();
          
          if (data.createdAt && typeof data.createdAt === 'object') {
            const timestamp = data.createdAt as any;
            if (typeof timestamp.toDate === 'function') {
              createdAt = timestamp.toDate().toISOString();
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
        });
        
        // Mettre à jour le cache
        exchangesCache.data = exchanges;
        exchangesCache.timestamp = Date.now();
        
        // Appeler le callback avec les échanges
        callback(exchanges);
      }, (error) => {
        console.error('Error in shift exchanges subscription:', error);
        callback([]);
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
        
        const unsubscribe = onSnapshot(simpleQuery, (querySnapshot) => {
          const exchanges = querySnapshot.docs
            .map(doc => {
              const data = doc.data();
              let createdAt = new Date().toISOString();
              
              if (data.createdAt && typeof data.createdAt === 'object') {
                const timestamp = data.createdAt as any;
                if (typeof timestamp.toDate === 'function') {
                  createdAt = timestamp.toDate().toISOString();
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
          exchangesCache.timestamp = Date.now();
          
          // Appeler le callback avec les échanges
          callback(exchanges);
        }, (error) => {
          console.error('Error in shift exchanges subscription (simple query):', error);
          callback([]);
        });
        
        return unsubscribe;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error subscribing to shift exchanges:', error);
    callback([]);
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
