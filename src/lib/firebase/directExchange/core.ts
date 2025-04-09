import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Transaction, 
  onSnapshot,
  orderBy,
  runTransaction,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { normalizePeriod } from '../../../utils/dateUtils';
import { COLLECTIONS, ExchangeData } from './types';
import { ShiftPeriod } from '../../../types/exchange';

// Validation des données communes
export const validateExchangeData = (data: SimpleExchangeData): void => {
  console.log('Validation des données d\'échange:', data);
  
  // Vérifier que tous les champs requis sont présents
  if (!data.userId || !data.date || !data.period || !data.shiftType || !data.timeSlot) {
    console.error('Données manquantes pour l\'échange de garde:', data);
    
    // Détailler les champs manquants
    const missingFields = [];
    if (!data.userId) missingFields.push('userId');
    if (!data.date) missingFields.push('date');
    if (!data.period) missingFields.push('period');
    if (!data.shiftType) missingFields.push('shiftType');
    if (!data.timeSlot) missingFields.push('timeSlot');
    
    throw new Error(`Données manquantes pour l'échange de garde: ${missingFields.join(', ')}`);
  }
  
  // Vérifier que la période est valide en utilisant l'enum ShiftPeriod
  const validPeriods = [ShiftPeriod.MORNING, ShiftPeriod.AFTERNOON, ShiftPeriod.EVENING];
  const normalizedPeriod = normalizePeriod(data.period);
  
  if (!validPeriods.includes(normalizedPeriod)) {
    console.error('Période invalide pour l\'échange de garde:', data.period);
    throw new Error(`Période invalide: ${data.period}`);
  }
  
  // Vérifier que la date est au bon format
  try {
    // Tenter de parser la date pour vérifier qu'elle est valide
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Date invalide');
    }
  } catch (error) {
    console.error('Date invalide pour l\'échange de garde:', data.date);
    throw new Error(`Date invalide: ${data.date}`);
  }
  
  console.log('Validation des données réussie');
};

// Vérifier si un échange existe déjà pour cette garde
export const checkExistingExchange = async (
  userId: string,
  date: string,
  period: string,
  operationTypes: string[] | string
): Promise<boolean> => {
  try {
    // Déterminer la collection en fonction des types d'opération
    const collectionName = getCollectionByOperationType(operationTypes);
    
    // Créer la requête
    const q = query(
      collection(db, collectionName),
      where('userId', '==', userId),
      where('date', '==', date),
      where('period', '==', period),
      where('status', '==', 'pending')
    );
    
    // Exécuter la requête
    const querySnapshot = await getDocs(q);
    
    // Retourner true si des documents existent
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Erreur lors de la vérification des échanges existants:', error);
    return false;
  }
};

// Vérifier si une garde est déjà proposée dans la bourse aux gardes
export const checkExistingShiftExchange = async (
  userId: string,
  date: string,
  period: string
): Promise<{exists: boolean, exchangeIds: string[]}> => {
  try {
    console.log('Vérification si la garde est déjà dans la bourse aux gardes:', {
      userId,
      date,
      period
    });
    
    // Créer la requête pour la collection shift_exchanges (bourse aux gardes)
    const q = query(
      collection(db, 'shift_exchanges'),
      where('userId', '==', userId),
      where('date', '==', date),
      where('period', '==', period),
      where('status', 'in', ['pending', 'unavailable'])
    );
    
    // Exécuter la requête
    const querySnapshot = await getDocs(q);
    
    const exists = !querySnapshot.empty;
    const exchangeIds = querySnapshot.docs.map(doc => doc.id);
    
    if (exists) {
      console.warn('Cette garde est déjà proposée dans la bourse aux gardes:', {
        userId,
        date,
        period,
        count: querySnapshot.size,
        exchangeIds
      });
    }
    
    // Retourner true si des documents existent, ainsi que les IDs des échanges
    return { exists, exchangeIds };
  } catch (error) {
    console.error('Erreur lors de la vérification dans la bourse aux gardes:', error);
    return { exists: false, exchangeIds: [] };
  }
};

