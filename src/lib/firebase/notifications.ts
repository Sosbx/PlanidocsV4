import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import { ShiftPeriod } from '../../types/exchange';
import { getPeriodDisplayText, formatDate } from '../../utils/dateUtils';
import { FirestoreCacheUtils } from '../../utils/cacheUtils';
import { sendPushNotification } from './pushNotifications';

// Types de notifications
export enum NotificationType {
  // Échanges
  EXCHANGE_PROPOSED = 'exchange_proposed',
  EXCHANGE_ACCEPTED = 'exchange_accepted',
  EXCHANGE_REJECTED = 'exchange_rejected',
  EXCHANGE_COMPLETED = 'exchange_completed',
  EXCHANGE_UPDATED = 'exchange_updated',
  EXCHANGE_CANCELLED = 'exchange_cancelled',
  
  // Cessions
  GIVE_PROPOSED = 'give_proposed',
  GIVE_ACCEPTED = 'give_accepted',
  GIVE_REJECTED = 'give_rejected',
  GIVE_COMPLETED = 'give_completed',
  GIVE_UPDATED = 'give_updated',
  GIVE_CANCELLED = 'give_cancelled',
  
  // Remplacements
  REPLACEMENT_PROPOSED = 'replacement_proposed',
  REPLACEMENT_ACCEPTED = 'replacement_accepted',
  REPLACEMENT_REJECTED = 'replacement_rejected',
  REPLACEMENT_UPDATED = 'replacement_updated',
  REPLACEMENT_CANCELLED = 'replacement_cancelled',
  
  // Propositions
  PROPOSAL_UPDATED = 'proposal_updated',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  PROPOSAL_CANCELLED = 'proposal_cancelled',
  
  // Désiderata
  DESIDERATA_REMINDER = 'desiderata_reminder',
  
  // Autres
  INTERESTED_USER = 'interested_user',
  SYSTEM = 'system',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

// Types d'icônes disponibles
export enum NotificationIconType {
  EXCHANGE = 'exchange',
  GIVE = 'give',
  REPLACEMENT = 'replacement',
  CHECK = 'check',
  X = 'x',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  NONE = 'none'
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  iconType?: NotificationIconType;
  read: boolean;
  createdAt: string;
  relatedId?: string;
  link?: string;
  actionText?: string;
  secondaryAction?: {
    text: string;
    link: string;
  };
}

/**
 * Interface pour la création de notifications standardisées
 */
export interface NotificationCreateOptions {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  iconType?: NotificationIconType;
  relatedId?: string;
  link?: string;
  actionText?: string;
  secondaryAction?: {
    text: string;
    link: string;
  };
}



/**
 * Récupère les notifications d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param forceRefresh Forcer le rafraîchissement du cache
 * @returns Liste des notifications
 */
export const getNotificationsForUser = async (
  userId: string, 
  forceRefresh: boolean = false
): Promise<Notification[]> => {
  try {
    // Clé de cache pour les notifications de cet utilisateur
    const cacheKey = `notifications_user_${userId}`;
    
    // Vérifier si les données sont dans le cache et si on ne force pas le rafraîchissement
    if (!forceRefresh) {
      const cachedData = FirestoreCacheUtils.get<Notification[]>(cacheKey);
      if (cachedData) {
        console.log(`Utilisation des notifications en cache pour l'utilisateur ${userId}`);
        return cachedData;
      }
    }
    
    // Si pas de données en cache ou rafraîchissement forcé, récupérer depuis Firestore
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const notifications: Notification[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        iconType: data.iconType || NotificationIconType.NONE,
        read: data.read,
        createdAt: data.createdAt.toDate().toISOString(),
        relatedId: data.relatedId,
        link: data.link,
        actionText: data.actionText,
        secondaryAction: data.secondaryAction
      });
    });
    
    // Mettre en cache les données récupérées
    FirestoreCacheUtils.set(cacheKey, notifications);
    
    return notifications;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

/**
 * Ajoute une notification pour un utilisateur
 * @param options Options de configuration de la notification
 * @returns ID de la notification créée
 */
