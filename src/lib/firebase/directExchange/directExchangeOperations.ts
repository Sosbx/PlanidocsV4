import { collection, doc, getDocs, getDoc, updateDoc, query, where, orderBy, Timestamp, runTransaction, serverTimestamp, Transaction } from 'firebase/firestore';
import { db } from '../config';
import { OperationType, ShiftExchange, ShiftPeriod } from '../../../types/exchange';
import { format } from 'date-fns';
import { normalizeFromDateUtils as normalizePeriod } from '../../../utils/periodUtils';
import { getCollectionByOperationType, removeFromShiftExchange } from './core';
import { COLLECTIONS, DirectExchangeProposal } from './types';
import { validateExchangeData, checkExistingExchange, checkExistingShiftExchange, checkDesiderata } from './core';
import { User } from '../../../types/users';
import { 
  NotificationType, 
  sendExchangeNotification, 
  createExchangeUpdatedNotification,
  createExchangeCancelledNotification,
  createGiveUpdatedNotification,
  createGiveCancelledNotification,
  createProposalCancelledNotification
} from '../notifications';
import { DIRECT_EXCHANGE_PROPOSALS } from './directProposalOperations';
import { FirestoreCacheUtils } from '../../../utils/cacheUtils';

// Type commun pour les données d'échange
export type ExchangeData = Omit<ShiftExchange, 'id' | 'createdAt' | 'exchangeType'>;

// Interface pour les options de transaction d'échange
export interface ExchangeTransactionOptions {
  userId: string;
  date: string;
  period: ShiftPeriod | string;
  targetUserId?: string;
  operationTypes: OperationType[];
  verifyConflicts?: boolean;
  checkPermissions?: boolean;
  logOperation?: boolean;
}

/**
 * Fonction utilitaire pour vérifier et verrouiller un échange dans une transaction
 * @param transaction La transaction Firebase
 * @param exchangeId Identifiant de l'échange
 * @param collectionName Nom de la collection (par défaut DIRECT_EXCHANGES)
 * @returns Données de l'échange vérifié
 */
const verifyAndLockExchange = async (
  transaction: Transaction,
  exchangeId: string,
  collectionName: string = COLLECTIONS.DIRECT_EXCHANGES
): Promise<ShiftExchange> => {
  const exchangeRef = doc(db, collectionName, exchangeId);
  const exchangeDoc = await transaction.get(exchangeRef);
  
  if (!exchangeDoc.exists()) {
    throw new Error('Échange non trouvé');
  }
  
  const exchange = exchangeDoc.data() as ShiftExchange;
  
  // Vérifier que l'échange est toujours disponible
  if (exchange.status !== 'pending') {
    throw new Error("Cet échange n'est plus disponible");
  }
  
  // Verrouiller l'échange pour éviter les modifications concurrentes
  transaction.update(exchangeRef, {
    status: 'unavailable',
    lastModified: serverTimestamp()
  });
  
  return exchange;
};

/**
 * Fonction pour vérifier les conflits potentiels lors d'un échange
 * @param transaction La transaction Firebase
 * @param userId ID de l'utilisateur qui reçoit la garde
 * @param date Date de la garde
 * @param period Période de la garde
 * @returns Booléen indiquant s'il y a un conflit
 */
const checkConflictsForExchange = async (
  transaction: Transaction,
  userId: string,
  date: string,
  period: ShiftPeriod | string
): Promise<boolean> => {
  // Vérifier si l'utilisateur a déjà une garde ce jour et cette période
  const normalizedPeriod = normalizePeriod(period);
  const userPlanningRef = doc(db, 'user_planning', `${userId}_${date}_${normalizedPeriod}`);
  const userPlanningDoc = await transaction.get(userPlanningRef);
  
  return userPlanningDoc.exists();
};

/**
 * Fonction pour mettre à jour les plannings des utilisateurs dans une transaction
 * @param transaction La transaction Firebase
 * @param options Options pour la mise à jour
 */
