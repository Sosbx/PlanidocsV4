import { 
  collection, 
  doc, 
  getDoc, 
  deleteDoc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config';
import { createParisDate } from '@/utils/timezoneUtils';
import { COLLECTIONS, ExchangeHistory } from './types';

/**
 * Types d'opérations sur l'historique
 */
export type HistoryOperationType = 
  | 'exchange_completed'
  | 'exchange_rejected'
  | 'interest_removed'
  | 'exchange_reverted';

/**
 * Données pour créer une entrée d'historique
 */
export interface CreateHistoryData {
  type: HistoryOperationType;
  exchange: {
    id: string;
    userId: string;
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
    comment?: string;
    interestedUsers?: string[];
  };
  interestedUserId?: string;
  newShiftType?: string | null;
  isPermutation?: boolean;
  removedUserId?: string;
  actionBy: string;
  originalUserPeriodId?: string;
  interestedUserPeriodId?: string;
}

/**
 * Gestionnaire centralisé de l'historique des échanges
 * Simplifie et unifie toutes les opérations sur l'historique
 */
export class HistoryManager {
  private static instance: HistoryManager;
  private historyListener: Unsubscribe | null = null;
  private historyData: ExchangeHistory[] = [];
  private subscribers: Set<(history: ExchangeHistory[]) => void> = new Set();

  private constructor() {}

  /**
   * Obtient l'instance singleton du gestionnaire
   */
  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  /**
   * Initialise le listener d'historique
   */
  startListening(): void {
    if (this.historyListener) return;

    const historyQuery = query(
      collection(db, COLLECTIONS.HISTORY),
      orderBy('exchangedAt', 'desc')
    );

    this.historyListener = onSnapshot(
      historyQuery,
      (snapshot) => {
        this.historyData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ExchangeHistory));
        
        // Notifier tous les subscribers
        this.subscribers.forEach(callback => callback(this.historyData));
      },
      (error) => {
        console.error('Error listening to history:', error);
      }
    );
  }

  /**
   * Arrête le listener d'historique
   */
  stopListening(): void {
    if (this.historyListener) {
      this.historyListener();
      this.historyListener = null;
    }
  }

  /**
   * S'abonner aux changements d'historique
   */
  subscribe(callback: (history: ExchangeHistory[]) => void): () => void {
    this.subscribers.add(callback);
    
    // Envoyer les données actuelles immédiatement
    if (this.historyData.length > 0) {
      callback(this.historyData);
    }
    
    // Retourner une fonction de désabonnement
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Obtient l'historique actuel
   */
  getHistory(): ExchangeHistory[] {
    return [...this.historyData];
  }

  /**
   * Obtient l'historique filtré par statut
   */
  getHistoryByStatus(status: ExchangeHistory['status']): ExchangeHistory[] {
    return this.historyData.filter(h => h.status === status);
  }

  /**
   * Obtient l'historique pour un utilisateur
   */
  getHistoryForUser(userId: string): ExchangeHistory[] {
    return this.historyData.filter(h => 
      h.originalUserId === userId || 
      h.newUserId === userId ||
      h.removedUserId === userId
    );
  }

  /**
   * Crée une entrée d'historique
   */
  async createHistory(data: CreateHistoryData): Promise<string> {
    const now = createParisDate();
    const historyRef = doc(collection(db, COLLECTIONS.HISTORY));
    
    let historyData: Partial<ExchangeHistory> = {
      date: data.exchange.date,
      period: data.exchange.period,
      shiftType: data.exchange.shiftType,
      timeSlot: data.exchange.timeSlot,
      originalUserId: data.exchange.userId,
      originalShiftType: data.exchange.shiftType,
      createdAt: now.toISOString(),
      exchangedAt: now.toISOString(),
      comment: data.exchange.comment || '',
      interestedUsers: data.exchange.interestedUsers || [],
      originalExchangeId: data.exchange.id,
      originalUserPeriodId: data.originalUserPeriodId,
      interestedUserPeriodId: data.interestedUserPeriodId
    };

    switch (data.type) {
      case 'exchange_completed':
        historyData = {
          ...historyData,
          status: 'completed',
          newUserId: data.interestedUserId!,
          newShiftType: data.newShiftType,
          isPermutation: data.isPermutation || false,
          validatedBy: data.actionBy
        };
        break;

      case 'exchange_rejected':
        historyData = {
          ...historyData,
          status: 'rejected',
          newUserId: '',
          rejectedBy: data.actionBy,
          rejectedAt: now.toISOString()
        };
        break;

      case 'interest_removed':
        historyData = {
          ...historyData,
          status: 'interest_removed',
          newUserId: data.removedUserId!,
          removedBy: data.actionBy,
          removedUserId: data.removedUserId
        };
        break;

      default:
        throw new Error(`Type d'historique non supporté: ${data.type}`);
    }

    await setDoc(historyRef, historyData);
    return historyRef.id;
  }

  /**
   * Supprime une entrée d'historique
   */
  async deleteHistory(historyId: string): Promise<void> {
    const historyRef = doc(db, COLLECTIONS.HISTORY, historyId);
    await deleteDoc(historyRef);
  }

  /**
   * Obtient une entrée d'historique par ID
   */
  async getHistoryById(historyId: string): Promise<ExchangeHistory | null> {
    const historyRef = doc(db, COLLECTIONS.HISTORY, historyId);
    const historyDoc = await getDoc(historyRef);
    
    if (!historyDoc.exists()) {
      return null;
    }
    
    return {
      id: historyDoc.id,
      ...historyDoc.data()
    } as ExchangeHistory;
  }

  /**
   * Trouve l'historique d'un échange spécifique
   */
  findHistoryForExchange(exchangeId: string): ExchangeHistory | undefined {
    return this.historyData.find(h => h.originalExchangeId === exchangeId);
  }

  /**
   * Trouve l'historique pour un créneau spécifique
   */
  findHistoryForSlot(date: string, period: string, userId?: string): ExchangeHistory[] {
    return this.historyData.filter(h => 
      h.date === date && 
      h.period === period &&
      (!userId || h.originalUserId === userId || h.newUserId === userId)
    );
  }

  /**
   * Statistiques rapides sur l'historique
   */
  getStats(): {
    total: number;
    completed: number;
    rejected: number;
    interestRemoved: number;
  } {
    return {
      total: this.historyData.length,
      completed: this.historyData.filter(h => h.status === 'completed').length,
      rejected: this.historyData.filter(h => h.status === 'rejected').length,
      interestRemoved: this.historyData.filter(h => h.status === 'interest_removed').length
    };
  }

  /**
   * Vérifie si un utilisateur a déjà une garde sur un créneau
   */
  userHasShiftOnSlot(userId: string, date: string, period: string): boolean {
    return this.historyData.some(h => 
      h.status === 'completed' &&
      h.date === date &&
      h.period === period &&
      h.newUserId === userId
    );
  }

  /**
   * Nettoie les entrées d'historique anciennes (plus de 6 mois)
   */
  async cleanOldHistory(): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const oldEntries = this.historyData.filter(h => 
      new Date(h.exchangedAt) < sixMonthsAgo
    );
    
    let deletedCount = 0;
    for (const entry of oldEntries) {
      try {
        await this.deleteHistory(entry.id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting old history entry ${entry.id}:`, error);
      }
    }
    
    return deletedCount;
  }
}

// Export de l'instance singleton
export const historyManager = HistoryManager.getInstance();