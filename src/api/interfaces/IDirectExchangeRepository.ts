/**
 * Interface pour le repository des échanges directs
 */

import { ShiftExchange, OperationType, ShiftPeriod } from '@/types/exchange';
import { DirectExchangeProposal } from '@/features/directExchange/types';
import { IRepository } from './IRepository';
import { FirestoreDocument } from '@/types/firebase';

/**
 * Document d'échange direct
 */
export interface DirectExchangeDocument extends FirestoreDocument {
  userId: string;
  date: string;
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  comment?: string;
  exchangeType: 'direct';
  operationTypes: OperationType[];
  interestedUsers?: string[];
  proposedToReplacements?: boolean;
  hasProposals?: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  status: import('@/types/exchange').ExchangeStatus;
}

/**
 * Options de recherche pour les échanges directs
 */
export interface DirectExchangeSearchOptions {
  userId?: string;
  status?: string[];
  operationTypes?: OperationType[];
  dateRange?: { start: Date; end: Date };
  period?: ShiftPeriod;
  excludeUserId?: string;
  includeReplacements?: boolean;
}

/**
 * Interface spécifique pour le repository des échanges directs
 */
export interface IDirectExchangeRepository extends IRepository<DirectExchangeDocument> {
  /**
   * Créer un nouvel échange direct
   */
  createExchange(
    exchangeData: Omit<DirectExchangeDocument, 'id' | 'createdAt' | 'lastModified' | 'exchangeType'>,
    associationId: string
  ): Promise<DirectExchangeDocument>;

  /**
   * Récupérer les échanges actifs
   */
  getActiveExchanges(associationId: string): Promise<DirectExchangeDocument[]>;

  /**
   * Rechercher des échanges avec filtres
   */
  searchExchanges(
    options: DirectExchangeSearchOptions,
    associationId: string
  ): Promise<DirectExchangeDocument[]>;

  /**
   * Récupérer les échanges d'un utilisateur
   */
  getExchangesByUser(userId: string, associationId: string): Promise<DirectExchangeDocument[]>;

  /**
   * Récupérer les demandes de remplacement (pour les remplaçants)
   */
  getReplacementRequests(associationId: string): Promise<DirectExchangeDocument[]>;

  /**
   * Créer une proposition d'échange
   */
  createProposal(
    proposal: Omit<DirectExchangeProposal, 'id' | 'createdAt' | 'lastModified'>,
    associationId: string
  ): Promise<DirectExchangeProposal>;

  /**
   * Récupérer les propositions pour un échange
   */
  getProposalsForExchange(exchangeId: string, associationId: string): Promise<DirectExchangeProposal[]>;

  /**
   * Récupérer les propositions d'un utilisateur
   */
  getProposalsByUser(userId: string, associationId: string): Promise<DirectExchangeProposal[]>;

  /**
   * Accepter une proposition (transaction atomique)
   */
  acceptProposal(
    proposalId: string,
    exchangeId: string,
    associationId: string
  ): Promise<void>;

  /**
   * Rejeter une proposition
   */
  rejectProposal(proposalId: string, associationId: string): Promise<void>;

  /**
   * Annuler un échange
   */
  cancelExchange(exchangeId: string, associationId: string): Promise<void>;

  /**
   * Récupérer l'historique des échanges
   */
  getExchangeHistory(
    userId?: string,
    limit?: number,
    associationId?: string
  ): Promise<any[]>;

  /**
   * S'abonner aux changements des échanges
   */
  subscribeToExchanges(
    userId: string,
    associationId: string,
    callback: (exchanges: DirectExchangeDocument[]) => void
  ): () => void;

  /**
   * S'abonner aux propositions pour un utilisateur
   */
  subscribeToProposals(
    userId: string,
    associationId: string,
    callback: (proposals: DirectExchangeProposal[]) => void
  ): () => void;

  /**
   * Vérifier si un utilisateur peut voir les remplacements
   */
  canViewReplacements(userId: string, associationId: string): Promise<boolean>;
}