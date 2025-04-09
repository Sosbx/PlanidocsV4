import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config';
import { getAuthErrorMessage } from './errors';
import { getUserByLogin } from '../users';
import type { User } from '../../../types/users';

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
    return userData;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('Une erreur est survenue lors de la déconnexion');
  }
};

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