const updateUserPlannings = async (
  transaction: Transaction,
  options: {
    originalUserId: string;
    newUserId?: string;
    date: string;
    period: ShiftPeriod | string;
    shiftType: string;
    timeSlot: string;
    operationType: OperationType;
    isPermutation?: boolean;
  }
): Promise<void> => {
  const { originalUserId, newUserId, date, period, operationType, isPermutation } = options;
  const normalizedPeriod = normalizePeriod(period);
  
  // Si c'est un échange complet (et pas seulement une cession)
  if (operationType === 'exchange' && newUserId && isPermutation) {
    // Créer des références aux plannings des deux utilisateurs
    const originalUserPlanningRef = doc(db, 'user_planning', `${originalUserId}_${date}_${normalizedPeriod}`);
    const newUserPlanningRef = doc(db, 'user_planning', `${newUserId}_${date}_${normalizedPeriod}`);
    
    // Récupérer les données actuelles
    const originalUserPlanningDoc = await transaction.get(originalUserPlanningRef);
    const newUserPlanningDoc = await transaction.get(newUserPlanningRef);
    
    if (!originalUserPlanningDoc.exists()) {
      throw new Error("La garde de l'utilisateur original n'existe pas");
    }
    
    if (!newUserPlanningDoc.exists() && operationType === 'exchange') {
      throw new Error("L'utilisateur receveur n'a pas de garde à échanger");
    }
    
    // Récupérer les données des gardes
    const newShift = newUserPlanningDoc.exists() ? newUserPlanningDoc.data() : null;
    
    // Échanger les gardes
    transaction.update(originalUserPlanningRef, {
      userId: newUserId,
      lastModified: serverTimestamp()
    });
    
    if (newShift) {
      transaction.update(newUserPlanningRef, {
        userId: originalUserId,
        lastModified: serverTimestamp()
      });
    }
  } 
  // Si c'est une cession simple
  else if ((operationType === 'give' || operationType === 'replacement') && newUserId) {
    const originalUserPlanningRef = doc(db, 'user_planning', `${originalUserId}_${date}_${normalizedPeriod}`);
    
    const originalUserPlanningDoc = await transaction.get(originalUserPlanningRef);
    
    if (!originalUserPlanningDoc.exists()) {
      throw new Error("La garde de l'utilisateur original n'existe pas");
    }
    
    // Attribuer la garde au nouvel utilisateur
    transaction.update(originalUserPlanningRef, {
      userId: newUserId,
      lastModified: serverTimestamp()
    });
  }
};

/**
 * Fonction principale pour traiter une transaction d'échange complète de manière atomique
 * @param exchange Données de l'échange à traiter
 * @param options Options pour la transaction
 * @returns ID de l'échange/historique créé
 */
