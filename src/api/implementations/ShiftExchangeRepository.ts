/**
 * Implémentation du repository de la bourse aux gardes avec Firebase
 */

import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  runTransaction,
  Timestamp,
  updateDoc,
  serverTimestamp,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ShiftExchange, ShiftPeriod } from '@/types/exchange';
import { BagPhase, ShiftExchangeStatus } from '@/features/shiftExchange/types';
import { BagPhaseConfig } from '@/types/planning';
import { 
  IShiftExchangeRepository, 
  ShiftExchangeDocument, 
  ShiftExchangeSearchOptions 
} from '../interfaces/IShiftExchangeRepository';
import { ExchangeBaseRepository } from './ExchangeBaseRepository';
import { getCollectionName } from '@/utils/collectionUtils';
import { format, isWithinInterval, isBefore } from 'date-fns';
import { normalizePeriod } from '@/utils/dateUtils';
import { getPlanningRepository } from '../repositories';
import { createParisDate, toParisTime, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';

/**
 * Repository pour la gestion de la bourse aux gardes
 */
export class ShiftExchangeRepository 
  extends ExchangeBaseRepository<ShiftExchangeDocument> 
  implements IShiftExchangeRepository {

  constructor(associationId: string = 'RD') {
    super('shift_exchanges', associationId);
  }

  /**
   * Créer un nouvel échange dans la bourse
   */
  async createShiftExchange(
    exchangeData: Omit<ShiftExchangeDocument, 'id' | 'createdAt' | 'lastModified' | 'exchangeType'>,
    associationId: string
  ): Promise<ShiftExchangeDocument> {
    try {
      // Vérifier que les soumissions sont ouvertes
      const canSubmit = await this.canSubmitExchange(associationId);
      if (!canSubmit) {
        throw new Error('Les soumissions ne sont pas ouvertes actuellement');
      }

      // Valider les données
      this.validateExchangeData(exchangeData as any);
      
      // Normaliser les données
      const normalizedData = this.normalizeExchangeData(exchangeData as any);
      
      // Vérifier que la garde existe dans le planning
      const shiftExists = await this.verifyShiftExists(
        exchangeData.userId,
        exchangeData.date,
        exchangeData.period,
        exchangeData.shiftType,
        associationId
      );

      if (!shiftExists) {
        throw new Error('Cette garde n\'existe pas dans votre planning');
      }

      // Vérifier les conflits avec d'autres systèmes
      const { hasConflict, conflictType } = await this.checkConflictWithOtherExchangeSystems(
        exchangeData.userId,
        exchangeData.date,
        exchangeData.period,
        associationId,
        'shift_exchanges'
      );

      if (hasConflict) {
        throw new Error(`Cette garde est déjà proposée dans ${conflictType}`);
      }

      // Créer l'échange
      const exchange = await this.create({
        ...normalizedData,
        exchangeType: 'bag',
        status: 'pending',
        interestedUsers: []
      } as any);

      return exchange;
    } catch (error) {
      console.error('Erreur lors de la création de l\'échange dans la bourse:', error);
      throw error;
    }
  }

  /**
   * Récupérer les échanges actifs de la bourse
   */
  async getActiveShiftExchanges(associationId: string): Promise<ShiftExchangeDocument[]> {
    try {
      const exchanges = await this.getAll({
        where: [
          { field: 'status', operator: 'in', value: ['pending', 'matched'] }
        ],
        orderBy: 'date',
        orderDirection: 'asc'
      });

      return exchanges;
    } catch (error) {
      console.error('Erreur lors de la récupération des échanges actifs:', error);
      return [];
    }
  }

  /**
   * Rechercher des échanges avec filtres
   */
  async searchShiftExchanges(
    options: ShiftExchangeSearchOptions,
    associationId: string
  ): Promise<ShiftExchangeDocument[]> {
    try {
      let exchanges = await this.getActiveShiftExchanges(associationId);

      // Filtrer par utilisateur
      if (options.userId && options.showOwnShifts) {
        exchanges = exchanges.filter(e => e.userId === options.userId);
      } else if (options.excludeUserId && !options.showOwnShifts) {
        exchanges = exchanges.filter(e => e.userId !== options.excludeUserId);
      }

      // Filtrer par intérêts
      if (options.showMyInterests && options.userId) {
        exchanges = exchanges.filter(e => 
          e.interestedUsers?.includes(options.userId!)
        );
      }

      // Filtrer par statut
      if (options.status && options.status.length > 0) {
        exchanges = exchanges.filter(e => options.status!.includes(e.status));
      }

      // Filtrer par période
      if (options.period) {
        exchanges = exchanges.filter(e => e.period === options.period);
      }

      // Filtrer par plage de dates
      if (options.dateRange) {
        exchanges = exchanges.filter(e => {
          const exchangeDate = toParisTime(e.date);
          return isWithinInterval(exchangeDate, {
            start: options.dateRange!.start,
            end: options.dateRange!.end
          });
        });
      }

      return exchanges;
    } catch (error) {
      console.error('Erreur lors de la recherche des échanges:', error);
      return [];
    }
  }

  /**
   * Récupérer mes soumissions
   */
  async getMySubmissions(userId: string, associationId: string): Promise<ShiftExchangeDocument[]> {
    return this.searchShiftExchanges({ 
      userId, 
      showOwnShifts: true 
    }, associationId);
  }

  /**
   * Récupérer les gardes où j'ai marqué mon intérêt
   */
  async getMyInterests(userId: string, associationId: string): Promise<ShiftExchangeDocument[]> {
    return this.searchShiftExchanges({ 
      userId, 
      showMyInterests: true 
    }, associationId);
  }

  /**
   * Récupérer la phase actuelle de la bourse
   */
  async getCurrentPhase(associationId: string): Promise<BagPhase> {
    try {
      const config = await this.getPhaseConfig(associationId);
      if (!config || !config.isConfigured) {
        return BagPhase.SUBMISSION; // Par défaut en mode soumission pour permettre les interactions
      }

      const now = createParisDate();
      const deadline = toParisTime(config.submissionDeadline);

      // Mapper les phases de configuration vers les phases enum
      switch (config.phase) {
        case 'submission':
          return isBefore(now, deadline) ? BagPhase.SUBMISSION : BagPhase.MATCHING;
        case 'distribution':
          return BagPhase.MATCHING;
        case 'completed':
          return BagPhase.COMPLETED;
        default:
          return BagPhase.SUBMISSION; // Par défaut en mode soumission
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la phase:', error);
      return BagPhase.SUBMISSION; // Par défaut en mode soumission pour permettre les interactions
    }
  }

  /**
   * Récupérer la configuration de la phase
   */
  async getPhaseConfig(associationId: string): Promise<BagPhaseConfig | null> {
    try {
      // Récupérer la configuration de la bourse aux gardes depuis Firebase
      const configDoc = await getDoc(doc(db, 'config', 'bag_phase_config'));
      
      if (!configDoc.exists()) {
        console.log('Aucune configuration de bourse aux gardes trouvée');
        return null;
      }

      const data = configDoc.data();
      
      // Retourner la configuration réelle
      return {
        phase: data.phase || 'submission',
        submissionDeadline: data.submissionDeadline ? firebaseTimestampToParisDate(data.submissionDeadline) : createParisDate(),
        isConfigured: data.isConfigured || false,
        isValidated: data.isValidated || false,
        validatedAt: data.validatedAt ? firebaseTimestampToParisDate(data.validatedAt) : undefined,
        nextPlanningStartDate: data.nextPlanningStartDate ? firebaseTimestampToParisDate(data.nextPlanningStartDate) : undefined
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration:', error);
      return null;
    }
  }

  /**
   * Vérifier si les soumissions sont ouvertes
   */
  async canSubmitExchange(associationId: string): Promise<boolean> {
    const phase = await this.getCurrentPhase(associationId);
    return phase === BagPhase.SUBMISSION;
  }

  /**
   * Marquer son intérêt pour une garde
   */
  async addInterestedUser(
    exchangeId: string,
    userId: string,
    associationId: string
  ): Promise<void> {
    try {
      const exchange = await this.getById(exchangeId);
      if (!exchange) {
        throw new Error('Échange introuvable');
      }

      // Vérifier que l'utilisateur n'est pas le propriétaire
      if (exchange.userId === userId) {
        throw new Error('Vous ne pouvez pas marquer votre intérêt pour votre propre garde');
      }

      // Vérifier que l'utilisateur n'a pas déjà une garde à ce moment
      const hasShift = await this.userHasShiftAt(
        userId,
        exchange.date,
        exchange.period,
        associationId
      );

      if (hasShift) {
        throw new Error('Vous avez déjà une garde à ce moment-là');
      }

      // Ajouter l'utilisateur aux intéressés
      await updateDoc(doc(db, this.getCollectionPath(), exchangeId), {
        interestedUsers: arrayUnion(userId),
        lastModified: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'intérêt:', error);
      throw error;
    }
  }

  /**
   * Retirer son intérêt pour une garde
   */
  async removeInterestedUser(
    exchangeId: string,
    userId: string,
    associationId: string
  ): Promise<void> {
    try {
      await updateDoc(doc(db, this.getCollectionPath(), exchangeId), {
        interestedUsers: arrayRemove(userId),
        lastModified: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors du retrait de l\'intérêt:', error);
      throw error;
    }
  }

  /**
   * Récupérer les appariements proposés
   */
  async getMatchedExchanges(userId: string, associationId: string): Promise<ShiftExchangeDocument[]> {
    try {
      const phase = await this.getCurrentPhase(associationId);
      if (phase !== BagPhase.VALIDATION) {
        return [];
      }

      const exchanges = await this.getAll({
        where: [
          { field: 'status', operator: '==', value: 'matched' },
          { field: 'matchedUserId', operator: '==', value: userId }
        ]
      });

      return exchanges;
    } catch (error) {
      console.error('Erreur lors de la récupération des appariements:', error);
      return [];
    }
  }

  /**
   * Valider un appariement
   */
  async validateMatch(
    exchangeId: string,
    matchedUserId: string,
    associationId: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const exchange = await this.getById(exchangeId);
        if (!exchange) {
          throw new Error('Échange introuvable');
        }

        if (exchange.status !== 'matched') {
          throw new Error('Cet échange n\'est pas en attente de validation');
        }

        // Mettre à jour le planning
        // TODO: Implémenter la mise à jour du planning via PlanningRepository

        // Créer l'entrée d'historique
        const historyCollection = getCollectionName('exchange_history', associationId);
        const historyRef = doc(collection(db, historyCollection));
        const historyData = this.createHistoryEntry(
          exchange.userId,
          matchedUserId,
          exchange.date,
          exchange.period,
          exchange.shiftType,
          exchange.timeSlot,
          {
            isPermutation: false,
            originalShiftType: exchange.shiftType,
            newShiftType: null,
            originalExchangeId: exchangeId
          }
        );

        transaction.set(historyRef, historyData);

        // Mettre à jour l'échange
        const exchangeRef = doc(db, this.getCollectionPath(), exchangeId);
        transaction.update(exchangeRef, {
          status: 'validated',
          lastModified: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Erreur lors de la validation de l\'appariement:', error);
      throw error;
    }
  }

  /**
   * Rejeter un appariement
   */
  async rejectMatch(exchangeId: string, associationId: string): Promise<void> {
    try {
      await this.update(exchangeId, {
        status: 'rejected',
        matchedUserId: null,
        matchedDate: null,
        matchedPeriod: null,
        matchedShiftType: null,
        matchedTimeSlot: null
      } as any);
    } catch (error) {
      console.error('Erreur lors du rejet de l\'appariement:', error);
      throw error;
    }
  }

  /**
   * Annuler un échange
   */
  async cancelShiftExchange(exchangeId: string, associationId: string): Promise<void> {
    try {
      const phase = await this.getCurrentPhase(associationId);
      if (phase !== BagPhase.SUBMISSION) {
        throw new Error('Les annulations ne sont possibles que pendant la phase de soumission');
      }

      await this.update(exchangeId, {
        status: 'cancelled'
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation de l\'échange:', error);
      throw error;
    }
  }

  /**
   * Récupérer l'historique des échanges validés
   */
  async getExchangeHistory(
    userId?: string,
    limit: number = 50,
    associationId: string = this.associationId
  ): Promise<any[]> {
    try {
      const historyCollection = getCollectionName('exchange_history', associationId);
      let q = query(
        collection(db, historyCollection),
        orderBy('exchangedAt', 'desc')
      );

      if (userId) {
        q = query(
          collection(db, historyCollection),
          where('originalUserId', '==', userId),
          orderBy('exchangedAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs
        .slice(0, limit)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  /**
   * S'abonner aux changements de phase
   */
  subscribeToPhaseChanges(
    associationId: string,
    callback: (phase: BagPhase, config: BagPhaseConfig | null) => void
  ): () => void {
    const planningCollection = getCollectionName('planning', associationId);
    const configRef = doc(db, planningCollection, 'planningConfig');

    return onSnapshot(configRef, async (doc) => {
      const config = await this.getPhaseConfig(associationId);
      const phase = await this.getCurrentPhase(associationId);
      callback(phase, config);
    });
  }

  /**
   * S'abonner aux changements des échanges
   */
  subscribeToShiftExchanges(
    userId: string,
    associationId: string,
    callback: (exchanges: ShiftExchangeDocument[]) => void
  ): () => void {
    const q = query(
      collection(db, this.getCollectionPath()),
      where('status', 'in', ['pending', 'matched']),
      orderBy('date', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const exchanges = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ShiftExchangeDocument));
      
      callback(exchanges);
    });
  }

  /**
   * Vérifier si un utilisateur a une garde à une date/période donnée
   */
  async userHasShiftAt(
    userId: string,
    date: string,
    period: ShiftPeriod,
    associationId: string
  ): Promise<boolean> {
    try {
      // Utiliser PlanningRepository pour récupérer les assignations de la date
      const assignmentsByUser = await getPlanningRepository().getAssignmentsByDate(date, associationId);
      
      // Vérifier si l'utilisateur a une assignation pour cette date et période
      const userAssignments = assignmentsByUser[userId];
      if (!userAssignments) {
        return false; // Aucune assignation pour cet utilisateur à cette date
      }
      
      // Construire la clé d'assignation au format "YYYY-MM-DD-PERIOD"
      const assignmentKey = `${date}-${period}`;
      
      // Vérifier si l'assignation existe
      const hasAssignment = !!userAssignments[assignmentKey];
      
      console.log(`Vérification garde pour ${userId} le ${date} période ${period}:`, {
        assignmentKey,
        hasAssignment,
        userAssignments: Object.keys(userAssignments)
      });
      
      return hasAssignment;
    } catch (error) {
      console.error('Erreur lors de la vérification de la garde:', error);
      // En cas d'erreur, retourner false pour permettre les interactions
      return false;
    }
  }

  /**
   * Récupérer les statistiques de la bourse
   */
  async getBagStatistics(associationId: string): Promise<{
    totalExchanges: number;
    pendingExchanges: number;
    matchedExchanges: number;
    validatedExchanges: number;
    rejectedExchanges: number;
  }> {
    try {
      const allExchanges = await this.getAll();
      
      return {
        totalExchanges: allExchanges.length,
        pendingExchanges: allExchanges.filter(e => e.status === 'pending').length,
        matchedExchanges: allExchanges.filter(e => e.status === 'matched').length,
        validatedExchanges: allExchanges.filter(e => e.status === 'validated').length,
        rejectedExchanges: allExchanges.filter(e => e.status === 'rejected').length
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return {
        totalExchanges: 0,
        pendingExchanges: 0,
        matchedExchanges: 0,
        validatedExchanges: 0,
        rejectedExchanges: 0
      };
    }
  }
}