export const addNotification = async (
  options: NotificationCreateOptions
): Promise<string> => {
  try {
    // Valider les données obligatoires
    if (!options.userId || !options.title || !options.message || !options.type) {
      throw new Error('Données de notification incomplètes');
    }
    
    // Déterminer automatiquement l'icône si non spécifiée
    let iconType = options.iconType;
    if (!iconType) {
      if (options.type.includes('exchange')) {
        iconType = NotificationIconType.EXCHANGE;
      } else if (options.type.includes('give')) {
        iconType = NotificationIconType.GIVE;
      } else if (options.type.includes('replacement')) {
        iconType = NotificationIconType.REPLACEMENT;
      } else if (options.type.includes('accepted')) {
        iconType = NotificationIconType.CHECK;
      } else if (options.type.includes('rejected')) {
        iconType = NotificationIconType.X;
      } else if (options.type.includes('info')) {
        iconType = NotificationIconType.INFO;
      } else if (options.type.includes('warning')) {
        iconType = NotificationIconType.WARNING;
      } else if (options.type.includes('error')) {
        iconType = NotificationIconType.ERROR;
      } else {
        iconType = NotificationIconType.NONE;
      }
    }
    
    const notificationsRef = collection(db, 'notifications');
    const notificationData = {
      userId: options.userId,
      title: options.title,
      message: options.message,
      type: options.type,
      iconType: iconType,
      read: false,
      createdAt: Timestamp.now(),
      relatedId: options.relatedId,
      link: options.link,
      actionText: options.actionText,
      secondaryAction: options.secondaryAction
    };
    
    const notificationRef = await addDoc(notificationsRef, notificationData);
    
    // Invalider le cache pour cet utilisateur
    FirestoreCacheUtils.invalidate(`notifications_user_${options.userId}`);
    
    // Envoyer également une notification push
    try {
      const pushData = {
        userId: options.userId,
        title: options.title,
        body: options.message,
        type: options.type,
        data: {
          relatedId: options.relatedId || '',
          link: options.link || '',
          type: options.type,
          createdAt: new Date().toISOString()
        }
      };
      
      // Envoyer la notification push
      await sendPushNotification(pushData);
      console.log('Notification push envoyée avec succès');
    } catch (pushError) {
      console.error('Erreur lors de l\'envoi de la notification push:', pushError);
      // Ne pas bloquer le processus si l'envoi de notification push échoue
    }
    
    return notificationRef.id;
  } catch (error) {
    console.error('Error adding notification:', error);
    throw error;
  }
};

/**
 * Marque une notification comme lue
 * @param notificationId ID de la notification
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 * @param userId ID de l'utilisateur
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Supprime une notification
 * @param notificationId ID de la notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Supprime toutes les notifications d'un utilisateur
 * @param userId ID de l'utilisateur
 */
export const deleteAllNotificationsForUser = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
};

/**
 * Système central d'envoi de notifications pour les échanges
 * Gère tous les types de notifications liées aux échanges
 */