export const processExchangeTransaction = async (
  exchange: ExchangeData & { comment?: string },
  options: ExchangeTransactionOptions
): Promise<string> => {
  try {
    // Déterminer le type d'opération principal pour les logs
    const primaryOperationType = options.operationTypes.length > 0 ? options.operationTypes[0] : 'exchange';
    console.log(`Traitement de la transaction d'échange ${primaryOperationType}:`, exchange);
    
    // Validation des données
    validateExchangeData(exchange);
    
    // Normaliser la période
    const normalizedPeriod = normalizePeriod(exchange.period);
    
    // Collecter les informations nécessaires avant de commencer la transaction
    let existingExchangeInfo: any = null;
    let bagExchangeInfo: any = null;
    let desiderataInfo: any = null;
    
    // Récupérer des informations en parallèle hors transaction
    await Promise.all([
      (async () => {
        existingExchangeInfo = await checkExistingExchange(
          exchange.userId,
          exchange.date,
          normalizedPeriod,
          options.operationTypes
        );
      })(),
      (async () => {
        bagExchangeInfo = await checkExistingShiftExchange(
          exchange.userId,
          exchange.date,
          normalizedPeriod
        );
      })(),
      (async () => {
        desiderataInfo = await checkDesiderata(
          exchange.userId,
          exchange.date,
          normalizedPeriod
        );
      })()
    ]);
    
    // Formater la date au format YYYY-MM-DD
    let formattedDate = exchange.date;
    try {
      formattedDate = format(new Date(exchange.date), 'yyyy-MM-dd');
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      // Continuer avec la date originale si le formatage échoue
    }
    
    // Exécuter la transaction
    const result = await runTransaction(db, async (transaction) => {
      // Créer les références nécessaires
      const collectionRef = collection(db, getCollectionByOperationType(options.operationType));
      const exchangeRef = doc(collectionRef);
      
      // Vérifier les conflits si demandé
      if (options.verifyConflicts && options.targetUserId) {
        const hasConflict = await checkConflictsForExchange(
          transaction,
          options.targetUserId,
          formattedDate,
          normalizedPeriod
        );
        
        if (hasConflict && options.operationType === 'exchange') {
          throw new Error("L'utilisateur cible a déjà une garde à cette date et période");
        }
      }
      
      // Si la garde existe déjà dans la bourse aux gardes, la supprimer
      if (bagExchangeInfo.exists && bagExchangeInfo.exchangeIds.length > 0) {
        await removeFromShiftExchange(transaction, bagExchangeInfo.exchangeIds);
      }
      
      // Créer l'échange
      transaction.set(exchangeRef, {
        ...exchange,
        date: formattedDate,
        period: normalizedPeriod,
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        status: 'pending',
        interestedUsers: [],
        exchangeType: 'direct',
        operationType: options.operationType
      });
      
      // Si c'est un échange direct avec un utilisateur cible spécifié
      if (options.targetUserId && (options.operationType === 'give' || options.operationType === 'exchange')) {
        // Mettre à jour les plannings des utilisateurs
        await updateUserPlannings(transaction, {
          originalUserId: exchange.userId,
          newUserId: options.targetUserId,
          date: formattedDate,
          period: normalizedPeriod,
          shiftType: exchange.shiftType,
          timeSlot: exchange.timeSlot,
          operationType: options.operationType,
          isPermutation: options.operationType === 'exchange'
        });
        
        // Créer une entrée dans l'historique
        const historyRef = doc(collection(db, COLLECTIONS.DIRECT_HISTORY));
        transaction.set(historyRef, {
          originalUserId: exchange.userId,
          newUserId: options.targetUserId,
          date: formattedDate,
          period: normalizedPeriod,
          shiftType: exchange.shiftType,
          timeSlot: exchange.timeSlot,
          exchangedAt: new Date().toISOString(),
          comment: exchange.comment || '',
          operationType: options.operationType,
          status: 'completed',
          createdAt: Timestamp.now(),
          lastModified: Timestamp.now()
        });
        
        // Mettre à jour le statut de l'échange
        transaction.update(exchangeRef, {
          status: 'validated',
          acceptedBy: options.targetUserId,
          acceptedAt: new Date().toISOString(),
          lastModified: serverTimestamp()
        });
        
        return { exchangeId: exchangeRef.id, historyId: historyRef.id };
      }
      
      return { exchangeId: exchangeRef.id };
    });
    
    // Invalider les caches concernés
    FirestoreCacheUtils.invalidate('direct_exchanges');
    FirestoreCacheUtils.invalidate('user_planning');
    FirestoreCacheUtils.invalidate('shift_exchanges');
    
    // Envoyer les notifications appropriées
    if (options.targetUserId) {
      // Récupérer le nom de l'utilisateur pour les notifications
      const userRef = doc(db, 'users', exchange.userId);
      const userDoc = await getDoc(userRef);
      const user = userDoc.exists() ? userDoc.data() as User : null;
      const userName = user ? `${user.firstName} ${user.lastName}` : 'Un utilisateur';
      
      // Envoyer la notification appropriée
      if (options.operationType === 'exchange') {
        await sendExchangeNotification(
          options.targetUserId,
          NotificationType.EXCHANGE_COMPLETED,
          formattedDate,
          normalizedPeriod,
          result.exchangeId,
          userName
        );
      } else if (options.operationType === 'give') {
        await sendExchangeNotification(
          options.targetUserId,
          NotificationType.GIVE_COMPLETED,
          formattedDate,
          normalizedPeriod,
          result.exchangeId,
          userName
        );
      }
      
      // Notification pour l'utilisateur original
      if (options.operationType === 'exchange') {
        // Récupérer le nom de l'utilisateur cible
        const targetUserRef = doc(db, 'users', options.targetUserId);
        const targetUserDoc = await getDoc(targetUserRef);
        const targetUser = targetUserDoc.exists() ? targetUserDoc.data() as User : null;
        const targetUserName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'Un utilisateur';
        
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.EXCHANGE_COMPLETED,
          formattedDate,
          normalizedPeriod,
          result.exchangeId,
          targetUserName
        );
      } else if (options.operationType === 'give') {
        // Récupérer le nom de l'utilisateur cible
        const targetUserRef = doc(db, 'users', options.targetUserId);
        const targetUserDoc = await getDoc(targetUserRef);
        const targetUser = targetUserDoc.exists() ? targetUserDoc.data() as User : null;
        const targetUserName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'Un utilisateur';
        
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.GIVE_COMPLETED,
          formattedDate,
          normalizedPeriod,
          result.exchangeId,
          targetUserName
        );
      }
    }
    
    // Si l'opération a été effectuée, enregistrer dans les logs si demandé
    if (options.logOperation) {
      const logRef = doc(collection(db, 'operation_logs'));
      await updateDoc(logRef, {
        type: options.operationType,
        userId: exchange.userId,
        targetUserId: options.targetUserId,
        date: formattedDate,
        period: normalizedPeriod,
        timestamp: Timestamp.now(),
        success: true
      });
    }
    
    return result.historyId || result.exchangeId;
  } catch (error) {
    console.error(`Error during ${options.operationType} transaction:`, error);
    throw error;
  }
};

