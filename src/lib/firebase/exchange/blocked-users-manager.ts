import { 
  collection, 
  query, 
  where, 
  getDocs,
  runTransaction,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from './types';
import { historyManager } from './history-manager';

/**
 * Raison du blocage d'un utilisateur
 */
export interface BlockedUserReason {
  reason: 'already_has_shift' | 'invalid_permutation' | 'dependency_broken';
  shiftType: string;
  exchangeWithUserId: string;
  exchangeWithUserName: string;
  sourceExchangeId?: string;
  dependsOn?: string[];
  blockedAt?: any;
}

/**
 * Cache des utilisateurs et leurs noms
 */
interface UserCache {
  [userId: string]: {
    name: string;
    timestamp: number;
  };
}

/**
 * Cache des blocages par créneau
 */
interface SlotBlockCache {
  [slotKey: string]: {
    blockedUsers: Map<string, BlockedUserReason>;
    timestamp: number;
  };
}

/**
 * Gestionnaire centralisé des utilisateurs bloqués
 * Optimise les vérifications et maintient un cache cohérent
 */
export class BlockedUsersManager {
  private static instance: BlockedUsersManager;
  private userCache: UserCache = {};
  private slotBlockCache: SlotBlockCache = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly USER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): BlockedUsersManager {
    if (!BlockedUsersManager.instance) {
      BlockedUsersManager.instance = new BlockedUsersManager();
    }
    return BlockedUsersManager.instance;
  }

  /**
   * Obtient le nom d'affichage d'un utilisateur avec cache
   */
  private async getUserDisplayName(userId: string): Promise<string> {
    // Vérifier le cache
    const cached = this.userCache[userId];
    if (cached && Date.now() - cached.timestamp < this.USER_CACHE_DURATION) {
      return cached.name;
    }

    try {
      const userQuery = query(
        collection(db, 'users'),
        where('__name__', '==', userId)
      );
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        const name = `${userData.firstName} ${userData.lastName}`;
        
        // Mettre en cache
        this.userCache[userId] = {
          name,
          timestamp: Date.now()
        };
        
        return name;
      }
      
      return userId;
    } catch (error) {
      console.error('Erreur lors de la récupération du nom utilisateur:', error);
      return userId;
    }
  }

  /**
   * Obtient les utilisateurs bloqués pour un créneau avec cache
   */
  async getBlockedUsersForSlot(
    date: string, 
    period: string
  ): Promise<Map<string, BlockedUserReason>> {
    const slotKey = `${date}-${period}`;
    
    // Vérifier le cache
    const cached = this.slotBlockCache[slotKey];
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.blockedUsers;
    }

    // Calculer les blocages
    const blockedUsers = await this.calculateBlockedUsers(date, period);
    
    // Mettre en cache
    this.slotBlockCache[slotKey] = {
      blockedUsers,
      timestamp: Date.now()
    };
    
    return blockedUsers;
  }

  /**
   * Invalide le cache pour un créneau
   */
  invalidateSlotCache(date: string, period: string): void {
    const slotKey = `${date}-${period}`;
    delete this.slotBlockCache[slotKey];
  }

  /**
   * Invalide tout le cache
   */
  invalidateAllCache(): void {
    this.slotBlockCache = {};
  }

  /**
   * Calcule les utilisateurs bloqués pour un créneau
   */
  private async calculateBlockedUsers(
    date: string,
    period: string
  ): Promise<Map<string, BlockedUserReason>> {
    const blockedUsers = new Map<string, BlockedUserReason>();
    
    // Utiliser le gestionnaire d'historique pour obtenir les échanges validés
    const completedExchanges = historyManager
      .getHistory()
      .filter(h => 
        h.date === date && 
        h.period === period && 
        h.status === 'completed'
      );
    
    // Traiter chaque échange validé
    for (const exchange of completedExchanges) {
      // L'utilisateur qui a reçu la garde est bloqué
      if (exchange.newUserId) {
        const exchangeWithUserName = await this.getUserDisplayName(exchange.originalUserId);
        blockedUsers.set(exchange.newUserId, {
          reason: 'already_has_shift',
          shiftType: exchange.shiftType,
          exchangeWithUserId: exchange.originalUserId,
          exchangeWithUserName,
          sourceExchangeId: exchange.id
        });
      }
      
      // Dans le cas d'une permutation, l'utilisateur original a aussi une nouvelle garde
      if (exchange.isPermutation && exchange.originalUserId && exchange.newShiftType) {
        const exchangeWithUserName = await this.getUserDisplayName(exchange.newUserId);
        blockedUsers.set(exchange.originalUserId, {
          reason: 'already_has_shift',
          shiftType: exchange.newShiftType,
          exchangeWithUserId: exchange.newUserId,
          exchangeWithUserName,
          sourceExchangeId: exchange.id
        });
      }
    }
    
    return blockedUsers;
  }

  /**
   * Met à jour les utilisateurs bloqués pour tous les échanges d'un créneau
   * Version optimisée avec batch et transactions
   */
  async updateBlockedUsersForSlot(date: string, period: string): Promise<void> {
    try {
      console.log(`Mise à jour des utilisateurs bloqués pour ${date} - ${period}`);
      
      // Invalider le cache pour ce créneau
      this.invalidateSlotCache(date, period);
      
      // Obtenir les utilisateurs bloqués
      const blockedUsers = await this.getBlockedUsersForSlot(date, period);
      
      // Récupérer tous les échanges en attente pour ce créneau
      const pendingExchangesQuery = query(
        collection(db, COLLECTIONS.EXCHANGES),
        where('date', '==', date),
        where('period', '==', period),
        where('status', '==', 'pending')
      );
      
      const pendingExchangesSnapshot = await getDocs(pendingExchangesQuery);
      
      if (pendingExchangesSnapshot.empty) {
        console.log(`Aucun échange en attente pour ${date} - ${period}`);
        return;
      }
      
      // Mettre à jour en batch
      await runTransaction(db, async (transaction) => {
        const updates: Array<{
          ref: any;
          blockedUsers: Record<string, BlockedUserReason>;
        }> = [];
        
        // Préparer les mises à jour
        for (const exchangeDoc of pendingExchangesSnapshot.docs) {
          const exchangeData = exchangeDoc.data();
          const interestedUsers = exchangeData.interestedUsers || [];
          const newBlockedUsers: Record<string, BlockedUserReason> = {};
          
          // Vérifier chaque utilisateur intéressé
          for (const userId of interestedUsers) {
            const blockReason = blockedUsers.get(userId);
            if (blockReason) {
              newBlockedUsers[userId] = {
                ...blockReason,
                blockedAt: serverTimestamp()
              };
            }
          }
          
          updates.push({
            ref: exchangeDoc.ref,
            blockedUsers: newBlockedUsers
          });
        }
        
        // Appliquer toutes les mises à jour
        for (const update of updates) {
          transaction.update(update.ref, {
            blockedUsers: update.blockedUsers,
            lastModified: serverTimestamp()
          });
        }
      });
      
      console.log(`Mise à jour terminée pour ${date} - ${period}: ${pendingExchangesSnapshot.size} échanges mis à jour`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des utilisateurs bloqués:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur est bloqué pour un créneau donné
   */
  async isUserBlockedForSlot(
    userId: string,
    date: string,
    period: string
  ): Promise<BlockedUserReason | null> {
    const blockedUsers = await this.getBlockedUsersForSlot(date, period);
    return blockedUsers.get(userId) || null;
  }

  /**
   * Vérifie et met à jour les blocages pour plusieurs créneaux
   * Utile après des modifications en masse
   */
  async updateBlockedUsersForMultipleSlots(
    slots: Array<{ date: string; period: string }>
  ): Promise<void> {
    // Traiter par batch pour éviter trop de requêtes simultanées
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < slots.length; i += BATCH_SIZE) {
      const batch = slots.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(slot => this.updateBlockedUsersForSlot(slot.date, slot.period))
      );
    }
  }

  /**
   * Obtient des statistiques sur les blocages
   */
  async getBlockingStats(): Promise<{
    totalBlockedUsers: number;
    blocksByReason: Record<string, number>;
    mostBlockedSlots: Array<{ slot: string; count: number }>;
  }> {
    const allBlockedUsers = new Set<string>();
    const blocksByReason: Record<string, number> = {
      already_has_shift: 0,
      invalid_permutation: 0,
      dependency_broken: 0
    };
    const slotCounts: Record<string, number> = {};
    
    // Analyser tous les slots en cache
    for (const [slotKey, cacheEntry] of Object.entries(this.slotBlockCache)) {
      const count = cacheEntry.blockedUsers.size;
      slotCounts[slotKey] = count;
      
      cacheEntry.blockedUsers.forEach((reason, userId) => {
        allBlockedUsers.add(userId);
        blocksByReason[reason.reason]++;
      });
    }
    
    // Trier les slots par nombre de blocages
    const sortedSlots = Object.entries(slotCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([slot, count]) => ({ slot, count }));
    
    return {
      totalBlockedUsers: allBlockedUsers.size,
      blocksByReason,
      mostBlockedSlots: sortedSlots
    };
  }
}

// Export de l'instance singleton
export const blockedUsersManager = BlockedUsersManager.getInstance();