export const sendExchangeNotification = async (
  userId: string,
  notificationType: NotificationType,
  shiftDate: string,
  shiftPeriod: ShiftPeriod | string,
  exchangeId: string,
  otherUserName?: string,
  additionalInfo?: string
): Promise<string> => {
  const periodText = getPeriodDisplayText(shiftPeriod);
  // Formater la date pour l'affichage (JJ/MM/YYYY)
  const formattedDate = formatDate ? formatDate(shiftDate, 'short') : shiftDate;
  
  let title = '';
  let message = '';
  let iconType: NotificationIconType = NotificationIconType.NONE;
  let link = '/direct-exchange';
  
  switch (notificationType) {
    // Propositions
    case NotificationType.EXCHANGE_PROPOSED:
      title = 'Nouvelle proposition d\'échange';
      message = `${otherUserName} vous propose un échange pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.EXCHANGE;
      break;
    case NotificationType.GIVE_PROPOSED:
      title = 'Nouvelle proposition de cession';
      message = `${otherUserName} vous propose une cession pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.GIVE;
      break;
    case NotificationType.REPLACEMENT_PROPOSED:
      title = 'Nouvelle demande de remplacement';
      message = `${otherUserName} cherche un remplaçant pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.REPLACEMENT;
      break;
    case NotificationType.INTERESTED_USER:
      title = 'Utilisateur intéressé par votre garde';
      message = `${otherUserName} est intéressé par votre garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.INFO;
      break;
      
    // Acceptations
    case NotificationType.EXCHANGE_ACCEPTED:
      title = 'Échange accepté';
      message = `${otherUserName} a accepté votre proposition d'échange pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.CHECK;
      link = '/planning';
      break;
    case NotificationType.GIVE_ACCEPTED:
      title = 'Cession acceptée';
      message = `${otherUserName} a accepté votre proposition de cession pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.CHECK;
      link = '/planning';
      break;
    case NotificationType.REPLACEMENT_ACCEPTED:
      title = 'Remplacement accepté';
      message = `${otherUserName} a accepté d'assurer votre garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.CHECK;
      link = '/planning';
      break;
      
    // Rejets
    case NotificationType.EXCHANGE_REJECTED:
      title = 'Échange refusé';
      message = `${otherUserName} a refusé votre proposition d'échange pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
    case NotificationType.GIVE_REJECTED:
      title = 'Cession refusée';
      message = `${otherUserName} a refusé votre proposition de cession pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
    case NotificationType.REPLACEMENT_REJECTED:
      title = 'Remplacement refusé';
      message = `${otherUserName} a refusé d'assurer votre garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
      
    // Mises à jour
    case NotificationType.EXCHANGE_UPDATED:
      title = 'Échange modifié';
      message = `${otherUserName || 'Un utilisateur'} a modifié sa proposition d'échange pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.INFO;
      break;
    case NotificationType.GIVE_UPDATED:
      title = 'Cession modifiée';
      message = `${otherUserName || 'Un utilisateur'} a modifié sa proposition de cession pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.INFO;
      break;
    case NotificationType.REPLACEMENT_UPDATED:
      title = 'Remplacement modifié';
      message = `${otherUserName || 'Un utilisateur'} a modifié sa demande de remplacement pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.INFO;
      break;
    case NotificationType.PROPOSAL_UPDATED:
      title = 'Proposition modifiée';
      message = `${otherUserName || 'Un utilisateur'} a modifié sa proposition pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.INFO;
      break;
      
    // Annulations
    case NotificationType.EXCHANGE_CANCELLED:
      title = 'Échange annulé';
      message = `${otherUserName || 'Un utilisateur'} a annulé sa proposition d'échange pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
    case NotificationType.GIVE_CANCELLED:
      title = 'Cession annulée';
      message = `${otherUserName || 'Un utilisateur'} a annulé sa proposition de cession pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
    case NotificationType.REPLACEMENT_CANCELLED:
      title = 'Remplacement annulé';
      message = `${otherUserName || 'Un utilisateur'} a annulé sa demande de remplacement pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
    case NotificationType.PROPOSAL_CANCELLED:
      title = 'Proposition annulée';
      message = `${otherUserName || 'Un utilisateur'} a annulé sa proposition pour la garde du ${formattedDate} (${periodText})`;
      iconType = NotificationIconType.X;
      break;
      
    // Finalisations
    case NotificationType.EXCHANGE_COMPLETED:
      title = 'Échange finalisé';
      message = `Votre échange de garde du ${formattedDate} (${periodText}) a été finalisé`;
      iconType = NotificationIconType.CHECK;
      link = '/planning';
      break;
    case NotificationType.GIVE_COMPLETED:
      title = 'Cession finalisée';
      message = `Votre cession de garde du ${formattedDate} (${periodText}) a été finalisée`;
      iconType = NotificationIconType.CHECK;
      link = '/planning';
      break;
      
    default:
      title = 'Notification de garde';
      message = `Information concernant votre garde du ${formattedDate} (${periodText})`;
      if (additionalInfo) {
        message += `: ${additionalInfo}`;
      }
  }
  
  // Invalider le cache des notifications pour cet utilisateur
  FirestoreCacheUtils.invalidate(`notifications_user_${userId}`);
  
  return addNotification({
    userId,
    title,
    message: additionalInfo ? `${message}. ${additionalInfo}` : message,
    type: notificationType,
    iconType,
    relatedId: exchangeId,
    link
  });
};



/**
 * Crée une notification de rappel pour les désiderata
 * @param userId ID de l'utilisateur destinataire
 * @param deadline Date limite pour la validation des désiderata
 * @returns ID de la notification créée
 */
export const createDesiderataReminderNotification = async (
  userId: string,
  deadline: Date
): Promise<string> => {
  const deadlineStr = formatDate(deadline);
  
  return addNotification({
    userId,
    title: 'Rappel : Validation des désiderata',
    message: `N'oubliez pas de valider vos désiderata avant le ${deadlineStr}. Votre participation est essentielle pour la création du planning.`,
    type: NotificationType.DESIDERATA_REMINDER,
    iconType: NotificationIconType.WARNING,
    link: '/desiderata',
    actionText: 'Voir mes désiderata'
  });
};

