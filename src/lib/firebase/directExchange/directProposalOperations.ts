import { collection, doc, getDocs, getDoc, updateDoc, query, where, orderBy, Timestamp, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { OperationType, ShiftExchange, ShiftPeriod } from '../../../types/exchange';
import { format } from 'date-fns';
import { normalizePeriod } from '../../../utils/dateUtils';
import { COLLECTIONS, DirectExchangeProposal } from './types';
import { User } from '../../../types/users';
import { addNotification, NotificationType, sendExchangeNotification } from '../notifications';

// Collection pour les propositions d'échange
export const DIRECT_EXCHANGE_PROPOSALS = 'direct_exchange_proposals';

/**
 * Proposer un échange multiple (plusieurs gardes contre une)
 */
export const proposeMultipleExchange = async (
  targetExchangeId: string,
  proposingUserId: string,
  proposedShifts: Array<{
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }>,
  comment: string = ''
): Promise<string> => {
  try {
    console.log('Proposition d\'échange multiple:', {
      targetExchangeId,
      proposingUserId,
      proposedShifts,
      comment
    });
    
    if (!targetExchangeId || !proposingUserId || !proposedShifts || proposedShifts.length === 0) {
      throw new Error('Données manquantes pour la proposition d\'échange multiple');
    }
    
    // Déterminer la collection en fonction du type d'opération de l'échange cible
    // Par défaut, on utilise la collection des échanges
    let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
    
    // Récupérer l'échange cible
    const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
    const targetExchangeDoc = await getDoc(targetExchangeRef);
    
    if (!targetExchangeDoc.exists()) {
      // Essayer dans la collection des cessions
      targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
      const targetCessionRef = doc(db, targetCollectionName, targetExchangeId);
      const targetCessionDoc = await getDoc(targetCessionRef);
      
      if (!targetCessionDoc.exists()) {
        throw new Error('Échange cible non trouvé');
      }
    }
    
    // Créer un document pour la proposition d'échange multiple
    const proposalRef = doc(collection(db, DIRECT_EXCHANGE_PROPOSALS));
    
    await runTransaction(db, async (transaction) => {
      // Récupérer l'échange cible à nouveau dans la transaction
      const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
      const targetExchangeDoc = await transaction.get(targetExchangeRef);
      
      if (!targetExchangeDoc.exists()) {
        throw new Error('Échange cible non trouvé dans la transaction');
      }
      
      const targetExchange = targetExchangeDoc.data() as ShiftExchange;
      
      // Vérifier que l'échange est toujours disponible
      if (targetExchange.status !== 'pending') {
        throw new Error('Cet échange n\'est plus disponible');
      }
      
      // Standardiser la période du targetShift
      const targetShiftPeriod = normalizePeriod(targetExchange.period);
      console.log(`Période de l'échange cible standardisée: ${targetExchange.period} -> ${targetShiftPeriod}`);

      // Créer la proposition d'échange avec période standardisée
      transaction.set(proposalRef, {
        targetExchangeId,
        targetUserId: targetExchange.userId,
        proposingUserId,
        targetShift: {
          date: targetExchange.date,
          period: targetShiftPeriod,
          shiftType: targetExchange.shiftType,
          timeSlot: targetExchange.timeSlot
        },
        proposedShifts: proposedShifts.map(shift => {
          // Vérifier et formater la date correctement
          let formattedDate;
          try {
            console.log('Date originale de la garde proposée:', shift.date);
            
            // Vérifier si la date est au format YYYY-MM-DD
            const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(shift.date);
            
            if (isValidFormat) {
              // Si la date est déjà au bon format, la conserver
              formattedDate = shift.date;
              console.log('Date déjà au bon format, conservée:', formattedDate);
            } else {
              // Sinon, essayer de la parser et la formater
              const dateObj = new Date(shift.date);
              
              if (isNaN(dateObj.getTime())) {
                console.warn('Date invalide dans proposedShifts:', shift.date);
                formattedDate = format(new Date(), 'yyyy-MM-dd');
                console.log('Date invalide remplacée par la date actuelle:', formattedDate);
              } else {
                formattedDate = format(dateObj, 'yyyy-MM-dd');
                console.log('Date formatée correctement:', formattedDate);
              }
            }
          } catch (error) {
            console.error('Erreur lors du formatage de la date:', error);
            formattedDate = format(new Date(), 'yyyy-MM-dd');
            console.log('Erreur de formatage, date remplacée par la date actuelle:', formattedDate);
          }
          
          // ÉTAPE CRITIQUE : Standardiser la période en utilisant la fonction commune
          const periodStr = String(shift.period); // Convertir en string pour être sûr
          console.log(`[CRITIQUE] Standardisation de période pour proposeMultipleExchange: ${periodStr}`);
          
          // Utilisation de la fonction standardisée de dateUtils.ts pour assurer la cohérence
          const normalizedPeriod = normalizePeriod(periodStr);
          // Vérification CRITIQUE: toujours s'assurer que la période est bien l'une des valeurs attendues
          if (normalizedPeriod !== 'M' && normalizedPeriod !== 'AM' && normalizedPeriod !== 'S') {
            console.error(`ERREUR CRITIQUE DE STANDARDISATION: La période ${periodStr} a été standardisée en ${normalizedPeriod}, qui n'est pas une valeur valide (M, AM ou S)`);
          }
          console.log(`[CRITIQUE] Période standardisée: ${periodStr} -> ${normalizedPeriod} (Type: ${typeof normalizedPeriod})`);
          
          return {
            date: formattedDate,
            period: normalizedPeriod,
            shiftType: shift.shiftType,
            timeSlot: shift.timeSlot
          };
        }),
        comment,
        status: 'pending',
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now()
      });
      
      // Mettre à jour l'échange cible pour indiquer qu'il a une proposition
      transaction.update(targetExchangeRef, {
        hasProposals: true,
        lastModified: serverTimestamp()
      });
    });
    
    console.log('Proposition d\'échange multiple créée avec succès, ID:', proposalRef.id);
    return proposalRef.id;
  } catch (error) {
    console.error('Error proposing multiple exchange:', error);
    throw error;
  }
};

/**
 * Proposer une reprise simple (sans échange)
 */
export const proposeDirectTake = async (
  targetExchangeId: string,
  targetUserId: string,
  proposingUserId: string,
  targetShift: {
    date: string;
    period: ShiftPeriod;
    shiftType: string;
    timeSlot: string;
  },
  comment: string = ''
): Promise<string> => {
  try {
    console.log('Proposition de reprise directe:', {
      targetExchangeId,
      targetUserId,
      proposingUserId,
      targetShift,
      comment
    });
    
    if (!targetExchangeId || !targetUserId || !proposingUserId || !targetShift) {
      throw new Error('Données manquantes pour la proposition de reprise');
    }
    
    // Déterminer la collection en fonction du type d'opération de l'échange cible
    // Par défaut, on utilise la collection des échanges
    let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
    let operationType: OperationType = 'exchange';
    
    // Récupérer l'échange cible
    const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
    let targetExchangeDoc = await getDoc(targetExchangeRef);
    
    if (!targetExchangeDoc.exists()) {
      // Essayer dans la collection des cessions
      targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
      operationType = 'give';
      const targetCessionRef = doc(db, targetCollectionName, targetExchangeId);
      targetExchangeDoc = await getDoc(targetCessionRef);
      
      if (!targetExchangeDoc.exists()) {
        // Essayer dans la collection des remplacements
        targetCollectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
        operationType = 'replacement';
        const targetReplacementRef = doc(db, targetCollectionName, targetExchangeId);
        targetExchangeDoc = await getDoc(targetReplacementRef);
        
        if (!targetExchangeDoc.exists()) {
          throw new Error('Échange cible non trouvé');
        }
      }
    }
    
    // Créer un document pour la proposition de reprise
    const proposalRef = doc(collection(db, DIRECT_EXCHANGE_PROPOSALS));
    
    await runTransaction(db, async (transaction) => {
      // Récupérer l'échange cible à nouveau dans la transaction
      const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
      const targetExchangeDoc = await transaction.get(targetExchangeRef);
      
      if (!targetExchangeDoc.exists()) {
        throw new Error('Échange cible non trouvé dans la transaction');
      }
      
      const targetExchange = targetExchangeDoc.data() as ShiftExchange;
      
      // Vérifier que l'échange est toujours disponible
      if (targetExchange.status !== 'pending') {
        throw new Error('Cet échange n\'est plus disponible');
      }
      
      // Vérifier que l'utilisateur qui propose n'est pas le propriétaire de l'échange
      if (targetExchange.userId === proposingUserId) {
        throw new Error('Vous ne pouvez pas proposer de reprendre votre propre garde');
      }
      
      // La période est déjà au format ShiftPeriod, aucune standardisation supplémentaire nécessaire
      console.log(`Période de la garde cible dans proposeDirectTake: ${targetShift.period}`);
      
      // Créer la proposition de reprise avec la période au format ShiftPeriod
      transaction.set(proposalRef, {
        targetExchangeId,
        targetUserId,
        proposingUserId,
        proposalType: 'take',
        targetShift: {
          ...targetShift,
          period: targetShift.period
        },
        proposedShifts: [],
        comment,
        status: 'pending',
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now()
      });
      
      // Mettre à jour l'échange cible pour indiquer qu'il a des propositions
      transaction.update(targetExchangeRef, {
        hasProposals: true,
        lastModified: serverTimestamp()
      });
    });
    
    // Récupérer les informations de l'utilisateur qui propose
    try {
      const userRef = doc(db, 'users', proposingUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const proposingUser = userDoc.data() as User;
        
        // Normaliser la période pour la notification
        const normalizedPeriod = normalizePeriod(targetShift.period);
        
        await sendExchangeNotification(
          targetUserId,
          NotificationType.GIVE_PROPOSED,
          format(new Date(targetShift.date), 'yyyy-MM-dd'),
          normalizedPeriod,
          targetExchangeId,
          proposingUser.lastName || 'Un utilisateur'
        );
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      // Ne pas bloquer le processus si la notification échoue
    }
    
    console.log('Proposition de reprise créée avec succès, ID:', proposalRef.id);
    return proposalRef.id;
  } catch (error) {
    console.error('Error proposing direct take:', error);
    throw error;
  }
};

/**
 * Proposer un échange multiple (plusieurs gardes contre une)
 */
export const proposeDirectExchangeMultiple = async (
  targetExchangeId: string,
  targetUserId: string,
  proposingUserId: string,
  targetShift: {
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  },
  proposedShifts: Array<{
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }>,
  comment: string = ''
): Promise<string> => {
  try {
    console.log('Proposition d\'échange multiple:', {
      targetExchangeId,
      targetUserId,
      proposingUserId,
      targetShift,
      proposedShifts,
      comment
    });
    
    if (!targetExchangeId || !targetUserId || !proposingUserId || !targetShift || !proposedShifts || proposedShifts.length === 0) {
      throw new Error('Données manquantes pour la proposition d\'échange multiple');
    }
    
    // Déterminer la collection en fonction du type d'opération de l'échange cible
    // Par défaut, on utilise la collection des échanges
    let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
    let operationType: OperationType = 'exchange';
    
    // Récupérer l'échange cible
    const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
    let targetExchangeDoc = await getDoc(targetExchangeRef);
    
    if (!targetExchangeDoc.exists()) {
      // Essayer dans la collection des cessions
      targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
      operationType = 'give';
      const targetCessionRef = doc(db, targetCollectionName, targetExchangeId);
      targetExchangeDoc = await getDoc(targetCessionRef);
      
      if (!targetExchangeDoc.exists()) {
        throw new Error('Échange cible non trouvé');
      }
    }
    
    // Créer un document pour la proposition d'échange
    const proposalRef = doc(collection(db, DIRECT_EXCHANGE_PROPOSALS));
    
    await runTransaction(db, async (transaction) => {
      // Récupérer l'échange cible à nouveau dans la transaction
      const targetExchangeRef = doc(db, targetCollectionName, targetExchangeId);
      const targetExchangeDoc = await transaction.get(targetExchangeRef);
      
      if (!targetExchangeDoc.exists()) {
        throw new Error('Échange cible non trouvé dans la transaction');
      }
      
      const targetExchange = targetExchangeDoc.data() as ShiftExchange;
      
      // Vérifier que l'échange est toujours disponible
      if (targetExchange.status !== 'pending') {
        throw new Error('Cet échange n\'est plus disponible');
      }
      
      // Vérifier que l'utilisateur qui propose n'est pas le propriétaire de l'échange
      if (targetExchange.userId === proposingUserId) {
        throw new Error('Vous ne pouvez pas proposer d\'échanger votre propre garde');
      }
      
      // Standardiser la période de la garde cible
      const normalizedTargetPeriod = normalizePeriod(targetShift.period);
      console.log(`Période standardisée de la garde cible: ${targetShift.period} -> ${normalizedTargetPeriod}`);
      
      // Créer la proposition d'échange
      transaction.set(proposalRef, {
        targetExchangeId,
        targetUserId,
        proposingUserId,
        proposalType: 'exchange',
        targetShift: {
          ...targetShift,
          period: normalizedTargetPeriod as 'M' | 'AM' | 'S'
        },
        proposedShifts: proposedShifts.map(shift => {
          // Vérifier et formater la date correctement
          let formattedDate;
          try {
            console.log('Date originale de la garde proposée:', shift.date);
            
            // Vérifier si la date est au format YYYY-MM-DD
            const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(shift.date);
            
            if (isValidFormat) {
              // Si la date est déjà au bon format, la conserver
              formattedDate = shift.date;
              console.log('Date déjà au bon format, conservée:', formattedDate);
            } else {
              // Sinon, essayer de la parser et la formater
              const dateObj = new Date(shift.date);
              
              if (isNaN(dateObj.getTime())) {
                console.warn('Date invalide dans proposedShifts:', shift.date);
                formattedDate = format(new Date(), 'yyyy-MM-dd');
                console.log('Date invalide remplacée par la date actuelle:', formattedDate);
              } else {
                formattedDate = format(dateObj, 'yyyy-MM-dd');
                console.log('Date formatée correctement:', formattedDate);
              }
            }
          } catch (error) {
            console.error('Erreur lors du formatage de la date:', error);
            formattedDate = format(new Date(), 'yyyy-MM-dd');
            console.log('Erreur de formatage, date remplacée par la date actuelle:', formattedDate);
          }
          
          // ÉTAPE CRITIQUE : Standardiser la période en utilisant la fonction commune
          const periodStr = String(shift.period); // Convertir en string pour être sûr
          console.log(`[CRITIQUE] Standardisation de période pour garde proposée: ${periodStr}`);
          
          // Utiliser la fonction standardisée de dateUtils.ts pour assurer la cohérence
          const normalizedPeriod = normalizePeriod(periodStr);
          // Vérification CRITIQUE: toujours s'assurer que la période est bien l'une des valeurs attendues
          if (normalizedPeriod !== 'M' && normalizedPeriod !== 'AM' && normalizedPeriod !== 'S') {
            console.error(`ERREUR CRITIQUE DE STANDARDISATION: La période ${periodStr} a été standardisée en ${normalizedPeriod}, qui n'est pas une valeur valide (M, AM ou S)`);
          }
          console.log(`[CRITIQUE] Période standardisée pour garde proposée: ${periodStr} -> ${normalizedPeriod} (Type: ${typeof normalizedPeriod})`);
          
          return {
            date: formattedDate,
            period: normalizedPeriod,
            shiftType: shift.shiftType,
            timeSlot: shift.timeSlot
          };
        }),
        comment,
        status: 'pending',
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now()
      });
      
      // Mettre à jour l'échange cible pour indiquer qu'il a des propositions
      transaction.update(targetExchangeRef, {
        hasProposals: true,
        lastModified: serverTimestamp()
      });
    });
    
    // Récupérer les informations de l'utilisateur qui propose
    try {
      const userRef = doc(db, 'users', proposingUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const proposingUser = userDoc.data() as User;
        
        // Normaliser la période pour la notification
        const normalizedPeriod = normalizePeriod(targetShift.period);
        
        await sendExchangeNotification(
          targetUserId,
          NotificationType.EXCHANGE_PROPOSED,
          format(new Date(targetShift.date), 'yyyy-MM-dd'),
          normalizedPeriod,
          targetExchangeId,
          proposingUser.lastName || 'Un utilisateur'
        );
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      // Ne pas bloquer le processus si la notification échoue
    }
    
    console.log('Proposition d\'échange multiple créée avec succès, ID:', proposalRef.id);
    return proposalRef.id;
  } catch (error) {
    console.error('Error proposing multiple exchange:', error);
    throw error;
  }
};

/**
 * Récupérer les propositions pour un échange
 */
export const getProposalsForExchange = async (exchangeId: string): Promise<DirectExchangeProposal[]> => {
  try {
    // Récupérer les propositions pour l'échange spécifié
    
    const proposalsRef = collection(db, DIRECT_EXCHANGE_PROPOSALS);
    const q = query(
      proposalsRef,
      where('targetExchangeId', '==', exchangeId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`Nombre de propositions trouvées dans Firestore: ${snapshot.size}`);
    
    // Afficher les données brutes pour le débogage
    const proposals = snapshot.docs.map(doc => {
      const data = doc.data() as DirectExchangeProposal;
      console.log('Proposition brute de Firestore:', {
        id: doc.id,
        targetExchangeId: data.targetExchangeId,
        proposingUserId: data.proposingUserId,
        proposalType: data.proposalType,
        status: data.status,
        createdAt: data.createdAt
      });
      
      // Standardiser les périodes dans la proposition
      let standardizedProposal: DirectExchangeProposal = {
        id: doc.id,
        ...data
      };
      
      // Standardiser la période de la garde cible
      if (standardizedProposal.targetShift && standardizedProposal.targetShift.period) {
        const originalPeriod = standardizedProposal.targetShift.period;
        standardizedProposal.targetShift.period = normalizePeriod(originalPeriod);
        console.log(`Standardisation de période pour targetShift de ${doc.id}: ${originalPeriod} -> ${standardizedProposal.targetShift.period}`);
      }
      
      // Standardiser les périodes des gardes proposées
      if (standardizedProposal.proposedShifts && Array.isArray(standardizedProposal.proposedShifts)) {
        standardizedProposal.proposedShifts = standardizedProposal.proposedShifts.map(shift => {
          if (shift && shift.period) {
            const originalPeriod = shift.period;
            const normalizedPeriod = normalizePeriod(originalPeriod);
            console.log(`Standardisation de période pour proposedShift: ${originalPeriod} -> ${normalizedPeriod}`);
            return {
              ...shift,
              period: normalizedPeriod
            };
          }
          return shift;
        });
      }
      
      return standardizedProposal;
    });
    
    return proposals;
  } catch (error) {
    console.error('Error getting proposals for exchange:', error);
    return [];
  }
};

/**
 * Récupérer les propositions faites par un utilisateur
 */
export const getUserProposals = async (userId: string): Promise<DirectExchangeProposal[]> => {
  try {
    if (!userId) {
      console.error('ID utilisateur manquant pour la récupération des propositions');
      return [];
    }
    
    console.log(`Récupération des propositions pour l'utilisateur: ${userId}`);
    
    const proposalsRef = collection(db, DIRECT_EXCHANGE_PROPOSALS);
    const q = query(
      proposalsRef,
      where('proposingUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`Nombre de propositions trouvées pour l'utilisateur: ${snapshot.size}`);
    
    // Standardiser les périodes dans les propositions
    const proposals = snapshot.docs.map(doc => {
      const data = doc.data() as DirectExchangeProposal;
      
      // Créer la proposition avec l'ID
      let standardizedProposal: DirectExchangeProposal = {
        id: doc.id,
        ...data
      };
      
      // Standardiser la période de la garde cible
      if (standardizedProposal.targetShift && standardizedProposal.targetShift.period) {
        const originalPeriod = standardizedProposal.targetShift.period;
        standardizedProposal.targetShift.period = normalizePeriod(originalPeriod);
        console.log(`Standardisation de période pour targetShift de la proposition ${doc.id}: ${originalPeriod} -> ${standardizedProposal.targetShift.period}`);
      }
      
      // Standardiser les périodes des gardes proposées
      if (standardizedProposal.proposedShifts && Array.isArray(standardizedProposal.proposedShifts)) {
        standardizedProposal.proposedShifts = standardizedProposal.proposedShifts.map(shift => {
          if (shift && shift.period) {
            const originalPeriod = shift.period;
            const normalizedPeriod = normalizePeriod(originalPeriod);
            console.log(`Standardisation de période pour proposedShift: ${originalPeriod} -> ${normalizedPeriod}`);
            return {
              ...shift,
              period: normalizedPeriod
            };
          }
          return shift;
        });
      }
      
      return standardizedProposal;
    });
    
    return proposals;
  } catch (error) {
    console.error('Error getting user proposals:', error);
    return [];
  }
};

/**
 * Récupérer les propositions faites par un utilisateur pour un échange spécifique
 */
export const getUserProposalsForExchange = async (userId: string, exchangeId: string): Promise<DirectExchangeProposal[]> => {
  try {
    if (!userId || !exchangeId) {
      console.error('ID utilisateur ou ID échange manquant pour la récupération des propositions');
      return [];
    }
    
    console.log(`Récupération des propositions pour l'utilisateur ${userId} et l'échange ${exchangeId}`);
    
    const proposalsRef = collection(db, DIRECT_EXCHANGE_PROPOSALS);
    const q = query(
      proposalsRef,
      where('proposingUserId', '==', userId),
      where('targetExchangeId', '==', exchangeId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`Nombre de propositions trouvées: ${snapshot.size}`);
    
    // Standardiser les périodes dans les propositions
    const proposals = snapshot.docs.map(doc => {
      const data = doc.data() as DirectExchangeProposal;
      
      // Créer la proposition avec l'ID
      let standardizedProposal: DirectExchangeProposal = {
        id: doc.id,
        ...data
      };
      
      // Standardiser la période de la garde cible
      if (standardizedProposal.targetShift && standardizedProposal.targetShift.period) {
        const originalPeriod = standardizedProposal.targetShift.period;
        standardizedProposal.targetShift.period = normalizePeriod(originalPeriod);
        console.log(`Standardisation de période pour targetShift de la proposition spécifique ${doc.id}: ${originalPeriod} -> ${standardizedProposal.targetShift.period}`);
      }
      
      // Standardiser les périodes des gardes proposées
      if (standardizedProposal.proposedShifts && Array.isArray(standardizedProposal.proposedShifts)) {
        standardizedProposal.proposedShifts = standardizedProposal.proposedShifts.map(shift => {
          if (shift && shift.period) {
            const originalPeriod = shift.period;
            const normalizedPeriod = normalizePeriod(originalPeriod);
            console.log(`Standardisation de période pour proposedShift spécifique: ${originalPeriod} -> ${normalizedPeriod}`);
            return {
              ...shift,
              period: normalizedPeriod
            };
          }
          return shift;
        });
      }
      
      return standardizedProposal;
    });
    
    return proposals;
  } catch (error) {
    console.error('Error getting user proposals for exchange:', error);
    return [];
  }
};

/**
 * Mettre à jour une proposition d'échange existante
 */
export const updateProposal = async (
  proposalId: string,
  proposingUserId: string,
  proposalType: 'take' | 'exchange' | 'both', // Ajout du type 'both' pour les propositions combinées
  proposedShifts: Array<{
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }> = [],
  comment: string = ''
): Promise<string> => {
  try {
    if (!proposalId) {
      throw new Error('ID de proposition manquant pour la mise à jour');
    }
    
    console.log(`Mise à jour de la proposition: ${proposalId}`, {
      proposalType,
      proposedShifts,
      comment
    });
    
    const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
    
    // Vérifier si la proposition existe et appartient à l'utilisateur
    const proposalDoc = await getDoc(proposalRef);
    
    if (!proposalDoc.exists()) {
      throw new Error('Proposition non trouvée');
    }
    
    const existingProposal = proposalDoc.data() as DirectExchangeProposal;
    
    // Vérifier que l'utilisateur est bien le propriétaire de la proposition
    if (existingProposal.proposingUserId !== proposingUserId) {
      throw new Error('Vous n\'êtes pas autorisé à modifier cette proposition');
    }
    
    // Préparer les données de mise à jour
    const updateData: Partial<DirectExchangeProposal> = {
      proposalType: proposalType === 'both' ? 'both' : proposalType, // Nouveau type spécial
      comment,
      lastModified: Timestamp.now()
    };
    
    // Ajouter un indicateur pour les propositions combinées uniquement si c'est true
    // Firestore n'accepte pas les valeurs undefined dans les mises à jour
    if (proposalType === 'both') {
      updateData.isCombinedProposal = true;
    }
    
    // Ajouter les gardes proposées si c'est un échange ou une proposition combinée
    if (proposalType === 'exchange' || proposalType === 'both') {
      // Normaliser les dates des gardes proposées
      const normalizedShifts = proposedShifts.map(shift => {
        // Vérifier et formater la date correctement
        let formattedDate;
        try {
          // Vérifier si la date est au format YYYY-MM-DD
          const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(shift.date);
          
          if (isValidFormat) {
            // Si la date est déjà au bon format, la conserver
            formattedDate = shift.date;
            console.log(`Date déjà au format valide: ${formattedDate}`);
          } else {
            // Sinon, essayer de la parser et la formater
            const dateObj = new Date(shift.date);
            
            if (isNaN(dateObj.getTime())) {
              console.warn('Date invalide dans proposedShifts:', shift.date);
              formattedDate = format(new Date(), 'yyyy-MM-dd');
              console.log(`Date invalide remplacée par aujourd'hui: ${formattedDate}`);
            } else {
              formattedDate = format(dateObj, 'yyyy-MM-dd');
              console.log(`Date formatée: ${shift.date} -> ${formattedDate}`);
            }
          }
        } catch (error) {
          console.error('Erreur lors du formatage de la date:', error);
          formattedDate = format(new Date(), 'yyyy-MM-dd');
          console.log(`Erreur de formatage, date remplacée par aujourd'hui: ${formattedDate}`);
        }
        
        // ÉTAPE CRITIQUE : Standardiser la période en utilisant la fonction commune
        // Convertir explicitement en string pour éviter les problèmes avec des valeurs numériques
        const periodStr = String(shift.period);
        console.log(`[CRITIQUE] Standardisation de période pour Firebase (updateProposal): ${periodStr}`);
        
        // Utilisation systématique et cohérente de la normalisation
        const normalizedPeriod = normalizePeriod(periodStr);
        // Vérification CRITIQUE: toujours s'assurer que la période est bien l'une des valeurs attendues
        const validPeriods = [ShiftPeriod.MORNING, ShiftPeriod.AFTERNOON, ShiftPeriod.EVENING];
        if (!validPeriods.includes(normalizedPeriod)) {
            console.error(`ERREUR CRITIQUE DE NORMALISATION (updateProposal): La période ${periodStr} a été normalisée en ${normalizedPeriod}, qui n'est pas une valeur valide de l'enum ShiftPeriod`);
        }
        console.log(`[CRITIQUE] Période standardisée pour Firebase (updateProposal): ${periodStr} -> ${normalizedPeriod} (Type: ${typeof normalizedPeriod})`);
        
        return {
          date: formattedDate,
          period: normalizedPeriod,
          shiftType: shift.shiftType,
          timeSlot: shift.timeSlot
        };
      });
      
      // Log détaillé des shifts standardisés pour contrôle
      normalizedShifts.forEach((shift, index) => {
        console.log(`Garde #${index+1} standardisée pour Firebase:`, {
          date: shift.date,
          period: shift.period,
          shiftType: shift.shiftType,
          timeSlot: shift.timeSlot
        });
      });
      
      updateData.proposedShifts = normalizedShifts;
    } else {
      // Si c'est une reprise, vider les gardes proposées
      updateData.proposedShifts = [];
    }
    
    // Mettre à jour la proposition
    await updateDoc(proposalRef, updateData);
    
    console.log('Proposition mise à jour avec succès');
    return proposalId;
  } catch (error) {
    console.error('Error updating proposal:', error);
    throw error;
  }
};