/**
 * Ajouter un échange direct (permutation)
 */
export const addDirectExchange = async (
  exchange: ExchangeData & { comment?: string }
): Promise<string> => {
  return processExchangeTransaction(exchange, {
    userId: exchange.userId,
    date: exchange.date,
    period: exchange.period,
    operationTypes: ['exchange']
  });
};

/**
 * Récupérer tous les échanges directs (échanges, cessions et remplacements)
 */
export const getDirectExchanges = async (): Promise<ShiftExchange[]> => {
  try {
    // Clé de cache pour cette requête
    const cacheKey = 'direct_exchanges_all';
    
    // Vérifier si les données sont dans le cache
    const cachedData = FirestoreCacheUtils.get<ShiftExchange[]>(cacheKey);
    if (cachedData) {
      console.log('Utilisation des données en cache pour les échanges directs');
      return cachedData;
    }
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const result: ShiftExchange[] = [];
    
    console.log('Récupération des échanges directs à partir de la date:', today);
    
    // Fonction pour récupérer et normaliser les données d'une collection
    const fetchAndNormalizeCollection = async (
      collectionName: string,
      collectionType: string
    ): Promise<ShiftExchange[]> => {
      const q = query(
        collection(db, collectionName),
        where('date', '>=', today),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('date', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        // S'assurer que la période est correctement définie
        const periodRaw = data.period || data.type;
        // Standardiser la période avec la fonction commune
        const normalizedPeriod = normalizePeriod(String(periodRaw));
        
        return {
          id: doc.id,
          ...data,
          period: normalizedPeriod
        };
      }) as ShiftExchange[];
      
      console.log(`Récupéré ${items.length} ${collectionType}:`, items);
      return items;
    };
    
    // Récupérer les données des deux collections en parallèle - tous les échanges et cessions sont dans direct_exchanges
    const [exchanges, replacements] = await Promise.all([
      fetchAndNormalizeCollection(COLLECTIONS.DIRECT_EXCHANGES, 'échanges/cessions directs'),
      fetchAndNormalizeCollection(COLLECTIONS.DIRECT_REPLACEMENTS, 'remplacements directs')
    ]);
    
    // Combiner les résultats
    result.push(...exchanges, ...replacements);
    
    console.log(`Total des échanges directs récupérés: ${result.length}`);
    
    // Stocker les données dans le cache
    FirestoreCacheUtils.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error getting direct exchanges:', error);
    return [];
  }
};

/**
 * Récupérer l'historique des échanges directs
 */
