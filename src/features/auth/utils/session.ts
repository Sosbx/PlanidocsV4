import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../lib/firebase/config';
import { getAuthErrorMessage } from './errors';
import { getUserByLogin } from '../../../lib/firebase/users';
import { ensureUserRoles } from '../../../features/users/utils/userUtils';
import type { User } from '../../../features/users/types';

/**
 * Connecte un utilisateur avec son login et son mot de passe
 * 
 * @param login - Le login de l'utilisateur
 * @param password - Le mot de passe de l'utilisateur
 * @returns Les données de l'utilisateur connecté
 */
export const signInUser = async (login: string, password: string): Promise<User> => {
  try {
    // Récupérer l'utilisateur par son login
    const userData = await getUserByLogin(login.toUpperCase());
    
    if (!userData) {
      throw new Error('Identifiants invalides');
    }
    
    // Se connecter avec l'email et le mot de passe
    try {
      // Essayer d'abord avec le mot de passe tel quel (pour les mots de passe réinitialisés)
      await signInWithEmailAndPassword(auth, userData.email, password);
    } catch (error) {
      // Si ça échoue, essayer avec le mot de passe en majuscules (pour la compatibilité)
      try {
        await signInWithEmailAndPassword(auth, userData.email, password.toUpperCase());
      } catch (innerError) {
        throw new Error('Identifiants invalides');
      }
    }
    // Assurer que l'utilisateur a la propriété roles correctement définie
    return ensureUserRoles(userData);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
};

/**
 * Déconnecte l'utilisateur actuellement connecté
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('Une erreur est survenue lors de la déconnexion');
  }
};

/**
 * Envoie un email de réinitialisation de mot de passe à l'utilisateur
 * 
 * @param login - Le login de l'utilisateur
 */
export const resetPassword = async (login: string): Promise<void> => {
  try {
    const userData = await getUserByLogin(login.toUpperCase());
    if (!userData) {
      throw new Error('Aucun compte trouvé avec cet identifiant. Vérifiez que vous avez saisi les 4 premières lettres de votre NOM en majuscules.');
    }
    
    await sendPasswordResetEmail(auth, userData.email);
  } catch (error) {
    console.error('Error sending reset password email:', {
      error,
      login,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Une erreur est survenue lors de la réinitialisation du mot de passe');
  }
};