/**
 * Annuler une proposition d'échange
 */
export const cancelProposal = async (proposalId: string): Promise<void> => {
  try {
    if (!proposalId) {
      throw new Error('ID de proposition manquant pour l\'annulation');
    }
    
    console.log(`Annulation de la proposition: ${proposalId}`);
    
    // Récupérer la proposition pour les informations de l'échange cible
    const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
    const proposalDoc = await getDoc(proposalRef);
    
    if (!proposalDoc.exists()) {
      throw new Error('Proposition non trouvée');
    }
    
    const proposal = proposalDoc.data() as DirectExchangeProposal;
    
    await runTransaction(db, async (transaction) => {
      // IMPORTANT: Effectuer toutes les lectures AVANT les écritures
      
      // 1. Vérifier s'il reste d'autres propositions pour cet échange
      const otherProposalsQuery = query(
        collection(db, DIRECT_EXCHANGE_PROPOSALS),
        where('targetExchangeId', '==', proposal.targetExchangeId),
        where('status', '==', 'pending')
      );
      
      const otherProposalsSnapshot = await getDocs(otherProposalsQuery);
      
      // 2. Déterminer la collection et récupérer l'échange cible si nécessaire
      let targetExchangeDoc = null;
      let targetExchangeRef = null;
      let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
      
      if (otherProposalsSnapshot.size <= 1) {
        // Si c'était la dernière proposition, on aura besoin de l'échange cible
        targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
        targetExchangeDoc = await transaction.get(targetExchangeRef);
        
        if (!targetExchangeDoc.exists()) {
          // Essayer dans la collection des cessions
          targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
          targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
          targetExchangeDoc = await transaction.get(targetExchangeRef);
          
          if (!targetExchangeDoc.exists()) {
            // Essayer dans la collection des remplacements
            targetCollectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
            targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
            targetExchangeDoc = await transaction.get(targetExchangeRef);
            
            if (!targetExchangeDoc.exists()) {
              console.warn('Échange cible non trouvé lors de l\'annulation de la proposition');
              targetExchangeDoc = null;
            }
          }
        }
      }
      
      // MAINTENANT, effectuer toutes les écritures
      
      // 1. Supprimer la proposition
      transaction.delete(proposalRef);
      
      // 2. Mettre à jour l'échange cible si nécessaire
      if (otherProposalsSnapshot.size <= 1 && targetExchangeDoc) {
        transaction.update(doc(db, targetCollectionName, proposal.targetExchangeId), {
          hasProposals: false,
          lastModified: serverTimestamp()
        });
      }
    });
    
    console.log('Proposition annulée avec succès');
  } catch (error) {
    console.error('Error canceling proposal:', error);
    throw error;
  }
};