// Supprimer une garde de la bourse aux gardes dans une transaction
export const removeFromShiftExchange = async (
  transaction: Transaction,
  exchangeIds: string[]
): Promise<void> => {
  try {
    if (!exchangeIds || exchangeIds.length === 0) {
      console.log('Aucun échange à supprimer de la bourse aux gardes');
      return;
    }
    
    console.log('Suppression des gardes de la bourse aux gardes:', exchangeIds);
    
    // Supprimer chaque échange de la bourse aux gardes
    for (const exchangeId of exchangeIds) {
      const exchangeRef = doc(db, 'shift_exchanges', exchangeId);
      
      // Marquer l'échange comme annulé
      transaction.update(exchangeRef, {
        status: 'cancelled',
        lastModified: new Date().toISOString(),
        removedByDirectExchange: true
      });
      
      console.log(`Échange ${exchangeId} marqué comme annulé dans la bourse aux gardes`);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression des gardes de la bourse aux gardes:', error);
    throw error;
  }
};

// Vérifier si une garde est marquée comme désiderata
export const checkDesiderata = async (
  userId: string,
  date: string,
  period: string
): Promise<{ isDesiderata: boolean; type?: 'primary' | 'secondary' }> => {
  try {
    console.log('Vérification si la garde est un désiderata:', {
      userId,
      date,
      period
    });
    
    // Créer la requête pour la collection desiderata
    const desiderataRef = doc(db, 'desiderata', userId);
    const desiderataDoc = await getDoc(desiderataRef);
    
    if (!desiderataDoc.exists()) {
      return { isDesiderata: false };
    }
    
    const desiderata = desiderataDoc.data();
    const selections = desiderata.selections || {};
    
    // Clé pour cette date et période
    const key = `${date}-${period}`;
    
    if (selections[key] === 'primary') {
      console.warn('Cette garde est un désiderata primaire:', {
        userId,
        date,
        period
      });
      return { isDesiderata: true, type: 'primary' };
    } else if (selections[key] === 'secondary') {
      console.warn('Cette garde est un désiderata secondaire:', {
        userId,
        date,
        period
      });
      return { isDesiderata: true, type: 'secondary' };
    }
    
    return { isDesiderata: false };
  } catch (error) {
    console.error('Erreur lors de la vérification des désiderata:', error);
    return { isDesiderata: false };
  }
};

// Déterminer la collection en fonction des types d'opération
export const getCollectionByOperationType = (operationTypes: string[] | string): string => {
  // Log pour debugging
  console.log('getCollectionByOperationType appelé avec:', operationTypes);
  
  // Convertir en tableau si c'est une chaîne
  const types = Array.isArray(operationTypes) ? operationTypes : [operationTypes];
  
  // Si le tableau contient 'replacement' et aucun autre type, utiliser la collection des remplacements
  if (types.includes('replacement') && types.length === 1) {
    return COLLECTIONS.DIRECT_REPLACEMENTS;
  } else {
    // Pour tous les autres cas, utiliser direct_exchanges
    console.log('Tous les types d\'échanges utilisent désormais la collection direct_exchanges');
    return COLLECTIONS.DIRECT_EXCHANGES;
  }
};

/**
 * Souscrire aux échanges directs en temps réel
 * @param callback Fonction appelée à chaque mise à jour des données
 * @returns Fonction pour annuler la souscription
 */
export const subscribeToDirectExchanges = (
  callback: (exchanges: any[]) => void
): (() => void) => {
  try {
    console.log('Mise en place de la souscription aux échanges directs');
    
    // Créer une requête pour les échanges directs uniquement
    // Tous les types d'échanges/cessions sont maintenant dans DIRECT_EXCHANGES
    const exchangesQuery = query(
      collection(db, COLLECTIONS.DIRECT_EXCHANGES),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    // Créer une requête pour les remplacements directs
    const replacementsQuery = query(
      collection(db, COLLECTIONS.DIRECT_REPLACEMENTS),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    // Stocker les données actuelles de chaque collection
    let currentExchangesData: any[] = [];
    let currentReplacementsData: any[] = [];
    
    // Fonction pour combiner et envoyer les données
    const combineAndSendData = () => {
      const allExchanges = [
        ...currentExchangesData,
        ...currentReplacementsData
      ];
      
      console.log('Mise à jour des données combinées:', {
        exchanges: currentExchangesData.length,
        replacements: currentReplacementsData.length,
        total: allExchanges.length
      });
      
      // Appeler le callback avec les données combinées
      callback(allExchanges);
    };
    
    // Souscrire aux échanges directs
    const unsubscribeExchanges = onSnapshot(exchangesQuery, (snapshot) => {
      console.log('Mise à jour des échanges directs reçue:', snapshot.docs.length);
      
      currentExchangesData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Normaliser les données pour assurer la cohérence
        // operationTypes est la source unique de vérité
        let operationTypes;
        
        // Utiliser operationTypes s'il existe
        if (data.operationTypes && Array.isArray(data.operationTypes)) {
          operationTypes = [...data.operationTypes]; // Créer une copie pour éviter les références
        }
        // Sinon, dériver de operationType (pour la compatibilité avec les anciens documents)
        else if (data.operationType) {
          if (data.operationType === 'both') {
            operationTypes = ['exchange', 'give'];
          } else {
            operationTypes = [data.operationType];
          }
        }
        // Valeur par défaut
        else {
          operationTypes = ['exchange'];
        }
        
        // Supprimer les propriétés obsolètes pour éviter la duplication
        // existingOperationTypes a été remplacé par operationTypes comme source unique de vérité
        // operationType est conservé pour la rétrocompatibilité mais n'est plus la source principale
        const { existingOperationTypes, operationType, ...cleanedData } = data;
        
        const result = {
          id: doc.id,
          ...cleanedData,
          // Utiliser uniquement operationTypes comme source de vérité
          operationTypes: operationTypes
        };
        
        console.log(`Échange ${doc.id} normalisé:`, {
          operationTypes: result.operationTypes
        });
        
        return result;
      });
      
      combineAndSendData();
    });
    
    // Souscrire aux remplacements directs
    const unsubscribeReplacements = onSnapshot(replacementsQuery, (snapshot) => {
      console.log('Mise à jour des remplacements directs reçue:', snapshot.docs.length);
      
      currentReplacementsData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          ...data,
          operationTypes: ['replacement'] // Assurer que operationTypes est défini correctement
        };
      });
      
      combineAndSendData();
    });
    
    // Retourner une fonction qui annule toutes les souscriptions
    return () => {
      console.log('Annulation des souscriptions aux échanges directs');
      unsubscribeExchanges();
      unsubscribeReplacements();
    };
  } catch (error) {
    console.error('Erreur lors de la souscription aux échanges directs:', error);
    return () => {}; // Retourner une fonction vide en cas d'erreur
  }
};

