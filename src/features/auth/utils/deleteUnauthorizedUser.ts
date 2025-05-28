import { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../../lib/firebase/config';

/**
 * Supprime un utilisateur Firebase Auth non autorisé
 * Cette fonction est utilisée pour nettoyer les comptes créés automatiquement
 * par Google Sign-In quand l'utilisateur n'existe pas dans notre base de données
 */
export const deleteUnauthorizedUser = async (user: FirebaseUser | null): Promise<void> => {
  if (!user) return;
  
  try {
    // Supprimer l'utilisateur de Firebase Auth
    await user.delete();
    console.log('Utilisateur non autorisé supprimé:', user.email);
  } catch (error) {
    // Si l'erreur est "requires-recent-login", c'est normal car l'utilisateur vient de se connecter
    // Dans ce cas, on ne peut pas le supprimer immédiatement
    if (error instanceof Error && error.message.includes('requires-recent-login')) {
      console.warn('Impossible de supprimer l\'utilisateur immédiatement après la connexion');
      // On peut juste s'assurer qu'il est déconnecté
      await auth.signOut();
    } else {
      console.error('Erreur lors de la suppression de l\'utilisateur non autorisé:', error);
    }
  }
};

/**
 * Vérifie si un email est dans une liste d'emails autorisés
 * Peut être utilisé pour implémenter une liste blanche
 */
export const isEmailWhitelisted = (email: string, whitelist: string[]): boolean => {
  return whitelist.some(allowedEmail => 
    allowedEmail.toLowerCase() === email.toLowerCase()
  );
};

/**
 * Vérifie si un domaine email est autorisé
 */
export const isDomainWhitelisted = (email: string, allowedDomains: string[]): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  return allowedDomains.some(allowedDomain => 
    domain === allowedDomain.toLowerCase()
  );
};