/**
 * Accepter une proposition d'échange
 */
export const acceptProposal = async (proposalId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // Récupérer la proposition
      const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
      const proposalDoc = await transaction.get(proposalRef);
      
      if (!proposalDoc.exists()) {
        throw new Error('Proposition non trouvée');
      }
      
      const proposal = proposalDoc.data() as DirectExchangeProposal;
      
      if (proposal.status !== 'pending') {
        throw new Error('Cette proposition n\'est plus disponible');
      }
      
      // Récupérer l'échange cible
      // Déterminer la collection en fonction du type d'opération
      let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
      
      // Récupérer l'échange cible
      const targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
      let targetExchangeDoc = await transaction.get(targetExchangeRef);
      
      if (!targetExchangeDoc.exists()) {
        // Essayer dans la collection des cessions
        targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
        const targetCessionRef = doc(db, targetCollectionName, proposal.targetExchangeId);
        targetExchangeDoc = await transaction.get(targetCessionRef);
        
        if (!targetExchangeDoc.exists()) {
          // Essayer dans la collection des remplacements
          targetCollectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
          const targetReplacementRef = doc(db, targetCollectionName, proposal.targetExchangeId);
          targetExchangeDoc = await transaction.get(targetReplacementRef);
          
          if (!targetExchangeDoc.exists()) {
            throw new Error('Échange cible non trouvé');
          }
        }
      }
      
      const targetExchange = targetExchangeDoc.data() as ShiftExchange;
      
      if (targetExchange.status !== 'pending') {
        throw new Error('Cet échange n\'est plus disponible');
      }
      
      // Mettre à jour la proposition acceptée
      transaction.update(proposalRef, {
        status: 'accepted',
        lastModified: serverTimestamp()
      });
      
      // Mettre à jour l'échange cible uniquement si c'est une proposition de type 'take'
      // Pour les propositions de type 'exchange', l'échange reste disponible pour d'autres propositions
      if (proposal.proposalType === 'take') {
        transaction.update(targetExchangeRef, {
          status: 'validated',
          acceptedBy: proposal.proposingUserId,
          acceptedAt: serverTimestamp(),
          lastModified: serverTimestamp()
        });
      }
      
      // TODO: Effectuer l'échange des gardes dans le planning
      // Cette partie dépend de la structure de votre base de données pour les plannings
    });
    
    // Récupérer les détails pour les notifications
    const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
    const proposalDoc = await getDoc(proposalRef);
    
    if (proposalDoc.exists()) {
      const proposal = proposalDoc.data() as DirectExchangeProposal;
      
      try {
        // Récupérer les informations des utilisateurs
        const targetUserRef = doc(db, 'users', proposal.targetUserId);
        const proposingUserRef = doc(db, 'users', proposal.proposingUserId);
        
        const [targetUserDoc, proposingUserDoc] = await Promise.all([
          getDoc(targetUserRef),
          getDoc(proposingUserRef)
        ]);
        
        if (targetUserDoc.exists() && proposingUserDoc.exists()) {
          const targetUser = targetUserDoc.data() as User;
          
          // Notification pour l'utilisateur qui a proposé l'échange/reprise
          const title1 = 'Proposition acceptée';
          const message1 = `${targetUser.lastName || 'Un utilisateur'} a accepté votre proposition pour la garde du ${format(new Date(proposal.targetShift.date), 'dd/MM/yyyy')} (${proposal.targetShift.period})`;
          
          await addNotification({
            userId: proposal.proposingUserId,
            title: title1,
            message: message1,
            type: NotificationType.EXCHANGE_ACCEPTED,
            relatedId: proposal.targetExchangeId,
            link: '/planning'
          });
          
          // Notification pour l'utilisateur qui a accepté la proposition
          const title2 = proposal.proposalType === 'exchange' ? 'Échange finalisé' : 'Cession finalisée';
          const message2 = `Votre ${proposal.proposalType === 'exchange' ? 'échange' : 'cession'} pour la garde du ${format(new Date(proposal.targetShift.date), 'dd/MM/yyyy')} (${proposal.targetShift.period}) a été finalisé(e)`;
          
          await addNotification({
            userId: proposal.targetUserId,
            title: title2,
            message: message2,
            type: NotificationType.EXCHANGE_COMPLETED,
            relatedId: proposal.targetExchangeId,
            link: '/planning'
          });
        }
      } catch (error) {
        console.error('Error sending notifications:', error);
        // Ne pas bloquer le processus si les notifications échouent
      }
    }
  } catch (error) {
    console.error('Error accepting proposal:', error);
    throw error;
  }
};