export const getDirectExchangeHistory = async (userId?: string): Promise<any[]> => {
  try {
    // Clé de cache pour cette requête
    const cacheKey = userId 
      ? `direct_exchange_history_user_${userId}` 
      : 'direct_exchange_history_all';
    
    // Vérifier si les données sont dans le cache
    const cachedData = FirestoreCacheUtils.get<any[]>(cacheKey);
    if (cachedData) {
      console.log(`Utilisation des données en cache pour l'historique des échanges directs${userId ? ' de l\'utilisateur ' + userId : ''}`);
      return cachedData;
    }
    
    let q;
    
    if (userId) {
      // Récupérer l'historique pour un utilisateur spécifique
      q = query(
        collection(db, COLLECTIONS.DIRECT_HISTORY),
        where('status', '==', 'completed'),
        where('originalUserId', '==', userId),
        orderBy('exchangedAt', 'desc')
      );
    } else {
      // Récupérer tout l'historique
      q = query(
        collection(db, COLLECTIONS.DIRECT_HISTORY),
        where('status', '==', 'completed'),
        orderBy('exchangedAt', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    
    const result = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Stocker les données dans le cache
    FirestoreCacheUtils.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error getting direct exchange history:', error);
    return [];
  }
};

/**
 * Accepter un échange direct
 */
export const acceptDirectExchange = async (
  exchangeId: string,
  acceptingUserId: string,
  collectionName: string = COLLECTIONS.DIRECT_EXCHANGES
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // Vérifier et verrouiller l'échange
      const exchange = await verifyAndLockExchange(transaction, exchangeId, collectionName);
      
      // Effectuer l'échange
      await updateUserPlannings(transaction, {
        originalUserId: exchange.userId,
        newUserId: acceptingUserId,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        timeSlot: exchange.timeSlot,
        operationType: exchange.operationType,
        isPermutation: exchange.operationType === 'exchange'
      });
      
      // Créer une entrée dans l'historique
      const historyRef = doc(collection(db, COLLECTIONS.DIRECT_HISTORY));
      transaction.set(historyRef, {
        originalUserId: exchange.userId,
        newUserId: acceptingUserId,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        timeSlot: exchange.timeSlot,
        exchangedAt: new Date().toISOString(),
        comment: exchange.comment || '',
        operationType: exchange.operationType,
        status: 'completed',
        createdAt: exchange.createdAt,
        lastModified: new Date().toISOString()
      });
      
      // Mettre à jour le statut de l'échange
      transaction.update(doc(db, collectionName, exchangeId), {
        status: 'validated',
        acceptedBy: acceptingUserId,
        acceptedAt: new Date().toISOString(),
        lastModified: serverTimestamp()
      });
      
      // Invalider les caches concernés
      FirestoreCacheUtils.invalidate('direct_exchanges');
      FirestoreCacheUtils.invalidate('user_planning');
    });
    
    // Envoyer les notifications
    // Récupérer les données des utilisateurs
    const [exchangeDoc, acceptingUserDoc] = await Promise.all([
      getDoc(doc(db, collectionName, exchangeId)),
      getDoc(doc(db, 'users', acceptingUserId))
    ]);
    
    if (exchangeDoc.exists() && acceptingUserDoc.exists()) {
      const exchange = exchangeDoc.data() as ShiftExchange;
      const acceptingUser = acceptingUserDoc.data() as User;
      const acceptingUserName = `${acceptingUser.firstName} ${acceptingUser.lastName}`;
      
      // Notification pour le propriétaire original
      if (exchange.operationType === 'exchange') {
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.EXCHANGE_ACCEPTED,
          exchange.date,
          exchange.period,
          exchangeId,
          acceptingUserName
        );
      } else if (exchange.operationType === 'give') {
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.GIVE_ACCEPTED,
          exchange.date,
          exchange.period,
          exchangeId,
          acceptingUserName
        );
      }
    }
  } catch (error) {
    console.error('Error accepting direct exchange:', error);
    throw error;
  }
};

/**
 * Refuser un échange direct
 */
