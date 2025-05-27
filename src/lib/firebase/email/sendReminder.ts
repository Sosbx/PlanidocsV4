import { FirebaseError } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

/**
 * Envoie un email de rappel à un utilisateur spécifique
 * 
 * @param userId ID de l'utilisateur destinataire
 * @param deadline Date limite pour la validation
 * @param associationId ID de l'association (optionnel)
 * @returns Résultat de l'opération
 */
export const sendReminderEmail = async (userId: string, deadline: Date, associationId?: string): Promise<{ success: boolean; message?: string }> => {
  // Utiliser l'association fournie ou celle par défaut
  const currentAssociationId = associationId || ASSOCIATIONS.RIVE_DROITE;
  
  console.log('Tentative d\'envoi d\'email de rappel:', {
    userId,
    deadline: deadline.toISOString(),
    associationId: currentAssociationId
  });

  try {
    // Obtenir le token d'authentification
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('Utilisateur non authentifié. Veuillez vous connecter pour envoyer un rappel.');
    }
    
    const idToken = await currentUser.getIdToken();
    
    // URL de la fonction Cloud (europe-west1)
    const functionUrl = 'https://europe-west1-planego-696d3.cloudfunctions.net/sendReminderEmail';
    
    console.log('Appel de la fonction Cloud Firebase:', functionUrl);
    
    // Envoyer la requête avec un timeout de 10 secondes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userId,
        deadline: deadline.toISOString(),
        associationId: currentAssociationId,
        idToken
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    // Vérifier le statut HTTP
    if (!response.ok) {
      let errorData: any = {};
      const contentType = response.headers.get("content-type");
      
      try {
        // Si la réponse est du JSON, l'analyser
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorData = { text: await response.text() };
        }
      } catch (jsonError) {
        // En cas d'erreur lors de l'analyse JSON
        console.error('Erreur lors de l\'analyse de la réponse d\'erreur:', jsonError);
        errorData = { parseError: true };
      }
      
      console.error('Erreur HTTP détaillée:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      // Extraire le message d'erreur spécifique si disponible
      const errorMessage = 
        (errorData && errorData.error) || 
        (errorData && errorData.message) ||
        'Erreur lors de l\'envoi du rappel';
      
      // Gérer les codes HTTP courants
      if (response.status === 401) {
        throw new Error('Authentification invalide. Veuillez vous reconnecter.');
      } else if (response.status === 404) {
        throw new Error('La fonction Cloud n\'existe pas. Vérifiez le déploiement.');
      } else if (response.status === 500) {
        // Utiliser le message d'erreur du serveur si disponible
        throw new Error(`Erreur serveur: ${errorMessage}`);
      } else if (response.status === 503) {
        throw new Error('Service temporairement indisponible. Veuillez réessayer plus tard.');
      }
      
      throw new Error(`Erreur (${response.status}): ${errorMessage}`);
    }
    
    // Analyser la réponse
    const result = await response.json() as ReminderEmailResponse;
    console.log('Réponse de la fonction d\'envoi d\'email:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Échec de l\'envoi du rappel.');
    }
    
    return { 
      success: true, 
      message: result.message || 'Email envoyé avec succès'
    };
  } catch (error) {
    console.error('Erreur complète:', error);
    
    // Gérer les erreurs d'expiration
    if (error.name === 'AbortError') {
      throw new Error('Délai d\'attente dépassé lors de l\'envoi de l\'email. Veuillez réessayer.');
    }
    
    // Erreurs Firebase spécifiques
    if (error instanceof FirebaseError) {
      // Ajouter des cas spécifiques selon les codes d'erreur Firebase
      if (error.code === 'functions/unavailable') {
        throw new Error('Service Firebase Functions indisponible. Veuillez réessayer plus tard.');
      } else if (error.code === 'functions/unauthenticated') {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
    }
    
    // Erreur générique ou relancer l'erreur existante
    throw error instanceof Error 
      ? error 
      : new Error('Erreur inconnue lors de l\'envoi du rappel.');
  }
};

/**
 * Envoie des emails de rappel à plusieurs utilisateurs
 * 
 * @param userIds Liste des IDs utilisateurs
 * @param deadline Date limite pour la validation
 * @param associationId ID de l'association (optionnel)
 * @returns Résultat de l'opération
 */