/**
 * Rejeter une proposition d'échange
 */
export const rejectProposal = async (proposalId: string): Promise<void> => {
  try {
    console.log(`Début du rejet de la proposition: ${proposalId}`);
    
    // IMPORTANT: Utiliser une transaction pour garantir l'atomicité des opérations
    await runTransaction(db, async (transaction) => {
      // IMPORTANT: Effectuer TOUTES les lectures AVANT TOUTE écriture
      
      // 1. Récupérer la proposition à rejeter
      const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
      const proposalDoc = await transaction.get(proposalRef);
      
      if (!proposalDoc.exists()) {
        throw new Error('Proposition non trouvée');
      }
      
      const proposal = proposalDoc.data() as DirectExchangeProposal;
      console.log(`Rejet de proposition - ID: ${proposalId}, Type: ${proposal.proposalType}, TargetExchange: ${proposal.targetExchangeId}`);
      
      // 2. Vérifier s'il reste d'autres propositions pour cet échange
      // ⚠️ IMPORTANT: Ne vérifier que pour ce proposingUserId spécifique et ce proposalType spécifique
      // pour garantir que chaque proposition est indépendante
      let otherProposalsFromSameUserQuery;
      
      // Vérifier si proposalType est défini pour éviter l'erreur "Unsupported field value: undefined"
      if (proposal.proposalType) {
        // Si proposalType est défini, utiliser la requête originale avec tous les filtres
        console.log(`Recherche de propositions avec proposalType: ${proposal.proposalType}`);
        otherProposalsFromSameUserQuery = query(
          collection(db, DIRECT_EXCHANGE_PROPOSALS),
          where('targetExchangeId', '==', proposal.targetExchangeId),
          where('proposingUserId', '==', proposal.proposingUserId),
          where('proposalType', '==', proposal.proposalType),
          where('status', '==', 'pending')
        );
      } else {
        // Si proposalType est undefined, ne pas filtrer sur ce champ
        console.log('⚠️ proposalType est undefined, utilisation d\'une requête alternative sans ce filtre');
        otherProposalsFromSameUserQuery = query(
          collection(db, DIRECT_EXCHANGE_PROPOSALS),
          where('targetExchangeId', '==', proposal.targetExchangeId),
          where('proposingUserId', '==', proposal.proposingUserId),
          where('status', '==', 'pending')
        );
      }
      
      const otherProposalsFromSameUserSnapshot = await getDocs(otherProposalsFromSameUserQuery);
      
      // Compter les autres propositions du même utilisateur et du même type, en excluant celle qu'on rejette
      const otherProposalCount = otherProposalsFromSameUserSnapshot.docs
        .filter(doc => doc.id !== proposalId)
        .length;
      
      console.log(`Autres propositions du même utilisateur et type: ${otherProposalCount}`);
      
      // 3. Vérifier s'il reste des propositions QUELCONQUES pour cet échange
      // pour savoir si on doit mettre à jour le flag hasProposals
      const anyProposalsQuery = query(
        collection(db, DIRECT_EXCHANGE_PROPOSALS),
        where('targetExchangeId', '==', proposal.targetExchangeId),
        where('status', '==', 'pending')
      );
      
      const anyProposalsSnapshot = await getDocs(anyProposalsQuery);
      
      // Compter toutes les propositions, en excluant celle qu'on rejette
      const anyProposalCount = anyProposalsSnapshot.docs
        .filter(doc => doc.id !== proposalId)
        .length;
      
      console.log(`Total des propositions restantes pour cet échange: ${anyProposalCount}`);
      
      // 4. Si nécessaire, récupérer l'échange cible pour mettre à jour hasProposals
      let targetExchangeDoc = null;
      let targetExchangeRef = null;
      let targetCollectionName = COLLECTIONS.DIRECT_EXCHANGES;
      
      // Récupérer l'échange cible uniquement s'il n'y a plus aucune proposition
      if (anyProposalCount === 0) {
        console.log(`Plus aucune proposition active pour l'échange ${proposal.targetExchangeId}, récupération de l'échange cible`);
        
        // Vérifier successivement dans les différentes collections
        targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
        targetExchangeDoc = await transaction.get(targetExchangeRef);
        
        if (!targetExchangeDoc.exists()) {
          // Essayer dans la collection des cessions
          targetCollectionName = COLLECTIONS.DIRECT_CESSIONS;
          targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
          targetExchangeDoc = await transaction.get(targetExchangeRef);
          
          if (!targetExchangeDoc.exists()) {
            // Essayer dans la collection des remplacements
            targetCollectionName = COLLECTIONS.DIRECT_REPLACEMENTS;
            targetExchangeRef = doc(db, targetCollectionName, proposal.targetExchangeId);
            targetExchangeDoc = await transaction.get(targetExchangeRef);
            
            if (!targetExchangeDoc.exists()) {
              console.warn(`⚠️ Échange cible ${proposal.targetExchangeId} non trouvé lors du rejet de la proposition`);
              targetExchangeDoc = null;
            }
          }
        }
      }
      
      // MAINTENANT, effectuer toutes les écritures
      
      // 1. UNIQUEMENT rejeter la proposition spécifiée
      console.log(`Mise à jour du statut de la proposition ${proposalId} à 'rejected'`);
      transaction.update(proposalRef, {
        status: 'rejected',
        lastModified: serverTimestamp()
      });
      
      // 2. Mettre à jour le flag hasProposals de l'échange uniquement s'il n'y a plus de propositions
      if (anyProposalCount === 0 && targetExchangeDoc) {
        console.log(`Mise à jour du flag hasProposals à false pour l'échange ${proposal.targetExchangeId}`);
        transaction.update(doc(db, targetCollectionName, proposal.targetExchangeId), {
          hasProposals: false,
          lastModified: serverTimestamp()
        });
      } else if (targetExchangeDoc) {
        console.log(`Il reste encore ${anyProposalCount} proposition(s), le flag hasProposals reste à true`);
      }
    });
    
    // Récupérer les détails pour les notifications une fois que tout est terminé
    // Utiliser une nouvelle référence pour obtenir les données les plus récentes
    const proposalRef = doc(db, DIRECT_EXCHANGE_PROPOSALS, proposalId);
    const proposalDoc = await getDoc(proposalRef);
    
    if (proposalDoc.exists()) {
      const proposal = proposalDoc.data() as DirectExchangeProposal;
      console.log(`Préparation de la notification pour la proposition ${proposalId}`);
      
      // Envoyer une notification à l'utilisateur dont la proposition a été rejetée
      try {
        // Récupérer les infos de l'utilisateur qui a FAIT le rejet (targetUserId est celui qui possède la garde)
        const targetUserRef = doc(db, 'users', proposal.targetUserId);
        const targetUserDoc = await getDoc(targetUserRef);
        
        if (targetUserDoc.exists()) {
          const targetUser = targetUserDoc.data() as User;
          
          // Déterminer le type de notification et le message approprié selon le type de proposition
          let title, message;
          let dateFormatted = '';
          
          try {
            // Formatter la date pour la notification
            dateFormatted = format(new Date(proposal.targetShift.date), 'dd/MM/yyyy');
          } catch (e) {
            console.error("Erreur de formatage de la date:", e);
            dateFormatted = proposal.targetShift.date || 'date inconnue';
          }
          
          if (proposal.proposalType === 'exchange') {
            title = 'Échange refusé';
            message = `${targetUser.lastName || 'Un utilisateur'} a refusé votre proposition d'échange pour la garde du ${dateFormatted} (${proposal.targetShift.period})`;
          } else if (proposal.proposalType === 'take') {
            title = 'Reprise refusée';
            message = `${targetUser.lastName || 'Un utilisateur'} a refusé votre proposition de reprise pour la garde du ${dateFormatted} (${proposal.targetShift.period})`;
          } else if (proposal.proposalType === 'both') {
            title = 'Proposition refusée';
            message = `${targetUser.lastName || 'Un utilisateur'} a refusé votre proposition d'échange et de reprise pour la garde du ${dateFormatted} (${proposal.targetShift.period})`;
          } else {
            title = 'Proposition refusée';
            message = `${targetUser.lastName || 'Un utilisateur'} a refusé votre proposition pour la garde du ${dateFormatted} (${proposal.targetShift.period})`;
          }
          
          // Envoyer la notification uniquement à l'utilisateur qui a fait la proposition
          await addNotification({
            userId: proposal.proposingUserId,
            title,
            message,
            type: NotificationType.EXCHANGE_REJECTED,
            relatedId: proposal.targetExchangeId,
            link: '/direct-exchange'
          });
          
          console.log(`Notification de rejet envoyée à l'utilisateur ${proposal.proposingUserId}`);
        }
      } catch (error) {
        console.error('Error sending notification:', error);
        // Ne pas bloquer le processus si la notification échoue
      }
    } else {
      console.log(`Proposition ${proposalId} non trouvée pour la notification (elle a peut-être été supprimée)`);
    }
    
    console.log(`Rejet de la proposition ${proposalId} terminé avec succès`);
  } catch (error) {
    console.error('Error rejecting proposal:', error);
    throw error;
  }
};
