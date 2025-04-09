import { collection, doc, addDoc, getDocs, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from './config';
import type { ShiftExchange, ExchangeHistory, ExchangeValidationError, ExchangeType } from '../../types/planning';
import { deleteDoc, Timestamp, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';

// Constantes
const COLLECTIONS = {
  EXCHANGES: 'shift_exchanges',
  HISTORY: 'exchange_history',
  PLANNINGS: 'generated_plannings'
} as const;

// Utilitaires de validation
const validateExchangeData = (exchange: Partial<ShiftExchange>): void => {
  if (!exchange.userId || !exchange.date || !exchange.period || !exchange.shiftType || !exchange.timeSlot) {
    throw new Error('Données manquantes pour l\'échange de garde');
  }
};

const createExchangeValidationError = (
  code: ExchangeValidationError['code'], 
  message: string, 
  details?: any
): ExchangeValidationError => {
  const error = new Error(message) as ExchangeValidationError;
  error.code = code;
  error.details = details;
  return error;
};

// Vérifications de planning
const verifyPlanningAssignment = async (
  transaction: any,
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
  planning: any;
}> => {
  const planningRef = doc(db, COLLECTIONS.PLANNINGS, userId);
  const planningDoc = await transaction.get(planningRef);
  
  if (!planningDoc.exists()) {
    return { hasAssignment: false, planning: { assignments: {} } };
  }
  
  const planning = planningDoc.data();
  const assignments = planning.assignments || {};
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
  transaction: any,
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
  
  return { id: exchangeDoc.id, ...exchange };
};

const verifyNoExistingExchange = async (
  transaction: any,
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
  transaction: any,
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
          interestedUsers: []
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
        createdAt: exchange.createdAt instanceof Timestamp ? 
          exchange.createdAt.toDate().toISOString() : 
          exchange.createdAt || new Date().toISOString(),
        isPermutation: exchangeType === 'permutation',
        status: 'completed'
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
      
      // 2. Vérifier que l'échange n'a pas déjà été annulé - LECTURE
      if (history.status === 'reverted') {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange a déjà été annulé'
        );
      }

      // 3. Récupérer les plannings actuels - LECTURE
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
      
      const originalUserPlanning = originalUserPlanningDoc.data();
      const newUserPlanning = newUserPlanningDoc.data();
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 4. Restaurer les gardes
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
      
      // 5. Créer un nouvel échange dans la bourse
      const newExchangeRef = doc(collection(db, COLLECTIONS.EXCHANGES));
      transaction.set(newExchangeRef, {
        userId: history.originalUserId,
        date: history.date,
        period: history.period,
        shiftType: history.shiftType,
        timeSlot: history.timeSlot,
        comment: history.comment || '',
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        status: 'pending',
        interestedUsers: history.interestedUsers || []
      });
      
      // 6. Marquer l'historique comme annulé
      transaction.update(historyRef, {
        status: 'reverted',
        lastModified: serverTimestamp()
      });
      
      // 7. Réactiver les échanges désactivés sur la même date/période
      // Rechercher les échanges désactivés
      const unavailableExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', history.date),
        where('period', '==', history.period),
        where('status', '==', 'unavailable')
      );
      
      const unavailableExchangesSnapshot = await getDocs(unavailableExchangesQuery);
      
      // Réactiver ces échanges
      if (!unavailableExchangesSnapshot.empty) {
        for (const doc of unavailableExchangesSnapshot.docs) {
          // Ne pas réactiver les échanges qui ont été validés ou annulés
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

export const getShiftExchanges = async (): Promise<ShiftExchange[]> => {
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
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt instanceof Timestamp 
          ? doc.data().createdAt.toDate().toISOString()
          : doc.data().createdAt
      })) as ShiftExchange[];
    } catch (indexError) {
      // Si l'index n'est pas encore prêt, faire une requête simple
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.EXCHANGES),
          where('status', 'in', ['pending', 'unavailable'])
        );
        const querySnapshot = await getDocs(simpleQuery);
        return querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt instanceof Timestamp 
              ? doc.data().createdAt.toDate().toISOString()
              : doc.data().createdAt
          }))
          .filter(exchange => exchange.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date)) as ShiftExchange[];
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error getting shift exchanges:', error);
    return []; // Retourner un tableau vide au lieu de throw
  }
};

export const getExchangeHistory = async (): Promise<ExchangeHistory[]> => {
  try {
    try {
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        where('status', '==', 'completed'),
        orderBy('exchangedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExchangeHistory[];
    } catch (indexError) {
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.HISTORY),
          where('status', '==', 'completed')
        );
        const querySnapshot = await getDocs(simpleQuery);
        return querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort((a, b) => b.exchangedAt.localeCompare(a.exchangedAt)) as ExchangeHistory[];
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

    await runTransaction(db, async (transaction) => {
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
      
      // Si l'échange était annulé, le remettre en pending, sinon l'annuler
      transaction.update(exchangeRef, {
        status: exchange.status === 'cancelled' ? 'pending' : 'cancelled',
        lastModified: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error removing shift exchange:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erreur lors de la suppression de l\'échange');
  }
};