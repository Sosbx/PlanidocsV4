import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  Timestamp 
} from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { COLLECTIONS } from './types';
import { auth } from '../config';
import { User } from '../../../features/users/types';
import { lockExchangeForOperation, unlockExchange } from '../atomicOperations';
import { getUserByEmail } from '../users';
import { notifyExchangeSystem } from '../planningEventService';
import { v4 as uuidv4 } from 'uuid';
import { replacementNotificationService } from '../replacementNotificationService';

/**
 * Interface pour les options de proposition de remplacement
 */
export interface ProposeReplacementOptions {
  exchangeId?: string;       // ID de l'échange (optionnel si on fournit date/période)
  targetUserId?: string;     // ID de l'utilisateur à qui l'on propose le remplacement
  date?: string;             // Date au format YYYY-MM-DD
  period?: string;           // Période (M, AM, S)
  shiftType?: string;        // Type de garde
  timeSlot?: string;         // Créneau horaire
  comment?: string;          // Commentaire
  isGroupProposal?: boolean; // Indique si la proposition est envoyée à plusieurs remplaçants
}

/**
 * Interface pour les options de réponse à une proposition de remplacement
 */
export interface RespondToReplacementOptions {
  proposalId: string;           // ID de la proposition de remplacement
  response: 'accept' | 'reject'; // Réponse (accepter/rejeter)
  comment?: string;             // Commentaire optionnel
}

/**
 * Service de gestion des transactions de remplacement
 * Gère les propositions et acceptations de remplacements avec atomicité
 */
export class ReplacementTransactionService {
  
  // Obtient l'utilisateur actuel depuis Firebase Auth
  private async getCurrentUser(): Promise<User> {
    const authUser = auth.currentUser;
    if (!authUser || !authUser.email) {
      throw new Error('Utilisateur non authentifié');
    }
    
    const userData = await getUserByEmail(authUser.email);
    if (!userData) {
      throw new Error('Données utilisateur introuvables');
    }
    
    return userData;
  }
  