export const rejectDirectExchange = async (
  exchangeId: string,
  rejectingUserId: string,
  collectionName: string = COLLECTIONS.DIRECT_EXCHANGES
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      const exchangeRef = doc(db, collectionName, exchangeId);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        throw new Error('Échange non trouvé');
      }
      
      
      transaction.update(exchangeRef, {
        status: 'cancelled',
        rejectedBy: rejectingUserId,
        rejectedAt: new Date().toISOString(),
        lastModified: serverTimestamp()
      });
    });
    
    // Envoyer une notification de rejet
    const exchangeDoc = await getDoc(doc(db, collectionName, exchangeId));
    const rejectingUserDoc = await getDoc(doc(db, 'users', rejectingUserId));
    
    if (exchangeDoc.exists() && rejectingUserDoc.exists()) {
      const exchange = exchangeDoc.data() as ShiftExchange;
      const rejectingUser = rejectingUserDoc.data() as User;
      const rejectingUserName = `${rejectingUser.firstName} ${rejectingUser.lastName}`;
      
      if (exchange.operationType === 'exchange') {
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.EXCHANGE_REJECTED,
          exchange.date,
          exchange.period,
          exchangeId,
          rejectingUserName
        );
      } else if (exchange.operationType === 'give') {
        await sendExchangeNotification(
          exchange.userId,
          NotificationType.GIVE_REJECTED,
          exchange.date,
          exchange.period,
          exchangeId,
          rejectingUserName
        );
      }
    }
  } catch (error) {
    console.error('Error rejecting direct exchange:', error);
    throw error;
  }
};

/**
 * Supprimer un échange direct
 */
export const removeDirectExchange = async (
  exchangeId: string,
  operationType?: OperationType
): Promise<void> => {
  if (!exchangeId) {
    console.error('ID d\'échange manquant pour la suppression');
    throw new Error('ID d\'échange manquant pour la suppression');
  }
  
  try {
    // Tous les échanges et cessions vont dans DIRECT_EXCHANGES
    let collectionName = COLLECTIONS.DIRECT_EXCHANGES;
    
    // Seuls les remplacements vont dans une collection séparée 
    if (operationType === 'replacement') {
      collectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
    }
    
    console.log(`Suppression de l'échange ${exchangeId} dans la collection ${collectionName}`);
    
    await runTransaction(db, async (transaction) => {
      const exchangeRef = doc(db, collectionName, exchangeId);
      const exchangeDoc = await transaction.get(exchangeRef);
      
      if (!exchangeDoc.exists()) {
        throw new Error('Échange non trouvé');
      }
      
      // Supprimer toutes les propositions associées
      const proposalsQuery = query(
        collection(db, DIRECT_EXCHANGE_PROPOSALS),
        where('targetExchangeId', '==', exchangeId)
      );
      
      const proposalsSnapshot = await getDocs(proposalsQuery);
      
      proposalsSnapshot.forEach(doc => {
        transaction.delete(doc.ref);
      });
      
      // Supprimer l'échange
      transaction.delete(exchangeRef);
    });
    
    // Invalider les caches concernés
    FirestoreCacheUtils.invalidate('direct_exchanges');
    FirestoreCacheUtils.invalidate('direct_exchange_proposals');
  } catch (error) {
    console.error('Error removing direct exchange:', error);
    throw error;
  }
};

/**
 * Mettre à jour les options d'échange et rejeter les propositions incompatibles
 */
