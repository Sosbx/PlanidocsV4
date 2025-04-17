import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS, ShiftExchange, ExchangeHistory } from './types';

// Pour les abonnements en temps réel
let exchangeHistoryListener: (() => void) | null = null;
let historySubscribers: Array<(history: ExchangeHistory[]) => void> = [];

/**
 * S'abonne aux changements en temps réel des échanges
 * @param callback Fonction à appeler lorsque les échanges changent
 * @returns Fonction pour se désabonner
 */
export const subscribeToShiftExchanges = (
  callback: (exchanges: ShiftExchange[]) => void
): (() => void) => {
  try {
    // Ajouter des logs pour le débogage
    console.log('Setting up shift exchanges subscription');
    
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
        })
        // Trier d'abord par statut puis par date
        .sort((a, b) => {
          // D'abord par statut (pending avant unavailable)
          if (a.status === 'pending' && b.status === 'unavailable') return -1;
          if (a.status === 'unavailable' && b.status === 'pending') return 1;
          // Ensuite par date
          return a.date.localeCompare(b.date);
        });
        
        console.log('Processed exchanges:', exchanges.length);
        
        // Appeler le callback avec les échanges
        callback(exchanges);
      }, (error) => {
        console.error('Error in shift exchanges subscription:', error);
        // En cas d'erreur, essayer de recharger les données depuis l'API
        import('./core').then(({ getShiftExchanges }) => {
          getShiftExchanges().then(data => {
            console.log('Fallback to API call after subscription error, got:', data.length, 'exchanges');
            callback(data);
          }).catch(apiError => {
            console.error('Even API fallback failed:', apiError);
            callback([]);
          });
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
            .sort((a, b) => {
              // D'abord par statut (pending avant unavailable)
              if (a.status === 'pending' && b.status === 'unavailable') return -1;
              if (a.status === 'unavailable' && b.status === 'pending') return 1;
              // Ensuite par date
              return a.date.localeCompare(b.date);
            });
          
          console.log('Processed exchanges (simple query):', exchanges.length);
          
          // Appeler le callback avec les échanges
          callback(exchanges);
        }, (error) => {
          console.error('Error in shift exchanges subscription (simple query):', error);
          // En cas d'erreur, essayer de recharger les données depuis l'API
          import('./core').then(({ getShiftExchanges }) => {
            getShiftExchanges().then(data => {
              console.log('Fallback to API call after subscription error, got:', data.length, 'exchanges');
              callback(data);
            }).catch(apiError => {
              console.error('Even API fallback failed:', apiError);
              callback([]);
            });
          });
        });
        
        return unsubscribe;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error subscribing to shift exchanges:', error);
    // En cas d'erreur, essayer de recharger les données depuis l'API
    import('./core').then(({ getShiftExchanges }) => {
      getShiftExchanges().then(data => {
        console.log('Fallback to API call after subscription setup error, got:', data.length, 'exchanges');
        callback(data);
      }).catch(apiError => {
        console.error('Even API fallback failed:', apiError);
        callback([]);
      });
    });
    
    return () => {}; // Fonction de désabonnement vide en cas d'erreur
  }
};

/**
 * S'abonne aux changements en temps réel de l'historique des échanges
 * @param callback Fonction à appeler lorsque l'historique change
 * @returns Fonction pour se désabonner
 */
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
        
        console.log('Processed history entries:', history.length);
        
        // Notifier tous les abonnés
        historySubscribers.forEach(subscriber => {
          console.log('Notifying history subscriber');
          subscriber(history);
        });
      }, (error) => {
        console.error('Error in exchange history subscription:', error);
        // En cas d'erreur, essayer de recharger les données depuis l'API
        import('./history-operations').then(({ getExchangeHistory }) => {
          getExchangeHistory().then(data => {
            console.log('Fallback to API call after history subscription error, got:', data.length, 'entries');
            // Notifier les abonnés
            historySubscribers.forEach(subscriber => subscriber(data));
          }).catch(apiError => {
            console.error('Even API fallback failed for history:', apiError);
            historySubscribers.forEach(subscriber => subscriber([]));
          });
        });
      });
    } catch (error) {
      console.error('Error setting up exchange history subscription:', error);
      // En cas d'erreur, essayer de recharger les données depuis l'API
      import('./history-operations').then(({ getExchangeHistory }) => {
        getExchangeHistory().then(data => {
          console.log('Fallback to API call after history subscription setup error, got:', data.length, 'entries');
          // Notifier les abonnés
          historySubscribers.forEach(subscriber => subscriber(data));
        }).catch(apiError => {
          console.error('Even API fallback failed for history:', apiError);
          historySubscribers.forEach(subscriber => subscriber([]));
        });
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
