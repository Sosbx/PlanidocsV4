import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { COLLECTIONS, createExchangeValidationError, ShiftExchange } from './types';
import { verifyExchangeStatus, verifyPlanningAssignment } from './validation';
import { removeAssignmentFromPlanningData, addAssignmentToPlanningData } from './planning-operations';

/**
 * Valide un échange de garde
 * @param exchangeId ID de l'échange à valider
 * @param interestedUserId ID de l'utilisateur intéressé
 * @param validatedBy ID de l'utilisateur qui valide l'échange (optionnel)
 * @throws Error si la validation échoue
 */
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

      // 6. Déterminer le type d'échange
      const exchangeType = hasConflictingAssignment ? 'permutation' : 'simple';
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
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );

        // 2. Supprimer la garde originale de l'utilisateur B
        removeAssignmentFromPlanningData(
          interestedUserPlanningRef,
          interestedUserPlanningData,
          assignmentKey,
          transaction
        );

        // 3. Ajouter la nouvelle garde à l'utilisateur A (garde de B)
        addAssignmentToPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          {
            ...conflictingAssignment,
            date: exchange.date,
            period: exchange.period
          },
          transaction,
          originalUserPeriodId
        );
        
        // 4. Ajouter la nouvelle garde à l'utilisateur B (garde de A)
        addAssignmentToPlanningData(
          interestedUserPlanningRef,
          interestedUserPlanningData,
          assignmentKey,
          {
            ...originalAssignment,
            date: exchange.date,
            period: exchange.period
          },
          transaction,
          interestedUserPeriodId
        );
      } else {
        // Échange simple - l'utilisateur intéressé prend la garde
        
        // Supprimer la garde du planning de l'utilisateur original
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // Ajouter la garde au planning de l'utilisateur intéressé
        addAssignmentToPlanningData(
          interestedUserPlanningRef,
          interestedUserPlanningData,
          assignmentKey,
          {
            ...originalAssignment,
            date: exchange.date,
            period: exchange.period
          },
          transaction,
          interestedUserPeriodId
        );
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
