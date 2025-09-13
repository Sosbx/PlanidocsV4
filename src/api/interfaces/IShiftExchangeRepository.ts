/**
 * Interface pour le repository de la bourse aux gardes
 */

import { ShiftExchange, ShiftPeriod } from '@/types/exchange';
import { BagPhase } from '@/features/shiftExchange/types';
import { IRepository } from './IRepository';
import { FirestoreDocument } from '@/types/firebase';
import { BagPhaseConfig } from '@/types/planning';

/**
 * Document d'échange dans la bourse aux gardes
 */
export interface ShiftExchangeDocument extends FirestoreDocument {
  userId: string;
  date: string;
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  comment?: string;
  exchangeType: 'bag';
  operationTypes: import('@/types/exchange').OperationType[];
  operationType?: import('@/types/exchange').OperationType;
  interestedUsers?: string[];
  proposedToReplacements?: boolean;
  hasProposals?: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  status: import('@/types/exchange').ExchangeStatus;
}

/**
 * Options de recherche pour la bourse aux gardes
 */
export interface ShiftExchangeSearchOptions {
  userId?: string;
  status?: string[];
  dateRange?: { start: Date; end: Date };
  period?: ShiftPeriod;
  excludeUserId?: string;
  showOwnShifts?: boolean;
  showMyInterests?: boolean;
}

/**
 * Interface spécifique pour le repository de la bourse aux gardes
 */
export interface IShiftExchangeRepository extends IRepository<ShiftExchangeDocument> {
  /**
   * Créer un nouvel échange dans la bourse
   */
  createShiftExchange(
    exchangeData: Omit<ShiftExchangeDocument, 'id' | 'createdAt' | 'lastModified' | 'exchangeType'>,
    associationId: string
  ): Promise<ShiftExchangeDocument>;

  /**
   * Récupérer les échanges actifs de la bourse
   */
  getActiveShiftExchanges(associationId: string): Promise<ShiftExchangeDocument[]>;

  /**
   * Rechercher des échanges avec filtres
   */
  searchShiftExchanges(
    options: ShiftExchangeSearchOptions,
    associationId: string
  ): Promise<ShiftExchangeDocument[]>;

  /**
   * Récupérer mes soumissions
   */
  getMySubmissions(userId: string, associationId: string): Promise<ShiftExchangeDocument[]>;

  /**
   * Récupérer les gardes où j'ai marqué mon intérêt
   */
  getMyInterests(userId: string, associationId: string): Promise<ShiftExchangeDocument[]>;

  /**
   * Récupérer la phase actuelle de la bourse
   */
  getCurrentPhase(associationId: string): Promise<BagPhase>;

  /**
   * Récupérer la configuration de la phase
   */
  getPhaseConfig(associationId: string): Promise<BagPhaseConfig | null>;

  /**
   * Vérifier si les soumissions sont ouvertes
   */
  canSubmitExchange(associationId: string): Promise<boolean>;

  /**
   * Marquer son intérêt pour une garde
   */
  addInterestedUser(
    exchangeId: string,
    userId: string,
    associationId: string
  ): Promise<void>;

  /**
   * Retirer son intérêt pour une garde
   */
  removeInterestedUser(
    exchangeId: string,
    userId: string,
    associationId: string
  ): Promise<void>;

  /**
   * Récupérer les appariements proposés
   */
  getMatchedExchanges(userId: string, associationId: string): Promise<ShiftExchangeDocument[]>;

  /**
   * Valider un appariement
   */
  validateMatch(
    exchangeId: string,
    matchedUserId: string,
    associationId: string
  ): Promise<void>;

  /**
   * Rejeter un appariement
   */
  rejectMatch(exchangeId: string, associationId: string): Promise<void>;

  /**
   * Annuler un échange
   */
  cancelShiftExchange(exchangeId: string, associationId: string): Promise<void>;

  /**
   * Récupérer l'historique des échanges validés
   */
  getExchangeHistory(
    userId?: string,
    limit?: number,
    associationId?: string
  ): Promise<any[]>;

  /**
   * S'abonner aux changements de phase
   */
  subscribeToPhaseChanges(
    associationId: string,
    callback: (phase: BagPhase, config: BagPhaseConfig | null) => void
  ): () => void;

  /**
   * S'abonner aux changements des échanges
   */
  subscribeToShiftExchanges(
    userId: string,
    associationId: string,
    callback: (exchanges: ShiftExchangeDocument[]) => void
  ): () => void;

  /**
   * Vérifier si un utilisateur a une garde à une date/période donnée
   */
  userHasShiftAt(
    userId: string,
    date: string,
    period: ShiftPeriod,
    associationId: string
  ): Promise<boolean>;

  /**
   * Récupérer les statistiques de la bourse
   */
  getBagStatistics(associationId: string): Promise<{
    totalExchanges: number;
    pendingExchanges: number;
    matchedExchanges: number;
    validatedExchanges: number;
    rejectedExchanges: number;
  }>;
}