import { 
  runTransaction, 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  Transaction, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from './directExchange/types';
import { ShiftPeriod } from '../../types/exchange';
import { normalizePeriod } from '../../utils/dateUtils';

// Interface pour le verrouillage d'un échange
export interface LockOptions {
  exchangeId?: string;
  userId: string;
  date: string;
  period: string | ShiftPeriod;
  operation: 'exchange' | 'give' | 'replacement' | 'take' | 'cancel' | 'validate';
  timeout?: number; // Durée du verrouillage en ms, par défaut 30000ms (30s)
}

// Résultat du verrouillage
export interface LockResult {
  locked: boolean;
  exchangeDoc?: any;
  directExchangeCollection: string;
  transaction: Transaction;
  bagExchangeRef?: any;
  error?: string;
}

/**
 * Verrouille un échange pour une opération atomique
 * Vérifie également la disponibilité dans les deux systèmes d'échange
 * 
 * @param transaction Transaction Firestore
 * @param options Options de verrouillage
 * @returns Résultat du verrouillage avec transaction
 */
export const lockExchangeForOperation = async (
  transaction: Transaction,
  options: LockOptions
): Promise<LockResult> => {
  try {
    // Normaliser la période
    const normalizedPeriod = normalizePeriod(options.period);
    
    // Déterminer les collections à vérifier
    const directExchangeCollection = COLLECTIONS.DIRECT_EXCHANGES;
    const bagExchangeCollection = 'shift_exchanges';
    
    // Si l'ID d'échange est fourni, vérifier directement
    if (options.exchangeId) {
      const exchangeRef = doc(db, directExchangeCollection, options.exchangeId);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        return {
          locked: false,
          transaction,
          directExchangeCollection,
          error: "L'échange spécifié n'existe pas"
        };
      }
      
      // Vérifier si l'échange est déjà verrouillé
      const data = exchangeDoc.data();
      if (data.locked && data.lockedUntil && data.lockedUntil.toMillis() > Date.now()) {
        return {
          locked: false,
          transaction,
          directExchangeCollection,
          error: "L'échange est actuellement en cours de traitement par un autre utilisateur"
        };
      }
      
      // Verrouiller l'échange
      transaction.update(exchangeRef, {
        locked: true,
        lockedBy: options.userId,
        lockedUntil: new Date(Date.now() + (options.timeout || 30000)),
        lockedForOperation: options.operation,
        lastModified: serverTimestamp()
      });
      
      return {
        locked: true,
        exchangeDoc: { ...data, id: exchangeDoc.id },
        transaction,
        directExchangeCollection
      };
    }
    
    // Sinon, chercher dans les collections par date et période
    
    // 1. Vérifier dans les échanges directs
    const directQuery = query(
      collection(db, directExchangeCollection),
      where('date', '==', options.date),
      where('period', '==', normalizedPeriod),
      where('userId', '==', options.userId)
    );
    
    const directExchanges = await transaction.get(directQuery);
    
    // 2. Vérifier dans la bourse aux gardes
    const bagQuery = query(
      collection(db, bagExchangeCollection),
      where('date', '==', options.date),
      where('period', '==', normalizedPeriod),
      where('userId', '==', options.userId)
    );
    
    const bagExchanges = await transaction.get(bagQuery);
    
    // Si l'échange existe dans un des systèmes, le verrouiller
    if (!directExchanges.empty || !bagExchanges.empty) {
      let exchangeDoc;
      let exchangeRef;
      let bagExchangeRef;
      
      if (!directExchanges.empty) {
        exchangeDoc = directExchanges.docs[0];
        exchangeRef = exchangeDoc.ref;
        
        // Vérifier si l'échange est déjà verrouillé
        const data = exchangeDoc.data();
        if (data.locked && data.lockedUntil && data.lockedUntil.toMillis() > Date.now()) {
          return {
            locked: false,
            transaction,
            directExchangeCollection,
            error: "L'échange est actuellement en cours de traitement par un autre utilisateur"
          };
        }
        
        // Verrouiller l'échange direct
        transaction.update(exchangeRef, {
          locked: true,
          lockedBy: options.userId,
          lockedUntil: new Date(Date.now() + (options.timeout || 30000)),
          lockedForOperation: options.operation,
          lastModified: serverTimestamp()
        });
      }
      
      // Si existe aussi dans BAG, le marquer comme indisponible temporairement
      if (!bagExchanges.empty) {
        bagExchangeRef = bagExchanges.docs[0].ref;
        transaction.update(bagExchangeRef, {
          temporarilyUnavailable: true,
          lastModified: serverTimestamp()
        });
      }
      
      return {
        locked: true,
        exchangeDoc: exchangeDoc ? { ...exchangeDoc.data(), id: exchangeDoc.id } : undefined,
        bagExchangeRef,
        transaction,
        directExchangeCollection
      };
    }
    
    // Aucun échange existant trouvé
    return {
      locked: false,
      transaction,
      directExchangeCollection,
      error: "Aucun échange trouvé pour cette date et période"
    };
  } catch (error) {
    console.error("Erreur lors du verrouillage de l'échange:", error);
    return {
      locked: false,
      transaction,
      directExchangeCollection,
      error: `Erreur lors du verrouillage: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Déverrouille un échange après une opération
 * 
 * @param transaction Transaction Firestore 
 * @param exchangeRef Référence à l'échange
 * @param bagExchangeRef Référence optionnelle à l'échange dans la bourse aux gardes
 * @param success Indique si l'opération a réussi
 */
export const unlockExchange = (
  transaction: Transaction,
  exchangeRef: any,
  bagExchangeRef?: any,
  success: boolean = true
) => {
  // Déverrouiller l'échange direct
  transaction.update(exchangeRef, {
    locked: false,
    lockedBy: null,
    lockedUntil: null,
    lockedForOperation: null,
    lastModified: serverTimestamp()
  });
  
  // Si un échange bourse aux gardes est associé, restaurer sa disponibilité
  if (bagExchangeRef) {
    transaction.update(bagExchangeRef, {
      temporarilyUnavailable: false,
      lastModified: serverTimestamp()
    });
  }
};

/**
 * Nettoie les verrouillages expirés dans les collections d'échange
 * Peut être exécuté régulièrement par un job ou avant des opérations critiques
 */
export const cleanupExpiredLocks = async () => {
  try {
    const batch = writeBatch(db);
    const now = new Date();
    
    // Nettoyer les collections d'échanges directs
    const directExchangesQuery = query(
      collection(db, COLLECTIONS.DIRECT_EXCHANGES),
      where('locked', '==', true)
    );
    
    const directExchangesDocs = await getDocs(directExchangesQuery);
    
    directExchangesDocs.forEach(doc => {
      const data = doc.data();
      if (data.lockedUntil && data.lockedUntil.toDate() < now) {
        batch.update(doc.ref, {
          locked: false,
          lockedBy: null,
          lockedUntil: null,
          lockedForOperation: null,
          lastModified: serverTimestamp()
        });
      }
    });
    
    // Appliquer toutes les mises à jour
    await batch.commit();
    console.log(`Nettoyage terminé: ${directExchangesDocs.size} verrouillages vérifiés`);
    
    return { success: true, count: directExchangesDocs.size };
  } catch (error) {
    console.error("Erreur lors du nettoyage des verrouillages expirés:", error);
    return { 
      success: false, 
      error: `Erreur lors du nettoyage: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Synchronise une opération entre les échanges directs et la bourse aux gardes
 * S'assure qu'une garde n'est pas disponible dans les deux systèmes simultanément
 * 
 * @param userId ID de l'utilisateur
 * @param date Date de la garde
 * @param period Période de la garde (M, AM, S)
 * @param makeUnavailableInBag Indique si la garde doit être marquée indisponible dans la BAG
 */
export const syncExchangeSystems = async (
  userId: string,
  date: string,
  period: string | ShiftPeriod,
  makeUnavailableInBag: boolean = true
) => {
  try {
    // Normaliser la période
    const normalizedPeriod = normalizePeriod(period);
    
    return await runTransaction(db, async (transaction) => {
      // Rechercher dans la bourse aux gardes
      const bagQuery = query(
        collection(db, 'shift_exchanges'),
        where('date', '==', date),
        where('period', '==', normalizedPeriod),
        where('userId', '==', userId)
      );
      
      const bagExchangesSnapshot = await transaction.get(bagQuery);
      
      if (!bagExchangesSnapshot.empty) {
        const bagExchangeRef = bagExchangesSnapshot.docs[0].ref;
        
        if (makeUnavailableInBag) {
          // Marquer comme indisponible dans la BAG
          transaction.update(bagExchangeRef, {
            unavailable: true,
            lastModified: serverTimestamp()
          });
        } else {
          // Mettre à jour le statut, mais ne pas supprimer
          transaction.update(bagExchangeRef, {
            unavailable: false,
            lastModified: serverTimestamp()
          });
        }
      }
      
      return { success: true };
    });
  } catch (error) {
    console.error("Erreur lors de la synchronisation des systèmes d'échange:", error);
    return { 
      success: false, 
      error: `Erreur de synchronisation: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Supprime une période de planning en cascade (plannings et échanges)
 * @param periodId ID de la période à supprimer
 */
export const deletePlanningPeriodWithCascade = async (periodId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    // 1. Récupérer tous les plannings pour cette période
    const planningsQuery = query(
      collection(db, 'generated_plannings')
    );
    
    const planningsSnapshot = await getDocs(planningsQuery);
    
    // Liste des utilisateurs affectés pour nettoyer les échanges plus tard
    const affectedUserIds: string[] = [];
    
    // 2. Supprimer cette période de tous les plannings
    for (const planningDoc of planningsSnapshot.docs) {
      const userId = planningDoc.id;
      const planningData = planningDoc.data();
      
      // Vérifier si ce planning contient la période à supprimer
      if (planningData.periods && planningData.periods[periodId]) {
        // Ajouter l'utilisateur à la liste des affectés
        affectedUserIds.push(userId);
        
        // Mise à jour pour supprimer la période
        const planningRef = doc(db, 'generated_plannings', userId);
        batch.update(planningRef, {
          [`periods.${periodId}`]: null
        });
      }
    }
    
    // 3. Supprimer la période elle-même
    batch.delete(doc(db, 'planning_periods', periodId));
    
    // 4. Exécuter le batch
    await batch.commit();
    
    // 5. Maintenant, nettoyer les échanges pour tous les utilisateurs affectés
    // (ceci est fait après le batch car cela peut nécessiter plusieurs opérations)
    for (const userId of affectedUserIds) {
      await cleanupUserExchanges(userId, periodId);
    }
  } catch (error) {
    console.error('Error deleting planning period with cascade:', error);
    throw error;
  }
};

/**
 * Nettoie les échanges d'un utilisateur pour une période spécifique
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période
 */
const cleanupUserExchanges = async (userId: string, periodId: string): Promise<void> => {
  try {
    // Récupérer d'abord la période pour connaître ses dates
    const periodDoc = await getDocs(query(collection(db, 'planning_periods'), where('__name__', '==', periodId)));
    
    if (periodDoc.empty) {
      console.warn(`Period ${periodId} not found, cannot cleanup exchanges precisely`);
      return;
    }
    
    const periodData = periodDoc.docs[0].data();
    const startDate = periodData.startDate.toDate();
    const endDate = periodData.endDate.toDate();
    
    // Formater les dates au format 'YYYY-MM-DD'
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    
    // Récupérer tous les échanges dans cette plage de dates pour cet utilisateur
    const exchangesQuery = query(
      collection(db, 'shift_exchanges'),
      where('userId', '==', userId),
      where('date', '>=', formattedStartDate),
      where('date', '<=', formattedEndDate),
      where('status', 'in', ['pending', 'unavailable'])
    );
    
    const exchangesSnapshot = await getDocs(exchangesQuery);
    
    // Marquer tous ces échanges comme indisponibles
    const batch = writeBatch(db);
    exchangesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'unavailable',
        lastModified: new Date()
      });
    });
    
    if (exchangesSnapshot.docs.length > 0) {
      await batch.commit();
      console.log(`Marked ${exchangesSnapshot.docs.length} exchanges as unavailable for user ${userId}`);
    }
  } catch (error) {
    console.error('Error cleaning up user exchanges:', error);
    // Ne pas propager l'erreur pour ne pas bloquer l'opération principale
  }
};