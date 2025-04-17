import { collection, doc, addDoc, getDocs, updateDoc, query, orderBy, where, runTransaction, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
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

/**
 * Supprime un échange de garde
 * @param exchangeId ID de l'échange à supprimer
 * @throws Error si la suppression échoue
 */
export const removeShiftExchange = async (exchangeId: string): Promise<void> => {
  try {
    const exchangeRef = doc(db, COLLECTIONS.EXCHANGES, exchangeId);
    const exchangeDoc = await getDocs(query(collection(db, COLLECTIONS.EXCHANGES), where('__name__', '==', exchangeId)));
    
    if (exchangeDoc.empty) {
      throw createExchangeValidationError(
        'INVALID_EXCHANGE',
        'Échange non trouvé'
      );
    }

    const exchange = exchangeDoc.docs[0].data() as ShiftExchange;
    
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

/**
 * Récupère tous les échanges de garde
 * @returns Liste des échanges de garde
 */
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
    return pendingExchangesSnapshot.size;
  } catch (error) {
    console.error('Erreur lors de la finalisation des échanges:', error);
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
