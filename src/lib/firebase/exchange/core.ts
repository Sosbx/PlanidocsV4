import { collection, doc, addDoc, getDocs, updateDoc, query, orderBy, where, runTransaction, serverTimestamp, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { format } from 'date-fns';
import { COLLECTIONS, createExchangeValidationError, ShiftExchange } from './types';
import { validateExchangeData, verifyPlanningAssignment } from './validation';

/**
 * Ajoute un nouvel échange de garde
 * @param exchange Données de l'échange à ajouter
 * @throws Error si les données sont invalides ou si l'ajout échoue
 */
export const addShiftExchange = async (exchange: Omit<ShiftExchange, 'id' | 'createdAt'>): Promise<void> => {
  try {
    validateExchangeData(exchange);
    
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
        
        // Debug pour AVIT
        if (exchange.userId === 'naRhqjhzpWhcOMCZWCqftT8ArbH3') {
          console.log('[DEBUG AVIT Create] Date originale:', exchange.date);
          console.log('[DEBUG AVIT Create] Type de date:', typeof exchange.date);
          console.log('[DEBUG AVIT Create] Date formatée:', formatParisDate(new Date(exchange.date), 'yyyy-MM-dd'));
        }
        
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

/**
 * Rejette un échange de garde en créant un historique
 * @param exchangeId ID de l'échange à rejeter
 * @param rejectedBy ID de l'utilisateur qui rejette (optionnel)
 * @throws Error si le rejet échoue
 */
export const removeShiftExchange = async (exchangeId: string, rejectedBy?: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // Récupérer l'échange
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
    
      if (exchange.status !== 'pending' && exchange.status !== 'cancelled') { 
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Cet échange n\'est plus disponible'
        );
      }
      
      // Créer l'entrée d'historique pour le rejet
      const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
      const now = createParisDate();
      
      transaction.set(historyRef, {
        id: historyRef.id,
        originalUserId: exchange.userId,
        originalShiftType: exchange.shiftType,
        newUserId: '', // Pas de nouveau propriétaire pour un rejet
        newShiftType: null,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        timeSlot: exchange.timeSlot,
        comment: exchange.comment || '',
        interestedUsers: exchange.interestedUsers || [],
        exchangedAt: now.toISOString(),
        createdAt: exchange.createdAt,
        isPermutation: false,
        status: 'rejected', // Nouveau statut pour les rejets
        rejectedBy: rejectedBy || 'admin',
        rejectedAt: now.toISOString(),
        originalExchangeId: exchangeId
      });
      
      // Marquer l'échange comme rejeté au lieu de le supprimer
      transaction.update(exchangeRef, {
        status: 'rejected',
        lastModified: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error rejecting shift exchange:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erreur lors du rejet de l\'échange');
  }
};

/**
 * Récupère tous les échanges de garde
 * @returns Liste des échanges de garde
 */
export const getShiftExchanges = async (): Promise<ShiftExchange[]> => {
  try {
    const today = formatParisDate(createParisDate(), 'yyyy-MM-dd');
    
    // Récupérer la configuration de la phase pour déterminer les statuts à inclure
    let statusesToInclude = ['pending', 'unavailable'];
    
    try {
      const configDoc = await getDoc(doc(db, 'config', 'bag_phase_config'));
      if (configDoc.exists()) {
        const config = configDoc.data();
        // En phase distribution, ne récupérer que les gardes pending (les validated sont dans l'historique)
        if (config.phase === 'distribution') {
          statusesToInclude = ['pending'];
        }
        // En phase completed, inclure aussi les gardes not_taken
        else if (config.phase === 'completed') {
          statusesToInclude = ['pending', 'unavailable', 'not_taken'];
        }
      }
    } catch (error) {
      console.warn('Could not fetch BAG phase config, using default statuses', error);
    }
    
    // Essayer d'abord avec l'index composé
    try {
      const q = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '>=', today),
        where('status', 'in', statusesToInclude),
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
          status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable' | 'not_taken'),
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
      
      return exchanges;
    } catch (indexError: any) {
      // Si l'index n'est pas encore prêt, faire une requête simple
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.EXCHANGES),
          where('status', 'in', statusesToInclude)
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
                status: (data.status || 'pending') as ('pending' | 'validated' | 'cancelled' | 'unavailable' | 'not_taken'),
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
          
        return exchanges;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error getting shift exchanges:', error);
    return []; // Retourner un tableau vide au lieu de throw
  }
};

/**
 * Finalise tous les échanges en attente
 * @returns Nombre d'échanges finalisés
 */
export const finalizeAllExchanges = async (): Promise<number> => {
  try {
    // Chercher tous les échanges en attente
    const pendingExchangesQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('status', '==', 'pending')
    );
    
    const pendingExchangesSnapshot = await getDocs(pendingExchangesQuery);
    
    // Marquer chaque échange selon s'il a trouvé preneur ou non
    await runTransaction(db, async (transaction) => {
      pendingExchangesSnapshot.docs.forEach(doc => {
        const exchangeData = doc.data();
        const hasInterestedUsers = exchangeData.interestedUsers && exchangeData.interestedUsers.length > 0;
        
        transaction.update(doc.ref, {
          status: hasInterestedUsers ? 'pending' : 'not_taken', // Les gardes avec intéressés restent pending, les autres passent à not_taken
          lastModified: serverTimestamp(),
          finalizedAt: serverTimestamp()
        });
      });
    });
    
    console.log(`${pendingExchangesSnapshot.size} échanges finalisés`);
    return pendingExchangesSnapshot.size;
  } catch (error) {
    console.error('Erreur lors de la finalisation des échanges:', error);
    throw error;
  }
};

/**
 * Restaure tous les échanges not_taken en pending (utilisé lors du retour en phase 2)
 * @returns Nombre d'échanges restaurés
 */
export const restoreNotTakenToPending = async (): Promise<number> => {
  try {
    // Chercher tous les échanges not_taken
    const notTakenExchangesQuery = query(
      collection(db, COLLECTIONS.EXCHANGES),
      where('status', '==', 'not_taken')
    );
    
    const notTakenExchangesSnapshot = await getDocs(notTakenExchangesQuery);
    
    if (notTakenExchangesSnapshot.empty) {
      console.log('Aucun échange not_taken à restaurer');
      return 0;
    }
    
    // Restaurer chaque échange au statut 'pending'
    let restoredCount = 0;
    
    await runTransaction(db, async (transaction) => {
      notTakenExchangesSnapshot.docs.forEach(doc => {
        transaction.update(doc.ref, {
          status: 'pending',
          lastModified: serverTimestamp(),
          finalizedAt: null
        });
        restoredCount++;
      });
    });
    
    console.log(`${restoredCount} échanges not_taken restaurés en pending`);
    return restoredCount;
  } catch (error) {
    console.error('Erreur lors de la restauration des échanges not_taken:', error);
    throw error;
  }
};

/**
 * Restaure tous les échanges indisponibles qui n'ont pas d'entrée dans l'historique
 * @returns Nombre d'échanges restaurés
 */
export const restorePendingExchanges = async (): Promise<number> => {
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
    let restoredCount = 0;
    
    await runTransaction(db, async (transaction) => {
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
    });
    
    console.log(`${restoredCount} échanges restaurés`);
    return restoredCount;
  } catch (error) {
    console.error('Erreur lors de la restauration des échanges:', error);
    throw error;
  }
};
