import { collection, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS, createExchangeValidationError, ShiftExchange } from './types';
import { doc } from 'firebase/firestore';
import { verifyNoReceivedGuard } from './validation';
import { createReplacement, deleteReplacement } from '../replacements';
import { createParisDate } from '@/utils/timezoneUtils';
import { auth } from '../config';

/**
 * Ajoute ou supprime l'intérêt d'un utilisateur pour un échange
 * @param exchangeId ID de l'échange
 * @param userId ID de l'utilisateur
 * @returns void
 * @throws Error si l'opération échoue
 */
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
        
        // 2.5. Vérifier aussi si l'utilisateur n'a pas déjà obtenu une garde via la BAG
        const validatedExchangeQuery = query(
          collection(db, COLLECTIONS.HISTORY),
          where('newUserId', '==', userId),
          where('date', '==', exchange.date),
          where('period', '==', exchange.period),
          where('status', '==', 'completed')
        );
        
        const validatedSnapshot = await getDocs(validatedExchangeQuery);
        if (!validatedSnapshot.empty) {
          const validatedExchange = validatedSnapshot.docs[0].data();
          throw createExchangeValidationError(
            'USER_ALREADY_HAS_SHIFT',
            `Vous avez déjà obtenu une garde ${validatedExchange.shiftType} sur ce créneau`
          );
        }
        
        // Vérifier aussi si l'utilisateur n'a pas donné sa garde sur ce créneau
        const givenExchangeQuery = query(
          collection(db, COLLECTIONS.HISTORY),
          where('originalUserId', '==', userId),
          where('date', '==', exchange.date),
          where('period', '==', exchange.period),
          where('status', '==', 'completed')
        );
        
        const givenSnapshot = await getDocs(givenExchangeQuery);
        if (!givenSnapshot.empty) {
          throw createExchangeValidationError(
            'USER_ALREADY_GAVE_SHIFT',
            'Vous avez déjà donné votre garde sur ce créneau'
          );
        }
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

/**
 * Supprime un utilisateur de la liste des intéressés d'un échange
 * @param exchangeId ID de l'échange
 * @param userId ID de l'utilisateur à supprimer
 * @returns void
 * @throws Error si l'opération échoue
 */
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
      
      // Vérifier que l'utilisateur est bien dans la liste
      if (!interestedUsers.includes(userId)) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'L\'utilisateur n\'est pas dans la liste des intéressés'
        );
      }
      
      // PARTIE 2: ÉCRITURES
      
      // Créer une entrée d'historique pour tracer le retrait
      const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
      const currentUser = auth.currentUser;
      const removedBy = currentUser?.uid || 'admin';
      
      transaction.set(historyRef, {
        originalUserId: exchange.userId,
        originalShiftType: exchange.shiftType,
        newUserId: userId, // L'utilisateur qui a été retiré
        newShiftType: null,
        validatedBy: removedBy,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        timeSlot: exchange.timeSlot,
        comment: exchange.comment || '',
        interestedUsers: exchange.interestedUsers || [],
        exchangedAt: createParisDate().toISOString(),
        createdAt: exchange.createdAt || createParisDate().toISOString(),
        isPermutation: false,
        status: 'interest_removed',
        originalExchangeId: exchangeId,
        removedBy: removedBy,
        removedUserId: userId // L'utilisateur qui a été retiré
      });
      
      // Mettre à jour la liste des intéressés
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

/**
 * Propose un échange à des utilisateurs spécifiques
 * @param exchange L'échange à proposer
 * @param userIds Liste des IDs des utilisateurs à qui proposer l'échange
 * @param ignoreStatusCheck Ignorer la vérification du statut de l'échange
 * @returns void
 * @throws Error si l'opération échoue
 */
export const proposeToUsers = async (
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
      }
    });
  } catch (error) {
    console.error('Error proposing to users:', error);
    throw error;
  }
};

/**
 * Propose un échange aux remplaçants
 * @param exchange L'échange à proposer
 * @param userIds Liste optionnelle des IDs des utilisateurs à qui proposer l'échange
 * @param ignoreStatusCheck Ignorer la vérification du statut de l'échange
 * @returns void
 * @throws Error si l'opération échoue
 */
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
      await createReplacement(exchange as any);
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
 * @returns void
 * @throws Error si l'opération échoue
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
      await deleteReplacement(exchange.id as any);
    }
  } catch (error) {
    console.error('Error canceling proposition to replacements:', error);
    throw error;
  }
};