  /**
   * Propose un remplacement pour une garde
   * 
   * @param options Options de proposition
   * @returns Résultat de l'opération avec l'ID de la proposition créée
   */
  async proposeReplacement(options: ProposeReplacementOptions): Promise<{ success: boolean; proposalId?: string; error?: string }> {
    try {
      const user = await this.getCurrentUser();
      
      // Exécuter la transaction
      return await runTransaction(db, async (transaction) => {
        let exchangeId = options.exchangeId;
        let exchangeData: any;
        
        // Si l'ID d'échange n'est pas fourni, chercher ou créer l'échange
        if (!exchangeId && options.date && options.period) {
          // Vérifier si l'échange existe déjà pour cette date/période/utilisateur
          const directExchangesRef = collection(db, COLLECTIONS.DIRECT_EXCHANGES);
          const exchangeQuery = query(
            directExchangesRef,
            where('date', '==', options.date),
            where('period', '==', options.period),
            where('userId', '==', user.id)
          );
          
          const exchangeSnapshot = await transaction.get(exchangeQuery);
          
          if (!exchangeSnapshot.empty) {
            // Utiliser l'échange existant
            exchangeId = exchangeSnapshot.docs[0].id;
            exchangeData = exchangeSnapshot.docs[0].data();
          } else {
            // Créer un nouvel échange
            const newExchangeRef = doc(collection(db, COLLECTIONS.DIRECT_EXCHANGES));
            exchangeId = newExchangeRef.id;
            
            // Données de base de l'échange
            exchangeData = {
              userId: user.id,
              date: options.date,
              period: options.period,
              shiftType: options.shiftType || 'Standard',
              timeSlot: options.timeSlot || '00:00-00:00',
              operationTypes: ['replacement'], // Spécifier le type d'opération comme remplacement
              status: 'pending',
              createdAt: serverTimestamp(),
              lastModified: serverTimestamp(),
              exchangeType: 'direct'
            };
            
            // Créer l'échange dans la transaction
            transaction.set(newExchangeRef, exchangeData);
          }
        } else if (exchangeId) {
          // Récupérer les données de l'échange existant
          const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, exchangeId);
          const exchangeDoc = await transaction.get(exchangeRef);
          
          if (!exchangeDoc.exists()) {
            return { success: false, error: "L'échange spécifié n'existe pas" };
          }
          
          exchangeData = exchangeDoc.data();
          
          // Vérifier que l'utilisateur est propriétaire de l'échange
          if (exchangeData.userId !== user.id) {
            return { success: false, error: "Vous n'êtes pas autorisé à modifier cet échange" };
          }
          
          // Mettre à jour les operationTypes si nécessaire
          if (!exchangeData.operationTypes || !exchangeData.operationTypes.includes('replacement')) {
            const updatedOperationTypes = [...(exchangeData.operationTypes || []), 'replacement'];
            
            transaction.update(exchangeRef, {
              operationTypes: updatedOperationTypes,
              lastModified: serverTimestamp()
            });
            
            exchangeData.operationTypes = updatedOperationTypes;
          }
        } else {
          return { success: false, error: 'Informations insuffisantes pour identifier l\'échange' };
        }
        
        // Créer la proposition de remplacement
        const proposalId = uuidv4();
        const proposalData = {
          id: proposalId,
          targetExchangeId: exchangeId,
          targetUserId: user.id, // Propriétaire de la garde
          proposingUserId: user.id, // C'est le propriétaire qui propose, pas un remplaçant
          proposalType: 'replacement',
          isCombinedProposal: false,
          includesReplacement: true,
          targetShift: {
            date: exchangeData.date,
            period: exchangeData.period,
            shiftType: exchangeData.shiftType,
            timeSlot: exchangeData.timeSlot
          },
          proposedShifts: [], // Pas de garde proposée en échange pour un remplacement
          comment: options.comment || '',
          status: 'pending',
          isGroupProposal: options.isGroupProposal || false,
          targetUserIds: options.targetUserId ? [options.targetUserId] : [], // Liste des remplaçants ciblés
          createdAt: serverTimestamp()
        };
        
        // Stocker la proposition dans la collection des propositions
        const proposalRef = doc(collection(db, COLLECTIONS.DIRECT_PROPOSALS), proposalId);
        transaction.set(proposalRef, proposalData);
        
        // Mettre à jour l'échange pour indiquer qu'il a des propositions
        const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, exchangeId);
        transaction.update(exchangeRef, {
          hasProposals: true,
          lastModified: serverTimestamp()
        });
        
        // Envoyer des notifications après la transaction
        const userName = `${user.firstName} ${user.lastName}`;
        
        // Utiliser setTimeout pour s'assurer que ça se produit après la fin de la transaction
        setTimeout(async () => {
          try {
            if (options.isGroupProposal) {
              // Notifier tous les remplaçants
              await replacementNotificationService.notifyAllReplacements(
                userName,
                exchangeData.date,
                exchangeData.period,
                proposalId,
                options.comment
              );
            } else if (options.targetUserId) {
              // Notifier un remplaçant spécifique
              await replacementNotificationService.notifySpecificReplacement(
                options.targetUserId,
                userName,
                exchangeData.date,
                exchangeData.period,
                proposalId,
                options.comment
              );
            }
          } catch (err) {
            console.error('Error sending replacement notifications:', err);
          }
        }, 0);
        
        return { success: true, proposalId };
      });
    } catch (error) {
      console.error('Erreur lors de la proposition de remplacement:', error);
      return { 
        success: false, 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Répond à une proposition de remplacement (accepte ou rejette)
   * 
   * @param options Options de réponse
   * @returns Résultat de l'opération
   */
  async respondToReplacement(options: RespondToReplacementOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.getCurrentUser();
      
      // Exécuter la transaction
      return await runTransaction(db, async (transaction) => {
        // Récupérer la proposition
        const proposalRef = doc(db, COLLECTIONS.DIRECT_PROPOSALS, options.proposalId);
        const proposalDoc = await transaction.get(proposalRef);
        
        if (!proposalDoc.exists()) {
          return { success: false, error: "La proposition spécifiée n'existe pas" };
        }
        
        const proposalData = proposalDoc.data();
        
        // Vérifier que l'utilisateur est autorisé à répondre
        const isTargetUser = proposalData.targetUserIds && proposalData.targetUserIds.includes(user.id);
        if (!isTargetUser && !user.roles.isReplacement) {
          return { 
            success: false, 
            error: "Vous n'êtes pas autorisé à répondre à cette proposition" 
          };
        }
        
        // Récupérer l'échange cible
        const exchangeId = proposalData.targetExchangeId;
        const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, exchangeId);
        
        // Verrouiller l'échange pour l'opération
        const lockResult = await lockExchangeForOperation(transaction, {
          exchangeId,
          userId: user.id,
          date: proposalData.targetShift.date,
          period: proposalData.targetShift.period,
          operation: options.response === 'accept' ? 'take' : 'reject'
        });
        
        if (!lockResult.locked) {
          return { success: false, error: lockResult.error || "Impossible de verrouiller l'échange" };
        }
        
        if (options.response === 'accept') {
          // Accepter la proposition
          
          // Mettre à jour la proposition
          transaction.update(proposalRef, {
            status: 'accepted',
            acceptedBy: user.id,
            acceptedAt: serverTimestamp(),
            comment: options.comment || proposalData.comment,
            lastModified: serverTimestamp()
          });
          
          // Créer une entrée dans l'historique
          const historyData = {
            exchangeId,
            originalUserId: proposalData.targetUserId,
            newUserId: user.id,
            date: proposalData.targetShift.date,
            period: proposalData.targetShift.period,
            shiftType: proposalData.targetShift.shiftType,
            timeSlot: proposalData.targetShift.timeSlot,
            operationType: 'replacement',
            status: 'completed',
            comment: options.comment || proposalData.comment,
            createdAt: serverTimestamp()
          };
          
          const historyRef = doc(collection(db, COLLECTIONS.DIRECT_HISTORY));
          transaction.set(historyRef, historyData);
          
          // Mettre à jour l'échange pour indiquer qu'il est finalisé
          transaction.update(exchangeRef, {
            status: 'completed',
            completedBy: user.id,
            completedAt: serverTimestamp(),
            hasProposals: false,
            lastModified: serverTimestamp()
          });
          
          // Rejeter les autres propositions pour cet échange
          const otherProposalsQuery = query(
            collection(db, COLLECTIONS.DIRECT_PROPOSALS),
            where('targetExchangeId', '==', exchangeId),
            where('status', '==', 'pending')
          );
          
          const otherProposalsSnapshot = await transaction.get(otherProposalsQuery);
          
          otherProposalsSnapshot.docs.forEach(doc => {
            if (doc.id !== options.proposalId) {
              transaction.update(doc.ref, {
                status: 'rejected',
                rejectedBy: 'system',
                rejectedReason: 'Une autre proposition a été acceptée',
                lastModified: serverTimestamp()
              });
            }
          });
          
          // Déverrouiller l'échange
          unlockExchange(transaction, exchangeRef, null, true);
          
          // Notifier les systèmes de planning - sera fait de manière asynchrone après la transaction
          // pour ne pas risquer de bloquer la transaction si cette notification échoue
          const notificationPromise = notifyExchangeSystem(
            proposalData.targetUserId,
            '', // Pas besoin de période spécifique
            {
              [`${proposalData.targetShift.date}-${proposalData.targetShift.period}`]: {
                date: proposalData.targetShift.date,
                period: proposalData.targetShift.period,
                shiftType: proposalData.targetShift.shiftType,
                timeSlot: proposalData.targetShift.timeSlot,
                replacedBy: user.id,
                replacementDate: createParisDate()
              }
            },
            'update'
          );
          
          // La promesse sera exécutée après le commit de la transaction
          setTimeout(async () => {
            try {
              // Notifier les systèmes de planning
              await notificationPromise;
              
              // Récupérer les données de l'utilisateur propriétaire pour le notifier
              const originalUserDoc = await getDoc(doc(db, 'users', proposalData.targetUserId));
              const replacementUserName = `${user.firstName || ''} ${user.lastName || ''}`;
              
              if (originalUserDoc.exists()) {
                // Envoyer une notification au propriétaire de la garde
                await replacementNotificationService.notifyProposerOfAcceptance(
                  proposalData.targetUserId,
                  replacementUserName,
                  proposalData.targetShift.date,
                  proposalData.targetShift.period,
                  options.proposalId,
                  options.comment
                );
              }
            } catch (error) {
              console.error('Erreur lors de la notification des systèmes de planning ou de l\'envoi des notifications:', error);
            }
          }, 0);
          
          return { success: true };
        } else {
          // Rejeter la proposition
          
          // Mettre à jour la proposition
          transaction.update(proposalRef, {
            status: 'rejected',
            rejectedBy: user.id,
            rejectedAt: serverTimestamp(),
            rejectedReason: options.comment || 'Rejeté par le remplaçant',
            lastModified: serverTimestamp()
          });
          
          // Déverrouiller l'échange
          unlockExchange(transaction, exchangeRef, null, true);
          
          // Envoyer une notification au propriétaire après la transaction
          setTimeout(async () => {
            try {
              // Récupérer les données de l'utilisateur propriétaire
              const originalUserDoc = await getDoc(doc(db, 'users', proposalData.targetUserId));
              const replacementUserName = `${user.firstName || ''} ${user.lastName || ''}`;
              
              if (originalUserDoc.exists()) {
                // Envoyer une notification au propriétaire de la garde
                await replacementNotificationService.notifyProposerOfRejection(
                  proposalData.targetUserId,
                  replacementUserName,
                  proposalData.targetShift.date,
                  proposalData.targetShift.period,
                  options.proposalId,
                  options.comment
                );
              }
            } catch (error) {
              console.error('Erreur lors de l\'envoi de la notification de rejet:', error);
            }
          }, 0);
          
          return { success: true };
        }
      });
    } catch (error) {
      console.error('Erreur lors de la réponse à une proposition de remplacement:', error);
      return { 
        success: false, 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Récupère les propositions de remplacement destinées à un remplaçant
   * 
   * @returns Liste des propositions de remplacement
   */
  async getReplacementProposals(): Promise<{ proposals: any[]; error?: string }> {
    try {
      const user = await this.getCurrentUser();
      
      // Vérifier si l'utilisateur est un remplaçant
      if (!user.roles.isReplacement) {
        return { proposals: [], error: "L'utilisateur n'est pas un remplaçant" };
      }
      
      // Récupérer les propositions ciblées pour cet utilisateur
      const targetedProposalsQuery = query(
        collection(db, COLLECTIONS.DIRECT_PROPOSALS),
        where('targetUserIds', 'array-contains', user.id),
        where('status', '==', 'pending'),
        where('proposalType', '==', 'replacement')
      );
      
      const targetedProposalsSnapshot = await getDocs(targetedProposalsQuery);
      
      // Récupérer les propositions générales pour les remplaçants
      const generalProposalsQuery = query(
        collection(db, COLLECTIONS.DIRECT_PROPOSALS),
        where('isGroupProposal', '==', true),
        where('status', '==', 'pending'),
        where('proposalType', '==', 'replacement')
      );
      
      const generalProposalsSnapshot = await getDocs(generalProposalsQuery);
      
      // Fusionner les deux ensembles de propositions
      const proposals: any[] = [];
      
      // Ajouter les propositions ciblées
      targetedProposalsSnapshot.docs.forEach(doc => {
        proposals.push({
          id: doc.id,
          ...doc.data(),
          isTargeted: true
        });
      });
      
      // Ajouter les propositions générales qui ne sont pas déjà incluses
      generalProposalsSnapshot.docs.forEach(doc => {
        if (!proposals.some(p => p.id === doc.id)) {
          proposals.push({
            id: doc.id,
            ...doc.data(),
            isTargeted: false
          });
        }
      });
      
      // Récupérer les informations des utilisateurs qui proposent
      const userIds = [...new Set(proposals.map(p => p.targetUserId))];
      const usersData: Record<string, any> = {};
      
      for (const userId of userIds) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          usersData[userId] = {
            id: userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email
          };
        }
      }
      
      // Enrichir les propositions avec les données utilisateur
      const enrichedProposals = proposals.map(proposal => ({
        ...proposal,
        targetUser: usersData[proposal.targetUserId] || { id: proposal.targetUserId }
      }));
      
      return { proposals: enrichedProposals };
    } catch (error) {
      console.error('Erreur lors de la récupération des propositions de remplacement:', error);
      return { 
        proposals: [], 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Récupère l'historique des remplacements pour un utilisateur
   * 
   * @param options Options de filtrage
   * @returns Historique des remplacements
   */
  async getReplacementHistory(options: { 
    userId?: string; 
    status?: 'proposed' | 'accepted' | 'rejected' | 'completed';
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<{ history: any[]; error?: string }> {
    try {
      const currentUser = await this.getCurrentUser();
      const userId = options.userId || currentUser.id;
      
      // Construire la requête de base
      let historyQuery: any = query(
        collection(db, COLLECTIONS.DIRECT_HISTORY),
        where('operationType', '==', 'replacement')
      );
      
      // Ajouter les filtres
      if (userId) {
        historyQuery = query(
          historyQuery,
          where(currentUser.roles.isReplacement ? 'newUserId' : 'originalUserId', '==', userId)
        );
      }
      
      if (options.status) {
        historyQuery = query(historyQuery, where('status', '==', options.status));
      }
      
      if (options.startDate) {
        historyQuery = query(historyQuery, where('date', '>=', options.startDate));
      }
      
      if (options.endDate) {
        historyQuery = query(historyQuery, where('date', '<=', options.endDate));
      }
      
      // Exécuter la requête
      const historySnapshot = await getDocs(historyQuery);
      
      // Traiter les résultats
      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Limiter les résultats si nécessaire
      const limitedHistory = options.limit ? history.slice(0, options.limit) : history;
      
      return { history: limitedHistory };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des remplacements:', error);
      return { 
        history: [], 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Annule une proposition de remplacement
   * 
   * @param proposalId ID de la proposition à annuler
   * @returns Résultat de l'opération
   */
  async cancelReplacementProposal(proposalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.getCurrentUser();
      
      // Récupérer la proposition
      const proposalRef = doc(db, COLLECTIONS.DIRECT_PROPOSALS, proposalId);
      const proposalDoc = await getDoc(proposalRef);
      
      if (!proposalDoc.exists()) {
        return { success: false, error: "La proposition spécifiée n'existe pas" };
      }
      
      const proposalData = proposalDoc.data();
      
      // Vérifier que l'utilisateur est autorisé à annuler
      if (proposalData.targetUserId !== user.id && proposalData.proposingUserId !== user.id) {
        return { 
          success: false, 
          error: "Vous n'êtes pas autorisé à annuler cette proposition" 
        };
      }
      
      // Vérifier que la proposition est en attente
      if (proposalData.status !== 'pending') {
        return { 
          success: false, 
          error: "Seules les propositions en attente peuvent être annulées" 
        };
      }
      
      // Exécuter la transaction
      await runTransaction(db, async (transaction) => {
        // Mettre à jour la proposition
        transaction.update(proposalRef, {
          status: 'cancelled',
          cancelledBy: user.id,
          cancelledAt: serverTimestamp(),
          lastModified: serverTimestamp()
        });
        
        // Vérifier s'il reste d'autres propositions actives pour cet échange
        const otherProposalsQuery = query(
          collection(db, COLLECTIONS.DIRECT_PROPOSALS),
          where('targetExchangeId', '==', proposalData.targetExchangeId),
          where('status', '==', 'pending')
        );
        
        const otherProposalsSnapshot = await transaction.get(otherProposalsQuery);
        
        // Si c'était la dernière proposition, mettre à jour l'échange
        if (otherProposalsSnapshot.docs.length === 0) {
          const exchangeRef = doc(db, COLLECTIONS.DIRECT_EXCHANGES, proposalData.targetExchangeId);
          transaction.update(exchangeRef, {
            hasProposals: false,
            lastModified: serverTimestamp()
          });
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la proposition de remplacement:', error);
      return { 
        success: false, 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}

// Exporter une instance du service
export const replacementService = new ReplacementTransactionService();