/**
 * Souscrire aux propositions d'un utilisateur en temps réel
 * @param userId ID de l'utilisateur
 * @param callback Fonction appelée à chaque mise à jour des données
 * @returns Fonction pour annuler la souscription
 */
export const subscribeToUserProposals = (
  userId: string,
  callback: (proposals: any[]) => void
): (() => void) => {
  try {
    console.log('Mise en place de la souscription aux propositions de l\'utilisateur:', userId);
    
    // Créer une requête pour les propositions de l'utilisateur avec statut "pending" uniquement
    const proposalsQuery = query(
      collection(db, COLLECTIONS.DIRECT_PROPOSALS),
      where('proposingUserId', '==', userId),
      where('status', '==', 'pending'), // Ajouter un filtre sur le statut "pending"
      orderBy('createdAt', 'desc')
    );
    
    // Souscrire aux propositions
    const unsubscribeProposals = onSnapshot(proposalsQuery, (snapshot) => {
      const proposalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Appeler le callback avec les données
      callback(proposalsData);
    });
    
    return unsubscribeProposals;
  } catch (error) {
    console.error('Erreur lors de la souscription aux propositions de l\'utilisateur:', error);
    return () => {}; // Retourner une fonction vide en cas d'erreur
  }
};

/**
 * Type simplifié pour les données d'échange
 */
export type SimpleExchangeData = {
  userId: string;
  date: string;
  period: string | ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  comment?: string;
};

/**
 * Créer un échange combiné avec plusieurs types d'opérations
 * @param exchange Données de l'échange simplifiées
 * @param operationTypes Types d'opérations sélectionnés
 * @returns ID de l'échange créé et ID du remplacement si applicable
 */