export const sendBulkReminderEmails = async (
  userIds: string[], 
  deadline: Date, 
  associationId?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  details?: { success: number; failed: number; errors: Array<{ userId: string; error: string }> } 
}> => {
  // Utiliser l'association fournie ou celle par défaut
  const currentAssociationId = associationId || ASSOCIATIONS.RIVE_DROITE;
  
  console.log('Tentative d\'envoi d\'emails de rappel en masse:', {
    userCount: userIds.length,
    deadline: deadline.toISOString(),
    associationId: currentAssociationId
  });

  try {
    // Obtenir le token d'authentification
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('Utilisateur non authentifié. Veuillez vous connecter pour envoyer des rappels.');
    }
    
    const idToken = await currentUser.getIdToken();
    
    // URL de la fonction Cloud (europe-west1)
    const functionUrl = 'https://europe-west1-planego-696d3.cloudfunctions.net/sendBulkReminderEmails';
    
    console.log('Appel de la fonction Cloud Firebase:', functionUrl);
    
    // Envoyer la requête avec un timeout de 30 secondes (plus long pour les envois en masse)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userIds,
        deadline: deadline.toISOString(),
        associationId: currentAssociationId,
        idToken
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    // Vérifier le statut HTTP
    if (!response.ok) {
      let errorData: any = {};
      const contentType = response.headers.get("content-type");
      
      try {
        // Si la réponse est du JSON, l'analyser
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorData = { text: await response.text() };
        }
      } catch (jsonError) {
        // En cas d'erreur lors de l'analyse JSON
        console.error('Erreur lors de l\'analyse de la réponse d\'erreur:', jsonError);
        errorData = { parseError: true };
      }
      
      console.error('Erreur HTTP détaillée lors de l\'envoi en masse:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      // Extraire le message d'erreur spécifique si disponible
      const errorMessage = 
        (errorData && errorData.error) || 
        (errorData && errorData.message) ||
        'Erreur lors de l\'envoi des rappels';
      
      // Gérer les codes HTTP courants
      if (response.status === 401) {
        throw new Error('Authentification invalide. Veuillez vous reconnecter.');
      } else if (response.status === 404) {
        throw new Error('La fonction Cloud n\'existe pas. Vérifiez le déploiement.');
      } else if (response.status === 500) {
        // Utiliser le message d'erreur du serveur si disponible
        throw new Error(`Erreur serveur: ${errorMessage}`);
      } else if (response.status === 503) {
        throw new Error('Service temporairement indisponible. Veuillez réessayer plus tard.');
      } else if (response.status === 400) {
        throw new Error(`Requête invalide: ${errorMessage}`);
      }
      
      throw new Error(`Erreur (${response.status}): ${errorMessage}`);
    }
    
    // Analyser la réponse
    const result = await response.json() as ReminderEmailResponse;
    console.log('Réponse de la fonction d\'envoi en masse:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Échec de l\'envoi des rappels.');
    }
    
    return { 
      success: true, 
      message: result.message || 'Emails envoyés avec succès',
      details: result.details
    };
  } catch (error) {
    console.error('Erreur complète lors de l\'envoi en masse:', error);
    
    // Gérer les erreurs d'expiration
    if (error.name === 'AbortError') {
      throw new Error('Délai d\'attente dépassé lors de l\'envoi des emails. Le processus est peut-être toujours en cours côté serveur.');
    }
    
    // Erreurs Firebase spécifiques
    if (error instanceof FirebaseError) {
      // Ajouter des cas spécifiques selon les codes d'erreur Firebase
      if (error.code === 'functions/unavailable') {
        throw new Error('Service Firebase Functions indisponible. Veuillez réessayer plus tard.');
      } else if (error.code === 'functions/unauthenticated') {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      } else if (error.code === 'functions/resource-exhausted') {
        throw new Error('Limite de ressources atteinte. Réduisez le nombre d\'emails ou réessayez plus tard.');
      }
    }
    
    // Erreur générique ou relancer l'erreur existante
    throw error instanceof Error 
      ? error 
      : new Error('Erreur inconnue lors de l\'envoi des rappels.');
  }
};