/**
 * Crée une notification de rappel pour les désiderata et envoie également un email
 * @param userId ID de l'utilisateur destinataire
 * @param deadline Date limite pour la validation des désiderata
 * @param associationId ID de l'association
 * @returns ID de la notification créée
 */
export const createDesiderataReminderWithEmail = async (
  userId: string,
  deadline: Date,
  associationId?: string
): Promise<string> => {
  // Créer la notification dans l'application
  const notificationId = await createDesiderataReminderNotification(userId, deadline);
  
  // Essayer d'envoyer également un email
  // Cette partie sera implémentée plus tard en intégrant avec le système d'email existant
  // TODO: Intégrer avec le système d'email existant
  console.log('Association ID pour l\'envoi d\'email:', associationId);
  
  return notificationId;
};

/**
 * Fonctions pour les nouveaux types de notifications
 */

// Notification de mise à jour d'échange
export const createExchangeUpdatedNotification = async (
  userId: string,
  updaterName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.EXCHANGE_UPDATED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    updaterName,
    additionalInfo
  );
};

// Notification d'annulation d'échange
export const createExchangeCancelledNotification = async (
  userId: string,
  cancellerName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.EXCHANGE_CANCELLED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    cancellerName,
    additionalInfo
  );
};

// Notification de mise à jour de cession
export const createGiveUpdatedNotification = async (
  userId: string,
  updaterName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.GIVE_UPDATED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    updaterName,
    additionalInfo
  );
};

// Notification d'annulation de cession
export const createGiveCancelledNotification = async (
  userId: string,
  cancellerName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.GIVE_CANCELLED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    cancellerName,
    additionalInfo
  );
};

// Notification de mise à jour de proposition
export const createProposalUpdatedNotification = async (
  userId: string,
  updaterName: string,
  shiftDate: string,
  shiftPeriod: string,
  proposalId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.PROPOSAL_UPDATED,
    shiftDate,
    shiftPeriod,
    proposalId,
    updaterName,
    additionalInfo
  );
};

// Notification d'annulation de proposition
export const createProposalCancelledNotification = async (
  userId: string,
  cancellerName: string,
  shiftDate: string,
  shiftPeriod: string,
  proposalId: string,
  additionalInfo?: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.PROPOSAL_CANCELLED,
    shiftDate,
    shiftPeriod,
    proposalId,
    cancellerName,
    additionalInfo
  );
};

// Fonctions de rétrocompatibilité pour éviter de casser le code existant
export const createExchangeProposalNotification = async (
  userId: string,
  proposerName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.EXCHANGE_PROPOSED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    proposerName
  );
};

export const createGiveProposalNotification = async (
  userId: string,
  proposerName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.GIVE_PROPOSED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    proposerName
  );
};

export const createInterestedUserNotification = async (
  userId: string,
  interestedName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.INTERESTED_USER,
    shiftDate,
    shiftPeriod,
    exchangeId,
    interestedName
  );
};

export const createExchangeAcceptedNotification = async (
  userId: string,
  accepterName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.EXCHANGE_ACCEPTED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    accepterName
  );
};

export const createGiveAcceptedNotification = async (
  userId: string,
  accepterName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    NotificationType.GIVE_ACCEPTED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    accepterName
  );
};

export const createRejectedNotification = async (
  userId: string,
  refuserName: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  isExchange: boolean
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    isExchange ? NotificationType.EXCHANGE_REJECTED : NotificationType.GIVE_REJECTED,
    shiftDate,
    shiftPeriod,
    exchangeId,
    refuserName
  );
};

export const createCompletedNotification = async (
  userId: string,
  shiftDate: string,
  shiftPeriod: string,
  exchangeId: string,
  isExchange: boolean
): Promise<string> => {
  return sendExchangeNotification(
    userId,
    isExchange ? NotificationType.EXCHANGE_COMPLETED : NotificationType.GIVE_COMPLETED,
    shiftDate,
    shiftPeriod,
    exchangeId
  );
};