export const createCombinedExchange = async (
  exchange: SimpleExchangeData,
  operationTypes: string[]
): Promise<{ exchangeId?: string; replacementId?: string }> => {
  try {
    console.log('Création d\'un échange combiné:', {
      exchange,
      operationTypes
    });
    
    // Validation des données
    validateExchangeData(exchange);
    
    // Vérifier si les opérations incluent un remplacement
    const includesReplacement = operationTypes.includes('replacement');
    
    // Vérifier si les opérations incluent un échange ou une cession
    const includesExchangeOrGive = operationTypes.includes('exchange') || operationTypes.includes('give');
    
    // Si aucune opération n'est sélectionnée, retourner une erreur
    if (operationTypes.length === 0) {
      throw new Error('Aucune opération sélectionnée');
    }
    
    // Normaliser la période
    const normalizedPeriod = normalizePeriod(exchange.period);
    
    // Vérifier si la garde est déjà dans la bourse aux gardes
    const { exists: existingInShiftExchange, exchangeIds } = await checkExistingShiftExchange(
      exchange.userId,
      exchange.date,
      normalizedPeriod
    );
    
    // Résultat à retourner
    const result: { exchangeId?: string; replacementId?: string } = {};
    
    // Exécuter la transaction
    await runTransaction(db, async (transaction) => {
      // Si la garde existe déjà dans la bourse aux gardes, la supprimer
      if (existingInShiftExchange && exchangeIds.length > 0) {
        await removeFromShiftExchange(transaction, exchangeIds);
      }
      
      // Créer d'abord le remplacement s'il est sélectionné (avant l'échange principal)
      // pour s'assurer qu'il soit disponible immédiatement après la transaction
      if (includesReplacement) {
        // Créer une référence pour le document de remplacement
        const replacementRef = doc(collection(db, COLLECTIONS.DIRECT_REPLACEMENTS));
        
        // Créer le document de remplacement
        transaction.set(replacementRef, {
          // On mettra à jour l'exchangeId après si nécessaire
          date: exchange.date,
          period: normalizedPeriod,
          shiftType: exchange.shiftType,
          timeSlot: exchange.timeSlot,
          originalUserId: exchange.userId,
          comment: exchange.comment || '',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          status: 'pending',
          notifiedUsers: []
        });
        
        // Stocker l'ID du remplacement dans le résultat
        result.replacementId = replacementRef.id;
        
        console.log('Remplacement créé avec ID:', replacementRef.id);
      }
      
      // Si l'échange ou la cession est sélectionné, créer un document dans direct_exchanges
      if (includesExchangeOrGive) {
        // Déterminer le type d'opération principal
        let primaryOperationType: 'exchange' | 'give' = operationTypes.includes('exchange') ? 'exchange' : 'give';
        
        // Créer une référence pour le document d'échange
        const exchangeRef = doc(collection(db, COLLECTIONS.DIRECT_EXCHANGES));
        
        // Déterminer si c'est un échange combiné (échange + cession)
        const isCombined = operationTypes.includes('exchange') && operationTypes.includes('give');
        
        // Filtrer les opérations qui vont dans ce document (sans replacement)
        const exchangeOperationTypes: string[] = operationTypes.filter(type => type !== 'replacement');
        
        // Ajouter le remplacement à la liste des opérations si applicable
        if (includesReplacement) {
          exchangeOperationTypes.push('replacement');
          console.log('Remplacement ajouté aux operationTypes dans l\'échange principal');
        }
        
        console.log('Création du document avec operationTypes:', exchangeOperationTypes, 
                    'et operationType:', isCombined ? 'both' : primaryOperationType);
        
        // Préparer les données du document d'échange
        const exchangeData: any = {
          ...exchange,
          period: normalizedPeriod,
          createdAt: Timestamp.now(),
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: [],
          exchangeType: 'direct',
          // Stocker tous les types d'opérations y compris replacement
          // C'est la seule source de vérité pour les types d'opérations
          operationTypes: exchangeOperationTypes
        };
        
        // Ajouter la référence au remplacement seulement si elle existe
        if (result.replacementId) {
          exchangeData.replacementId = result.replacementId;
        }
        
        // Créer le document d'échange
        transaction.set(exchangeRef, exchangeData);
        
        // Stocker l'ID de l'échange dans le résultat
        result.exchangeId = exchangeRef.id;
        
        // Si un remplacement a été créé, mettre à jour sa référence à l'échange
        if (result.replacementId) {
          const replacementRef = doc(db, COLLECTIONS.DIRECT_REPLACEMENTS, result.replacementId);
          transaction.update(replacementRef, {
            exchangeId: exchangeRef.id
          });
          console.log('Mise à jour de l\'ID d\'échange dans le remplacement:', exchangeRef.id);
        }
      }
    });
    
    console.log('Échange combiné créé avec succès:', result);
    return result;
  } catch (error) {
    console.error('Erreur lors de la création de l\'échange combiné:', error);
    throw error;
  }
};