export const updateExchangeOptions = async (
  exchangeId: string,
  operationTypes: OperationType[]
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // Récupérer l'échange
      let exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, exchangeId);
      let exchangeDoc = await transaction.get(exchangeRef);
      let collectionName = COLLECTIONS.DIRECT_EXCHANGES;
      let currentOperationType: OperationType = 'exchange';
      
      if (!exchangeDoc.exists()) {
        // Les échanges et cessions sont tous dans DIRECT_EXCHANGES
        // Essayer directement dans la collection des remplacements
        collectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
        currentOperationType = 'replacement';
        exchangeRef = doc(db, collectionName, exchangeId);
        exchangeDoc = await transaction.get(exchangeRef);
        
        if (!exchangeDoc.exists()) {
          throw new Error('Échange non trouvé');
        }
      }
      
      const exchange = exchangeDoc.data() as ShiftExchange;
      
      if (exchange.status !== 'pending') {
        throw new Error('Cet échange n\'est plus disponible');
      }
      
      // Si aucune option n'est sélectionnée, annuler l'échange (y compris pour les remplacements)
      if (operationTypes.length === 0) {
        // Supprimer l'échange quel que soit son type
        console.log(`Suppression de l'échange/remplacement ${exchangeId} dans la collection ${collectionName}`);
        transaction.delete(exchangeRef);
        
        // Rejeter toutes les propositions
        const proposalsQuery = query(
          collection(db, DIRECT_EXCHANGE_PROPOSALS),
          where('targetExchangeId', '==', exchangeId),
          where('status', '==', 'pending')
        );
        
        const proposalsSnapshot = await getDocs(proposalsQuery);
        
        proposalsSnapshot.forEach(doc => {
          transaction.update(doc.ref, {
            status: 'rejected',
            lastModified: serverTimestamp()
          });
        });
      } else {
        // Vérifier si le type d'opération actuel est toujours sélectionné
        if (!operationTypes.includes(currentOperationType)) {
          // Le type d'opération actuel n'est plus sélectionné, il faut créer un nouvel échange
          // et supprimer l'ancien
          
          // Créer un nouvel échange avec le premier type d'opération sélectionné
          const newOperationType = operationTypes[0];
          const newCollectionName = getCollectionByOperationType(newOperationType);
          const newExchangeRef = doc(collection(db, newCollectionName));
          
          // Filtrer les propriétés indéfinies de l'ancien échange
          const filteredExchange = Object.entries(exchange).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
          }, {} as any);
          
          // Copier les données de l'ancien échange (sans les valeurs undefined)
          const newExchangeData = {
            ...filteredExchange,
            operationType: newOperationType,
            lastModified: serverTimestamp()
          };
          
          // Créer le nouvel échange
          transaction.set(newExchangeRef, newExchangeData);
          
          // Supprimer l'ancien échange
          transaction.delete(exchangeRef);
          
          // Mettre à jour les propositions pour pointer vers le nouvel échange
          const proposalsQuery = query(
            collection(db, DIRECT_EXCHANGE_PROPOSALS),
            where('targetExchangeId', '==', exchangeId),
            where('status', '==', 'pending')
          );
          
          const proposalsSnapshot = await getDocs(proposalsQuery);
          
          proposalsSnapshot.forEach(doc => {
            const proposal = doc.data() as DirectExchangeProposal;
            
            // Vérifier si la proposition est compatible avec les nouvelles options
            if (
              (proposal.proposalType === 'exchange' && !operationTypes.includes('exchange')) ||
              (proposal.proposalType === 'take' && !operationTypes.includes('give'))
            ) {
              // Rejeter la proposition incompatible
              transaction.update(doc.ref, {
                status: 'rejected',
                lastModified: serverTimestamp()
              });
            } else {
              // Mettre à jour la proposition pour pointer vers le nouvel échange
              transaction.update(doc.ref, {
                targetExchangeId: newExchangeRef.id,
                lastModified: serverTimestamp()
              });
            }
          });
        } else {
          // Le type d'opération actuel est toujours sélectionné
          // Mettre à jour les options d'échange
          console.log('Mise à jour des options d\'échange avec:', {
            exchangeId,
            operationTypes,
            existingOperationTypes: operationTypes
          });
          
          // Unifier les operationTypes et existingOperationTypes pour éviter la duplication
          transaction.update(exchangeRef, {
            operationTypes: operationTypes, // Source de vérité unique
            // Mettre à jour également operationType pour maintenir la cohérence
            operationType: operationTypes.length === 1 ? operationTypes[0] : 
                          (operationTypes.includes('exchange') && operationTypes.includes('give') ? 'both' : 
                           operationTypes.length > 0 ? operationTypes[0] : 'exchange'),
            lastModified: serverTimestamp()
          });
          
          // Rejeter les propositions incompatibles
          if (!operationTypes.includes('exchange')) {
            // Rejeter toutes les propositions d'échange
            const exchangeProposalsQuery = query(
              collection(db, DIRECT_EXCHANGE_PROPOSALS),
              where('targetExchangeId', '==', exchangeId),
              where('proposalType', '==', 'exchange'),
              where('status', '==', 'pending')
            );
            
            const exchangeProposalsSnapshot = await getDocs(exchangeProposalsQuery);
            
            exchangeProposalsSnapshot.forEach(doc => {
              transaction.update(doc.ref, {
                status: 'rejected',
                lastModified: serverTimestamp()
              });
            });
          }
          
          if (!operationTypes.includes('give')) {
            // Rejeter toutes les propositions de reprise
            const takeProposalsQuery = query(
              collection(db, DIRECT_EXCHANGE_PROPOSALS),
              where('targetExchangeId', '==', exchangeId),
              where('proposalType', '==', 'take'),
              where('status', '==', 'pending')
            );
            
            const takeProposalsSnapshot = await getDocs(takeProposalsQuery);
            
            takeProposalsSnapshot.forEach(doc => {
              transaction.update(doc.ref, {
                status: 'rejected',
                lastModified: serverTimestamp()
              });
            });
          }
        }
      }
    });
    
    // Invalider les caches concernés
    FirestoreCacheUtils.invalidate('direct_exchanges');
    FirestoreCacheUtils.invalidate('direct_exchange_proposals');
    
    // Récupérer les informations sur l'échange et l'utilisateur pour les notifications
    const exchangeDoc = await getDoc(doc(db, getCollectionByOperationType(operationTypes[0] || 'exchange'), exchangeId));
    
    if (exchangeDoc.exists()) {
      const exchange = exchangeDoc.data() as ShiftExchange;
      
      // Récupérer le nom de l'utilisateur qui a fait la modification
      const userDoc = await getDoc(doc(db, 'users', exchange.userId));
      const user = userDoc.exists() ? userDoc.data() as User : null;
      const userName = user ? `${user.firstName} ${user.lastName}` : 'Un utilisateur';
      
      // Récupérer les propositions associées pour envoyer des notifications
      const proposalsQuery = query(
        collection(db, DIRECT_EXCHANGE_PROPOSALS),
        where('targetExchangeId', '==', exchangeId)
      );
      
      const proposalsSnapshot = await getDocs(proposalsQuery);
      
      // Envoyer des notifications aux utilisateurs concernés
      if (operationTypes.length === 0) {
        // L'échange a été annulé
        if (exchange.operationType === 'exchange') {
          // Notifier les utilisateurs qui ont fait des propositions
          proposalsSnapshot.forEach(async (doc) => {
            const proposal = doc.data() as DirectExchangeProposal;
            await createExchangeCancelledNotification(
              proposal.proposingUserId,
              userName,
              exchange.date,
              exchange.period,
              exchangeId
            );
          });
        } else if (exchange.operationType === 'give') {
          // Notifier les utilisateurs qui ont fait des propositions
          proposalsSnapshot.forEach(async (doc) => {
            const proposal = doc.data() as DirectExchangeProposal;
            await createGiveCancelledNotification(
              proposal.proposingUserId,
              userName,
              exchange.date,
              exchange.period,
              exchangeId
            );
          });
        }
      } else {
        // L'échange a été modifié
        if (operationTypes.includes('exchange')) {
          // Notifier les utilisateurs qui ont fait des propositions
          proposalsSnapshot.forEach(async (doc) => {
            const proposal = doc.data() as DirectExchangeProposal;
            await createExchangeUpdatedNotification(
              proposal.proposingUserId,
              userName,
              exchange.date,
              exchange.period,
              exchangeId,
              'Les options d\'échange ont été modifiées'
            );
          });
        } else if (operationTypes.includes('give')) {
          // Notifier les utilisateurs qui ont fait des propositions
          proposalsSnapshot.forEach(async (doc) => {
            const proposal = doc.data() as DirectExchangeProposal;
            await createGiveUpdatedNotification(
              proposal.proposingUserId,
              userName,
              exchange.date,
              exchange.period,
              exchangeId,
              'Les options de cession ont été modifiées'
            );
          });
        }
      }
    }
  } catch (error) {
    console.error('Error updating exchange options:', error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour vérifier les permissions d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param requiredPermission Permission requise
 * @returns Booléen indiquant si l'utilisateur a la permission
 */
export const verifyPermission = async (
  userId: string,
  requiredPermission: string
): Promise<boolean> => {
  try {
    // Récupérer l'utilisateur et ses permissions
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const user = userDoc.data();
    return user.permissions && user.permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Error verifying permission:', error);
    return false;
  }
};

/**
 * Fonction pour journaliser les actions des utilisateurs
 * @param userId ID de l'utilisateur
 * @param action Action effectuée
 * @param details Détails de l'action
 */
export const logUserAction = async (
  userId: string,
  action: string,
  details: any
): Promise<void> => {
  try {
    const logRef = doc(collection(db, 'user_action_logs'));
    await updateDoc(logRef, {
      userId,
      action,
      details,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error logging user action:', error);
    // Ne pas propager l'erreur pour ne pas bloquer les fonctionnalités principales
  }
};
