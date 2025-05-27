import { 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { 
  NotificationType, 
  NotificationIconType,
  addNotification
} from './notifications';
import { FirestoreCacheUtils } from '../../utils/cacheUtils';
import { standardizePeriod } from '../../utils/periodUtils';
import { formatDate } from '../../utils/dateUtils';

/**
 * Interface pour les options de notification des remplaçants
 */
export interface ReplacementNotificationOptions {
  targetUserIds?: string[];          // IDs des remplaçants spécifiques
  notifyAllReplacements?: boolean;   // Notifier tous les remplaçants
  proposalId: string;                // ID de la proposition de remplacement
  exchangeId?: string;               // ID de l'échange associé
  date: string;                      // Date de la garde au format YYYY-MM-DD
  period: string;                    // Période de la garde (M, AM, S)
  shiftType: string;                 // Type de garde
  timeSlot: string;                  // Créneau horaire
  senderName: string;                // Nom de l'expéditeur
  message?: string;                  // Message personnalisé
  notificationType: NotificationType; // Type de notification
  additionalData?: any;              // Données supplémentaires
}

/**
 * Interface pour les résultats de l'envoi de notification
 */
export interface NotificationResult {
  success: boolean;
  notifiedUsers: number;
  errors?: string[];
}

/**
 * Service de notification ciblé pour les remplacements
 * Permet l'envoi de notifications à des remplaçants spécifiques ou à tous les remplaçants
 */
export class ReplacementNotificationService {
  
  /**
   * Envoie une notification aux remplaçants ciblés ou à tous les remplaçants
   * 
   * @param options Options de notification
   * @returns Résultat de l'envoi de notification
   */
  async sendReplacementNotification(
    options: ReplacementNotificationOptions
  ): Promise<NotificationResult> {
    try {
      const errors: string[] = [];
      let notifiedUsers = 0;
      
      // Déterminer les destinataires
      let targetUserIds: string[] = [];
      
      if (options.targetUserIds && options.targetUserIds.length > 0) {
        // Utiliser les IDs spécifiés
        targetUserIds = options.targetUserIds;
      } else if (options.notifyAllReplacements) {
        // Récupérer tous les utilisateurs avec le rôle de remplaçant
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('roles.isReplacement', '==', true)
        );
        
        const snapshot = await getDocs(q);
        targetUserIds = snapshot.docs.map(doc => doc.id);
      }
      
      if (targetUserIds.length === 0) {
        return {
          success: false,
          notifiedUsers: 0,
          errors: ['Aucun destinataire trouvé']
        };
      }
      
      // Préparer le batch pour les notifications
      const batch = writeBatch(db);
      
      // Créer une notification pour chaque destinataire
      for (const userId of targetUserIds) {
        try {
          // Formater la date pour l'affichage
          const formattedDate = formatDate 
            ? formatDate(options.date, 'short') 
            : options.date;
          
          // Formater la période pour l'affichage
          const periodText = this.getPeriodDisplayText(options.period);
          
          // Construire le titre et le message de la notification
          let title = '';
          let message = '';
          let iconType = NotificationIconType.REPLACEMENT;
          let link = '/replacement-proposals';
          
          switch (options.notificationType) {
            case NotificationType.REPLACEMENT_PROPOSED:
              title = 'Nouvelle demande de remplacement';
              message = `${options.senderName} cherche un remplaçant pour sa garde du ${formattedDate} (${periodText})`;
              break;
            case NotificationType.REPLACEMENT_UPDATED:
              title = 'Demande de remplacement mise à jour';
              message = `${options.senderName} a mis à jour sa demande de remplacement pour le ${formattedDate} (${periodText})`;
              break;
            case NotificationType.REPLACEMENT_CANCELLED:
              title = 'Demande de remplacement annulée';
              message = `${options.senderName} a annulé sa demande de remplacement pour le ${formattedDate} (${periodText})`;
              break;
            case NotificationType.REPLACEMENT_ACCEPTED:
              title = 'Remplacement confirmé';
              message = `Votre remplacement pour la garde de ${options.senderName} le ${formattedDate} (${periodText}) est confirmé`;
              link = '/planning';
              iconType = NotificationIconType.CHECK;
              break;
            default:
              title = 'Notification de remplacement';
              message = `Information concernant le remplacement du ${formattedDate} (${periodText})`;
          }
          
          // Ajouter le message personnalisé s'il existe
          if (options.message) {
            message += `. ${options.message}`;
          }
          
          // Créer la notification
          const notificationsRef = collection(db, 'notifications');
          const notificationDoc = doc(notificationsRef);
          
          batch.set(notificationDoc, {
            userId,
            title,
            message,
            type: options.notificationType,
            iconType,
            read: false,
            createdAt: Timestamp.now(),
            relatedId: options.proposalId,
            link,
            additionalData: options.additionalData
          });
          
          // Invalider le cache des notifications pour cet utilisateur
          FirestoreCacheUtils.invalidate(`notifications_user_${userId}`);
          
          notifiedUsers++;
        } catch (err) {
          console.error(`Error creating notification for user ${userId}:`, err);
          errors.push(`Erreur pour l'utilisateur ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // Exécuter le batch
      await batch.commit();
      
      return {
        success: true,
        notifiedUsers,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error sending replacement notifications:', error);
      return {
        success: false,
        notifiedUsers: 0,
        errors: [`Erreur globale: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * Notifie un remplaçant spécifique à propos d'une proposition
   * 
   * @param userId ID de l'utilisateur à notifier
   * @param senderName Nom de l'expéditeur
   * @param date Date de la garde
   * @param period Période de la garde
   * @param proposalId ID de la proposition
   * @param message Message personnalisé optionnel
   * @returns ID de la notification créée
   */
  async notifySpecificReplacement(
    userId: string,
    senderName: string,
    date: string,
    period: string,
    proposalId: string,
    message?: string
  ): Promise<string> {
    try {
      // Formater la date pour l'affichage
      const formattedDate = formatDate 
        ? formatDate(date, 'short') 
        : date;
      
      // Formater la période pour l'affichage
      const periodText = this.getPeriodDisplayText(period);
      
      const title = 'Proposition de remplacement';
      let notificationMessage = `${senderName} vous propose un remplacement pour sa garde du ${formattedDate} (${periodText})`;
      
      if (message) {
        notificationMessage += `. ${message}`;
      }
      
      // Invalider le cache des notifications pour cet utilisateur
      FirestoreCacheUtils.invalidate(`notifications_user_${userId}`);
      
      // Créer la notification
      return await addNotification({
        userId,
        title,
        message: notificationMessage,
        type: NotificationType.REPLACEMENT_PROPOSED,
        iconType: NotificationIconType.REPLACEMENT,
        relatedId: proposalId,
        link: '/replacement-proposals'
      });
    } catch (error) {
      console.error('Error notifying specific replacement:', error);
      throw error;
    }
  }
  
  /**
   * Notifie tous les remplaçants à propos d'une proposition
   * 
   * @param senderName Nom de l'expéditeur
   * @param date Date de la garde
   * @param period Période de la garde
   * @param proposalId ID de la proposition
   * @param message Message personnalisé optionnel
   * @returns Résultat de l'envoi de notification
   */
  async notifyAllReplacements(
    senderName: string,
    date: string,
    period: string,
    proposalId: string,
    message?: string
  ): Promise<NotificationResult> {
    try {
      return await this.sendReplacementNotification({
        notifyAllReplacements: true,
        proposalId,
        date,
        period,
        shiftType: '', // Ne sera pas utilisé directement
        timeSlot: '',  // Ne sera pas utilisé directement
        senderName,
        message,
        notificationType: NotificationType.REPLACEMENT_PROPOSED
      });
    } catch (error) {
      console.error('Error notifying all replacements:', error);
      return {
        success: false,
        notifiedUsers: 0,
        errors: [`Erreur: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * Notifie le médecin demandeur qu'un remplaçant a accepté sa proposition
   * 
   * @param userId ID du médecin demandeur
   * @param replacementName Nom du remplaçant
   * @param date Date de la garde
   * @param period Période de la garde
   * @param proposalId ID de la proposition
   * @param message Message personnalisé optionnel
   * @returns ID de la notification créée
   */
  async notifyProposerOfAcceptance(
    userId: string,
    replacementName: string,
    date: string,
    period: string,
    proposalId: string,
    message?: string
  ): Promise<string> {
    try {
      // Formater la date pour l'affichage
      const formattedDate = formatDate 
        ? formatDate(date, 'short') 
        : date;
      
      // Formater la période pour l'affichage
      const periodText = this.getPeriodDisplayText(period);
      
      const title = 'Remplacement accepté';
      let notificationMessage = `${replacementName} a accepté de vous remplacer pour votre garde du ${formattedDate} (${periodText})`;
      
      if (message) {
        notificationMessage += `. ${message}`;
      }
      
      // Invalider le cache des notifications pour cet utilisateur
      FirestoreCacheUtils.invalidate(`notifications_user_${userId}`);
      
      // Créer la notification
      return await addNotification({
        userId,
        title,
        message: notificationMessage,
        type: NotificationType.REPLACEMENT_ACCEPTED,
        iconType: NotificationIconType.CHECK,
        relatedId: proposalId,
        link: '/planning'
      });
    } catch (error) {
      console.error('Error notifying proposer of acceptance:', error);
      throw error;
    }
  }
  
  /**
   * Notifie le médecin demandeur qu'un remplaçant a rejeté sa proposition
   * 
   * @param userId ID du médecin demandeur
   * @param replacementName Nom du remplaçant
   * @param date Date de la garde
   * @param period Période de la garde
   * @param proposalId ID de la proposition
   * @param reason Raison du rejet
   * @returns ID de la notification créée
   */
  async notifyProposerOfRejection(
    userId: string,
    replacementName: string,
    date: string,
    period: string,
    proposalId: string,
    reason?: string
  ): Promise<string> {
    try {
      // Formater la date pour l'affichage
      const formattedDate = formatDate 
        ? formatDate(date, 'short') 
        : date;
      
      // Formater la période pour l'affichage
      const periodText = this.getPeriodDisplayText(period);
      
      const title = 'Remplacement refusé';
      let notificationMessage = `${replacementName} a refusé votre demande de remplacement pour la garde du ${formattedDate} (${periodText})`;
      
      if (reason) {
        notificationMessage += `. Raison: ${reason}`;
      }
      
      // Invalider le cache des notifications pour cet utilisateur
      FirestoreCacheUtils.invalidate(`notifications_user_${userId}`);
      
      // Créer la notification
      return await addNotification({
        userId,
        title,
        message: notificationMessage,
        type: NotificationType.REPLACEMENT_REJECTED,
        iconType: NotificationIconType.X,
        relatedId: proposalId,
        link: '/direct-exchange'
      });
    } catch (error) {
      console.error('Error notifying proposer of rejection:', error);
      throw error;
    }
  }
  
  /**
   * Convertit une période en texte lisible
   * @param period Période (M, AM, S)
   * @returns Texte formaté de la période
   */
  private getPeriodDisplayText(period: string): string {
    const standardizedPeriod = standardizePeriod(period);
    switch (standardizedPeriod) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return period;
    }
  }
}

// Exporter une instance du service
export const replacementNotificationService = new ReplacementNotificationService();