import { httpsCallable } from 'firebase/functions';
import { createParisDate } from '@/utils/timezoneUtils';
import { app, functions } from './config';
import { NotificationType } from './notifications';
import { formatDate } from '../../utils/dateUtils';

/**
 * Interface pour les données de notification push
 */
export interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: {
    relatedId?: string;
    link?: string;
    type?: string;
    createdAt?: string;
    [key: string]: any;
  };
}

/**
 * Envoie une notification push à un utilisateur via Firebase Cloud Functions
 * @param data Données de la notification push
 * @returns Résultat de l'opération
 */
export const sendPushNotification = async (data: PushNotificationData): Promise<any> => {
  try {
    // Vérifier si les fonctions Firebase sont disponibles
    if (!app) {
      console.error('Firebase app n\'est pas initialisé');
      return { success: false, message: 'Firebase app n\'est pas initialisé' };
    }
    
    // Appeler la fonction Cloud pour envoyer la notification push
    try {
      const sendPushNotificationFn = httpsCallable(functions, 'sendPushNotification');
      const result = await sendPushNotificationFn(data);
      console.log('Résultat de l\'envoi de notification push:', result.data);
      return result.data;
    } catch (cloudError: any) {
      console.error('Erreur lors de l\'appel à la fonction Cloud:', cloudError);
      
      // En cas d'erreur avec la fonction Cloud, on affiche un message dans la console
      // mais on continue avec une simulation pour ne pas bloquer l'application
      console.log('Simulation d\'envoi de notification push (fallback):', data);
      return { 
        success: false, 
        message: 'Erreur lors de l\'appel à la fonction Cloud, notification simulée',
        error: cloudError?.message || 'Erreur inconnue'
      };
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification push:', error);
    throw error;
  }
};

/**
 * Formate les messages de notification en fonction du type
 * @param type Type de notification
 * @param data Données supplémentaires
 * @returns Titre et corps de la notification
 */
export const formatNotificationMessage = (
  type: string, 
  data: any
): { title: string; body: string } => {
  switch (type) {
    case NotificationType.DESIDERATA_REMINDER:
      return {
        title: "Rappel : Validation des désiderata",
        body: `N'oubliez pas de valider vos désiderata avant le ${data.deadline}. Votre participation est essentielle pour la création du planning.`
      };
    case NotificationType.EXCHANGE_PROPOSED:
      return {
        title: "Nouvelle proposition d'échange",
        body: `${data.proposerName} vous propose un échange pour votre garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case NotificationType.EXCHANGE_ACCEPTED:
      return {
        title: "Proposition d'échange acceptée",
        body: `${data.accepterName} a accepté votre proposition d'échange pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case NotificationType.GIVE_PROPOSED:
      return {
        title: "Nouvelle proposition de cession",
        body: `${data.proposerName} vous propose de reprendre sa garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case NotificationType.GIVE_ACCEPTED:
      return {
        title: "Proposition de cession acceptée",
        body: `${data.accepterName} a accepté votre proposition de cession pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    case NotificationType.REPLACEMENT_PROPOSED:
      return {
        title: "Nouvelle proposition de remplacement",
        body: `${data.proposerName} vous propose un remplacement pour la garde du ${data.shiftDate} (${data.shiftPeriod})`
      };
    default:
      return {
        title: "Nouvelle notification",
        body: "Vous avez reçu une nouvelle notification dans l'application PlaniDocs."
      };
  }
};

/**
 * Envoie une notification push pour un rappel de désiderata
 * @param userId ID de l'utilisateur
 * @param deadline Date limite pour la validation des désiderata
 * @returns Résultat de l'opération
 */
export const sendDesiderataReminderPushNotification = async (
  userId: string,
  deadline: Date
): Promise<any> => {
  const deadlineStr = formatDate(deadline, 'long');
  
  return sendPushNotification({
    userId,
    title: "Rappel : Validation des désiderata",
    body: `N'oubliez pas de valider vos désiderata avant le ${deadlineStr}. Votre participation est essentielle pour la création du planning.`,
    type: NotificationType.DESIDERATA_REMINDER,
    data: {
      deadline: deadlineStr,
      link: '/desiderata',
      createdAt: createParisDate().toISOString()
    }
  });
};
