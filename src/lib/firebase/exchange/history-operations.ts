import { collection, getDocs, query, where, orderBy, doc, getDoc, deleteDoc, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS, createExchangeValidationError, ExchangeHistory, CacheEntry } from './types';
import { findAssignmentInPlanning, removeAssignmentFromPlanningData, addAssignmentToPlanningData } from './planning-operations';

// Cache pour l'historique des échanges
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const historyCache: CacheEntry<ExchangeHistory[]> = {
  data: null,
  timestamp: 0
};

/**
 * Récupère l'historique des échanges
 * @returns Liste des échanges complétés
 */
export const getExchangeHistory = async (): Promise<ExchangeHistory[]> => {
  try {
    // Vérifier si les données en cache sont encore valides
    const now = Date.now();
    if (historyCache.data && now - historyCache.timestamp < CACHE_DURATION) {
      return historyCache.data;
    }

    try {
      // Pas besoin de filtrer sur status=="completed" puisqu'on supprime maintenant les entrées "reverted"
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        orderBy('exchangedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
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

      // Mettre à jour le cache
      historyCache.data = history;
      historyCache.timestamp = now;
      
      return history;
    } catch (indexError: any) {
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, falling back to simple query');
        const simpleQuery = query(
          collection(db, COLLECTIONS.HISTORY)
        );
        const querySnapshot = await getDocs(simpleQuery);
        
        const history = querySnapshot.docs
          .map(doc => {
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
          })
          .filter(history => 'exchangedAt' in history && typeof history.exchangedAt === 'string')
          .sort((a, b) => b.exchangedAt.localeCompare(a.exchangedAt));

        // Mettre à jour le cache
        historyCache.data = history;
        historyCache.timestamp = now;
          
        return history;
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error getting exchange history:', error);
    return []; // Retourner un tableau vide au lieu de throw
  }
};

/**
 * Annule un échange et restaure les gardes d'origine
 * @param historyId ID de l'historique d'échange à annuler
 * @throws Error si l'annulation échoue
 */
export const revertToExchange = async (historyId: string): Promise<void> => {
  try {
    // Récupérer d'abord l'historique pour obtenir les informations nécessaires
    const historyRef = doc(db, COLLECTIONS.HISTORY, historyId);
    const historyDoc = await getDoc(historyRef);
    
    if (!historyDoc.exists()) {
      throw createExchangeValidationError(
        'INVALID_EXCHANGE',
        'Historique de l\'échange non trouvé'
      );
    }
    
    const history = historyDoc.data() as ExchangeHistory;
    
    // Journaliser les informations de l'échange pour le débogage
    console.log('Début de l\'annulation de l\'échange:', {
      historyId,
      originalUserId: history.originalUserId,
      newUserId: history.newUserId,
      date: history.date,
      period: history.period,
      shiftType: history.shiftType,
      isPermutation: history.isPermutation,
      originalUserPeriodId: history.originalUserPeriodId,
      interestedUserPeriodId: history.interestedUserPeriodId
    });
    
    // Exécuter la transaction avec un délai pour s'assurer que Firebase a le temps de traiter
    await runTransaction(db, async (transaction) => {
      // PARTIE 1: TOUTES LES LECTURES
      
      // 1. Récupérer l'historique à nouveau dans la transaction - LECTURE
      const historyDocInTransaction = await transaction.get(historyRef);
      
      if (!historyDocInTransaction.exists()) {
        throw createExchangeValidationError(
          'INVALID_EXCHANGE',
          'Historique de l\'échange non trouvé dans la transaction'
        );
      }
      
      // 2. Récupérer les plannings actuels - LECTURE
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
      
      // 3. Vérifier si l'échange d'origine existe - LECTURE
      let exchangeRef;
      let originalExchangeDoc = null;
      
      if (history.originalExchangeId) {
        exchangeRef = doc(db, COLLECTIONS.EXCHANGES, history.originalExchangeId);
        originalExchangeDoc = await transaction.get(exchangeRef);
      }
      
      // 4. Récupérer les échanges désactivés sur la même date/période - LECTURE
      const unavailableExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', history.date),
        where('period', '==', history.period),
        where('status', '==', 'unavailable')
      );
      
      const unavailableExchangesSnapshot = await getDocs(unavailableExchangesQuery);
      
      // Extraire les données des plannings
      const originalUserPlanningData = originalUserPlanningDoc.exists() ? originalUserPlanningDoc.data() : { assignments: {}, periods: {} };
      const newUserPlanningData = newUserPlanningDoc.exists() ? newUserPlanningDoc.data() : { assignments: {}, periods: {} };
      
      // PARTIE 2: TOUTES LES ÉCRITURES
      
      // 5. Restaurer les gardes
      const assignmentKey = `${history.date}-${history.period}`;
      
      // Vérifier si les gardes existent déjà pour éviter les duplications
      const originalUserHasAssignment = findAssignmentInPlanning(originalUserPlanningData, assignmentKey);
      const newUserHasAssignment = findAssignmentInPlanning(newUserPlanningData, assignmentKey);
      
      console.log('État initial des plannings avant restauration:', {
        originalUserHasAssignment: !!originalUserHasAssignment,
        newUserHasAssignment: !!newUserHasAssignment,
        isPermutation: history.isPermutation,
        originalUserPlanningStructure: Object.keys(originalUserPlanningData)
      });
      
      // Normaliser la structure des données pour s'assurer qu'elle est cohérente
      // Récupérer la structure originale à partir de l'historique ou utiliser une structure standard
      const standardFields = {
        shiftType: history.originalShiftType,
        timeSlot: history.timeSlot,
        period: history.period,
        date: history.date,
        status: "archived", // Ajouter le champ status qui était présent dans les données originales
        type: history.period // Ajouter le champ type qui était présent dans les données originales
      };
      
      // Utiliser les périodes stockées dans l'historique si elles existent
      const originalUserPeriodId = history.originalUserPeriodId || null;
      const interestedUserPeriodId = history.interestedUserPeriodId || null;
      
      console.log('Périodes identifiées pour la restauration:', {
        originalUserPeriodId,
        interestedUserPeriodId,
        fromHistory: {
          originalUserPeriodId: history.originalUserPeriodId,
          interestedUserPeriodId: history.interestedUserPeriodId
        }
      });
      
      if (history.isPermutation) {
        console.log('Annulation d\'une permutation', {
          originalShiftType: history.originalShiftType,
          newShiftType: history.newShiftType,
          date: history.date,
          period: history.period
        });

        // Pour l'utilisateur d'origine, restaurer sa garde initiale avec la structure normalisée
        const originalAssignmentData = { ...standardFields };
        
        // Supprimer d'abord pour éviter les doublons
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
        addAssignmentToPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          originalAssignmentData,
          transaction,
          originalUserPeriodId // Utiliser explicitement la période d'origine
        );
        
        // Pour le nouvel utilisateur, restaurer sa garde initiale (s'il y en avait une)
        if (history.newShiftType) {
          const newAssignmentData = {
            ...standardFields,
            shiftType: history.newShiftType
          };
          
          // Supprimer d'abord pour éviter les doublons
          removeAssignmentFromPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            transaction
          );
          
          // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
          addAssignmentToPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            newAssignmentData,
            transaction,
            interestedUserPeriodId // Utiliser explicitement la période d'origine
          );
        } else {
          // Si pas de garde initiale, s'assurer qu'elle est supprimée du planning
          removeAssignmentFromPlanningData(
            newUserPlanningRef,
            newUserPlanningData,
            assignmentKey,
            transaction
          );
        }
      } else {
        // Restaurer la garde pour un échange simple
        console.log('Annulation d\'un échange simple', {
          originalShiftType: history.originalShiftType,
          date: history.date,
          period: history.period
        });
        
        // Restaurer la garde pour l'utilisateur d'origine avec la structure normalisée
        const originalAssignmentData = { ...standardFields };
        
        // Supprimer d'abord pour éviter les doublons
        removeAssignmentFromPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          transaction
        );
        
        // Puis ajouter avec la structure normalisée en spécifiant explicitement la période d'origine
        addAssignmentToPlanningData(
          originalUserPlanningRef,
          originalUserPlanningData,
          assignmentKey,
          originalAssignmentData,
          transaction,
          originalUserPeriodId // Utiliser explicitement la période d'origine
        );
        
        // Supprimer la garde du planning du nouveau propriétaire
        removeAssignmentFromPlanningData(
          newUserPlanningRef,
          newUserPlanningData,
          assignmentKey,
          transaction
        );
      }
      
      // 6. Réactiver l'échange d'origine ou en créer un nouveau
      if (history.originalExchangeId && originalExchangeDoc && originalExchangeDoc.exists() && exchangeRef) {
        // Réactiver l'échange d'origine en conservant toutes les propriétés importantes
        console.log('Réactivation de l\'échange d\'origine:', history.originalExchangeId);
        
        // Récupérer les données originales de l'échange
        const originalExchangeData = originalExchangeDoc.data();
        
        // Mettre à jour l'échange avec les données originales + nouvelles données
        transaction.update(exchangeRef, {
          userId: history.originalUserId,
          date: history.date,
          period: history.period,
          shiftType: history.shiftType,
          timeSlot: history.timeSlot,
          comment: history.comment || '',
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: history.interestedUsers || [],
          // Conserver les types d'opérations originaux
          operationTypes: originalExchangeData.operationTypes || ['exchange'],
          // Conserver le type d'échange original
          exchangeType: originalExchangeData.exchangeType || 'bag',
          // Conserver les autres propriétés importantes
          proposedToReplacements: originalExchangeData.proposedToReplacements || false
        });
      } else {
        // Créer un nouvel échange avec toutes les propriétés nécessaires
        exchangeRef = doc(collection(db, COLLECTIONS.EXCHANGES));
        transaction.set(exchangeRef, {
          userId: history.originalUserId,
          date: history.date,
          period: history.period,
          shiftType: history.shiftType,
          timeSlot: history.timeSlot,
          comment: history.comment || '',
          createdAt: Timestamp.now(),
          lastModified: Timestamp.now(),
          status: 'pending',
          interestedUsers: history.interestedUsers || [],
          operationTypes: ['exchange'], // Valeur par défaut pour operationTypes
          exchangeType: 'bag', // Valeur par défaut pour le type d'échange
          proposedToReplacements: false // Par défaut, pas proposé aux remplaçants
        });
      }
      
      // 7. Supprimer l'entrée d'historique
      transaction.delete(historyRef);
      
      // 8. Réactiver les échanges désactivés
      if (!unavailableExchangesSnapshot.empty) {
        for (const doc of unavailableExchangesSnapshot.docs) {
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
    
    // Ajouter un délai après la transaction pour s'assurer que les modifications sont propagées
    await new Promise(resolve => setTimeout(resolve, 1000)); // Augmenté à 1000ms pour donner plus de temps
    
    console.log('Annulation de l\'échange terminée avec succès, délai de synchronisation appliqué');
  } catch (error) {
    console.error('Error reverting exchange:', error);
    throw error;
  }
};
