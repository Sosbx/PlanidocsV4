import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config';
import { ASSOCIATIONS } from '../../../constants/associations';

/**
 * Types de réponse des fonctions d'envoi d'emails
 */
interface ReminderEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    success: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  };
}

// Initialiser Firebase Functions avec la région europe-west1
const functions = getFunctions(app, 'europe-west1');

/**
 * Envoie un email de rappel à un utilisateur spécifique via Firebase Callable Function
 * Cette méthode évite les problèmes de CSP en utilisant le SDK Firebase
 * 
 * @param userId ID de l'utilisateur destinataire
 * @param deadline Date limite pour la validation
 * @param associationId ID de l'association (optionnel)
 * @returns Résultat de l'opération
 */
export const sendReminderEmailCallable = async (
  userId: string, 
  deadline: Date, 
  associationId?: string
): Promise<{ success: boolean; message?: string }> => {
  const currentAssociationId = associationId || ASSOCIATIONS.RIVE_DROITE;
  
  console.log('Envoi d\'email de rappel via Firebase Callable:', {
    userId,
    deadline: deadline.toISOString(),
    associationId: currentAssociationId
  });

  try {
    // Créer une référence à la fonction callable
    const sendReminder = httpsCallable<
      { userId: string; deadline: string; associationId: string },
      ReminderEmailResponse
    >(functions, 'sendReminderEmail');

    // Appeler la fonction
    const result = await sendReminder({
      userId,
      deadline: deadline.toISOString(),
      associationId: currentAssociationId
    });

    console.log('Réponse de la fonction callable:', result.data);

    if (!result.data.success) {
      throw new Error(result.data.error || 'Échec de l\'envoi du rappel.');
    }

    return {
      success: true,
      message: result.data.message || 'Email envoyé avec succès'
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'appel de la fonction callable:', error);
    
    // Gérer les erreurs spécifiques de Firebase Functions
    if (error.code === 'functions/unavailable') {
      throw new Error('Service temporairement indisponible. Veuillez réessayer plus tard.');
    } else if (error.code === 'functions/unauthenticated') {
      throw new Error('Vous devez être connecté pour envoyer un rappel.');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('Vous n\'avez pas les permissions pour envoyer des rappels.');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Données invalides. Vérifiez les informations fournies.');
    }
    
    // Si l'erreur contient un message personnalisé
    if (error.message) {
      throw new Error(error.message);
    }
    
    throw new Error('Erreur inconnue lors de l\'envoi du rappel.');
  }
};

/**
 * Envoie des emails de rappel à plusieurs utilisateurs via Firebase Callable Function
 * Cette méthode évite les problèmes de CSP en utilisant le SDK Firebase
 * 
 * @param userIds Liste des IDs utilisateurs
 * @param deadline Date limite pour la validation
 * @param associationId ID de l'association (optionnel)
 * @returns Résultat de l'opération
 */
export const sendBulkReminderEmailsCallable = async (
  userIds: string[], 
  deadline: Date, 
  associationId?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  details?: { success: number; failed: number; errors: Array<{ userId: string; error: string }> } 
}> => {
  const currentAssociationId = associationId || ASSOCIATIONS.RIVE_DROITE;
  
  console.log('Envoi d\'emails de rappel en masse via Firebase Callable:', {
    userCount: userIds.length,
    deadline: deadline.toISOString(),
    associationId: currentAssociationId
  });

  try {
    // Créer une référence à la fonction callable
    const sendBulkReminders = httpsCallable<
      { userIds: string[]; deadline: string; associationId: string },
      ReminderEmailResponse
    >(functions, 'sendBulkReminderEmails');

    // Appeler la fonction
    const result = await sendBulkReminders({
      userIds,
      deadline: deadline.toISOString(),
      associationId: currentAssociationId
    });

    console.log('Réponse de la fonction callable pour envoi en masse:', result.data);

    if (!result.data.success) {
      throw new Error(result.data.error || 'Échec de l\'envoi des rappels.');
    }

    return {
      success: true,
      message: result.data.message || 'Emails envoyés avec succès',
      details: result.data.details
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'appel de la fonction callable en masse:', error);
    
    // Gérer les erreurs spécifiques de Firebase Functions
    if (error.code === 'functions/unavailable') {
      throw new Error('Service temporairement indisponible. Veuillez réessayer plus tard.');
    } else if (error.code === 'functions/unauthenticated') {
      throw new Error('Vous devez être connecté pour envoyer des rappels.');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('Vous n\'avez pas les permissions pour envoyer des rappels.');
    } else if (error.code === 'functions/deadline-exceeded') {
      throw new Error('L\'envoi a pris trop de temps. Le processus continue peut-être en arrière-plan.');
    } else if (error.code === 'functions/resource-exhausted') {
      throw new Error('Trop d\'emails à envoyer. Réduisez le nombre ou réessayez plus tard.');
    }
    
    // Si l'erreur contient un message personnalisé
    if (error.message) {
      throw new Error(error.message);
    }
    
    throw new Error('Erreur inconnue lors de l\'envoi des rappels.');
  }
};