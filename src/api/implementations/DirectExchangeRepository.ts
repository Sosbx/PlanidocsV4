/**
 * Implémentation du repository des échanges directs avec Firebase
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
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { OperationType } from '@/types/exchange';
import { DirectExchangeProposal, ProposalStatus } from '@/features/directExchange/types';
import { 
  IDirectExchangeRepository, 
  DirectExchangeDocument, 
  DirectExchangeSearchOptions 
} from '../interfaces/IDirectExchangeRepository';
import { ExchangeBaseRepository } from './ExchangeBaseRepository';
import { getCollectionName } from '@/utils/collectionUtils';
import { isWithinInterval } from 'date-fns';
import { getUserRepository } from '../repositories';

/**
 * Repository pour la gestion des échanges directs
 */
export class DirectExchangeRepository 
  extends ExchangeBaseRepository<DirectExchangeDocument> 
  implements IDirectExchangeRepository {

  constructor(associationId: string = 'RD') {
    super('direct_exchanges', associationId);
  }

  /**
   * Créer un nouvel échange direct
   */
  async createExchange(
    exchangeData: Omit<DirectExchangeDocument, 'id' | 'createdAt' | 'lastModified' | 'exchangeType'>,
    associationId: string
  ): Promise<DirectExchangeDocument> {
    try {
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
        'direct_exchanges'
      );

      if (hasConflict) {
        throw new Error(`Cette garde est déjà proposée dans ${conflictType}`);
      }

      // Créer l'échange
      const exchange = await this.create({
        ...normalizedData,
        exchangeType: 'direct',
        status: 'pending',
        hasProposals: false
      } as any);

      return exchange;
    } catch (error) {
      console.error('Erreur lors de la création de l\'échange direct:', error);
      throw error;
    }
  }

  /**
   * Récupérer les échanges actifs
   */
  async getActiveExchanges(_associationId: string): Promise<DirectExchangeDocument[]> {
    try {
      const exchanges = await this.getAll({
        where: [
          { field: 'status', operator: '==', value: 'pending' }
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
  async searchExchanges(
    options: DirectExchangeSearchOptions,
    associationId: string
  ): Promise<DirectExchangeDocument[]> {
    try {
      let exchanges = await this.getActiveExchanges(associationId);

      // Filtrer par utilisateur
      if (options.userId) {
        exchanges = exchanges.filter(e => e.userId === options.userId);
      }

      // Exclure un utilisateur
      if (options.excludeUserId) {
        exchanges = exchanges.filter(e => e.userId !== options.excludeUserId);
      }

      // Filtrer par statut
      if (options.status && options.status.length > 0) {
        exchanges = exchanges.filter(e => options.status!.includes(e.status));
      }

      // Filtrer par type d'opération
      if (options.operationTypes && options.operationTypes.length > 0) {
        exchanges = exchanges.filter(e => 
          e.operationTypes.some(type => options.operationTypes!.includes(type))
        );
      }

      // Filtrer par période
      if (options.period) {
        exchanges = exchanges.filter(e => e.period === options.period);
      }

      // Filtrer par plage de dates
      if (options.dateRange) {
        exchanges = exchanges.filter(e => {
          const exchangeDate = new Date(e.date);
          return isWithinInterval(exchangeDate, {
            start: options.dateRange!.start,
            end: options.dateRange!.end
          });
        });
      }

      // Filtrer les remplacements
      if (!options.includeReplacements) {
        exchanges = exchanges.filter(e => !e.operationTypes.includes('replacement' as OperationType));
      }

      return exchanges;
    } catch (error) {
      console.error('Erreur lors de la recherche des échanges:', error);
      return [];
    }
  }

  /**
   * Récupérer les échanges d'un utilisateur
   */
  async getExchangesByUser(userId: string, associationId: string): Promise<DirectExchangeDocument[]> {
    return this.searchExchanges({ userId }, associationId);
  }

  /**
   * Récupérer les demandes de remplacement
   */
  async getReplacementRequests(associationId: string): Promise<DirectExchangeDocument[]> {
    return this.searchExchanges({
      operationTypes: ['replacement' as OperationType],
      includeReplacements: true
    }, associationId);
  }

  /**
   * Créer une proposition d'échange
   */
  async createProposal(
    proposal: Omit<DirectExchangeProposal, 'id' | 'createdAt' | 'lastModified'>,
    associationId: string
  ): Promise<DirectExchangeProposal> {
    try {
      const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
      const docRef = doc(collection(db, proposalsCollection));
      
      const proposalData = {
        ...proposal,
        status: 'pending' as ProposalStatus,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };

      await setDoc(docRef, proposalData);

      // Mettre à jour l'échange pour indiquer qu'il a des propositions
      await this.update(proposal.targetExchangeId, { hasProposals: true });

      return {
        id: docRef.id,
        ...proposalData,
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now()
      };
    } catch (error) {
      console.error('Erreur lors de la création de la proposition:', error);
      throw error;
    }
  }

  /**
   * Récupérer les propositions pour un échange
   */
  async getProposalsForExchange(
    exchangeId: string, 
    associationId: string
  ): Promise<DirectExchangeProposal[]> {
    try {
      const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
      const q = query(
        collection(db, proposalsCollection),
        where('targetExchangeId', '==', exchangeId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DirectExchangeProposal));
    } catch (error) {
      console.error('Erreur lors de la récupération des propositions:', error);
      return [];
    }
  }

  /**
   * Récupérer les propositions d'un utilisateur
   */
  async getProposalsByUser(
    userId: string, 
    associationId: string
  ): Promise<DirectExchangeProposal[]> {
    try {
      const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
      const q = query(
        collection(db, proposalsCollection),
        where('proposingUserId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DirectExchangeProposal));
    } catch (error) {
      console.error('Erreur lors de la récupération des propositions utilisateur:', error);
      return [];
    }
  }

  /**
   * Accepter une proposition (transaction atomique)
   */
  async acceptProposal(
    proposalId: string,
    exchangeId: string,
    associationId: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Récupérer la proposition
        const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
        const proposalRef = doc(db, proposalsCollection, proposalId);
        const proposalDoc = await transaction.get(proposalRef);
        
        if (!proposalDoc.exists()) {
          throw new Error('Proposition introuvable');
        }

        const proposal = proposalDoc.data() as DirectExchangeProposal;

        // Récupérer l'échange
        const exchange = await this.getById(exchangeId);
        if (!exchange) {
          throw new Error('Échange introuvable');
        }

        // Vérifier que l'échange est toujours disponible
        if (exchange.status !== 'pending') {
          throw new Error('Cet échange n\'est plus disponible');
        }

        // Mettre à jour le planning si nécessaire
        // TODO: Implémenter la mise à jour du planning via PlanningRepository

        // Créer l'entrée d'historique
        const historyCollection = getCollectionName('direct_exchange_history', associationId);
        const historyRef = doc(collection(db, historyCollection));
        const historyData = this.createHistoryEntry(
          exchange.userId,
          proposal.proposingUserId,
          exchange.date,
          exchange.period,
          exchange.shiftType,
          exchange.timeSlot,
          {
            operationTypes: exchange.operationTypes,
            proposalId: proposalId,
            exchangeId: exchangeId
          }
        );

        transaction.set(historyRef, historyData);

        // Mettre à jour la proposition
        transaction.update(proposalRef, {
          status: 'accepted',
          lastModified: serverTimestamp()
        });

        // Rejeter toutes les autres propositions
        const otherProposalsQuery = query(
          collection(db, proposalsCollection),
          where('targetExchangeId', '==', exchangeId),
          where('status', '==', 'pending')
        );
        const otherProposals = await getDocs(otherProposalsQuery);
        
        otherProposals.docs.forEach(doc => {
          if (doc.id !== proposalId) {
            transaction.update(doc.ref, {
              status: 'rejected',
              lastModified: serverTimestamp()
            });
          }
        });

        // Mettre à jour l'échange
        const exchangeRef = doc(db, this.getCollectionPath(), exchangeId);
        transaction.update(exchangeRef, {
          status: 'validated',
          acceptedBy: proposal.proposingUserId,
          acceptedAt: serverTimestamp(),
          lastModified: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de la proposition:', error);
      throw error;
    }
  }

  /**
   * Rejeter une proposition
   */
  async rejectProposal(proposalId: string, associationId: string): Promise<void> {
    try {
      const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
      const proposalRef = doc(db, proposalsCollection, proposalId);
      
      await updateDoc(proposalRef, {
        status: 'rejected',
        lastModified: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors du rejet de la proposition:', error);
      throw error;
    }
  }

  /**
   * Annuler un échange
   */
  async cancelExchange(exchangeId: string, _associationId: string): Promise<void> {
    try {
      await this.update(exchangeId, {
        status: 'cancelled'
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation de l\'échange:', error);
      throw error;
    }
  }

  /**
   * Récupérer l'historique des échanges
   */
  async getExchangeHistory(
    userId?: string,
    limit: number = 50,
    associationId: string = this.associationId
  ): Promise<any[]> {
    try {
      const historyCollection = getCollectionName('direct_exchange_history', associationId);
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
   * S'abonner aux changements des échanges
   */
  subscribeToExchanges(
    _userId: string,
    _associationId: string,
    callback: (exchanges: DirectExchangeDocument[]) => void
  ): () => void {
    const q = query(
      collection(db, this.getCollectionPath()),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const exchanges = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DirectExchangeDocument));
      
      callback(exchanges);
    });
  }

  /**
   * S'abonner aux propositions pour un utilisateur
   */
  subscribeToProposals(
    userId: string,
    associationId: string,
    callback: (proposals: DirectExchangeProposal[]) => void
  ): () => void {
    // S'abonner aux propositions faites par l'utilisateur
    const proposalsCollection = getCollectionName('direct_exchange_proposals', associationId);
    const q = query(
      collection(db, proposalsCollection),
      where('proposingUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const proposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DirectExchangeProposal));
      
      callback(proposals);
    });
  }

  /**
   * Vérifier si un utilisateur peut voir les remplacements
   */
  async canViewReplacements(userId: string, associationId: string): Promise<boolean> {
    try {
      const userRepository = getUserRepository(associationId);
      const user = await userRepository.getById(userId);
      
      return user?.roles?.isReplacement || false;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut remplaçant:', error);
      return false;
    }
  }
}