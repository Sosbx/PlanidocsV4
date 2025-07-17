import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, signInWithPopup, linkWithPopup } from 'firebase/auth';
import { createParisDate } from '@/utils/timezoneUtils';
import { auth, googleProvider } from '../../../lib/firebase/config';
import { getAuthErrorMessage } from './errors';
import { getUserByLogin, getUserByEmail } from '../../../lib/firebase/users';
import { ensureUserRoles } from '../../../features/users/utils/userUtils';
import type { User } from '../../../features/users/types';
import { ASSOCIATIONS } from '../../../constants/associations';
import { deleteUnauthorizedUser } from './deleteUnauthorizedUser';

/**
 * Connecte un utilisateur avec son login et son mot de passe
 * 
 * @param login - Le login de l'utilisateur
 * @param password - Le mot de passe de l'utilisateur
 * @returns Les données de l'utilisateur connecté
 */
// Fonction helper pour tenter une connexion silencieusement
const trySignInSilently = async (email: string, password: string): Promise<any> => {
  // Sauvegarder temporairement console.error
  const originalConsoleError = console.error;
  
  // Remplacer console.error pour filtrer les erreurs 400
  console.error = (...args: any[]) => {
    // Vérifier si c'est une erreur 400 de Firebase
    const errorString = args.join(' ');
    if (errorString.includes('400') && errorString.includes('signInWithPassword')) {
      // Ne pas afficher cette erreur
      return;
    }
    // Pour toutes les autres erreurs, les afficher normalement
    originalConsoleError.apply(console, args);
  };
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Restaurer console.error
    console.error = originalConsoleError;
    return result;
  } catch (error) {
    // Restaurer console.error
    console.error = originalConsoleError;
    throw error;
  }
};

export const signInUser = async (login: string, password: string): Promise<User> => {
  try {
    console.log('[Auth] Tentative de connexion avec login:', login);
    
    // Essayer d'abord avec l'association Rive Droite
    let userData = await getUserByLogin(login.toUpperCase(), ASSOCIATIONS.RIVE_DROITE);
    
    // Si l'utilisateur n'est pas trouvé dans Rive Droite, essayer avec Rive Gauche
    if (!userData) {
      console.log('[Auth] Utilisateur non trouvé dans Rive Droite, essai avec Rive Gauche');
      userData = await getUserByLogin(login.toUpperCase(), ASSOCIATIONS.RIVE_GAUCHE);
    }
    
    if (!userData) {
      console.error('[Auth] Aucun utilisateur trouvé avec le login:', login);
      throw new Error('Identifiants invalides');
    }
    
    console.log('[Auth] Utilisateur trouvé:', {
      login: userData.login,
      email: userData.email,
      association: userData.associationId
    });
    
    // Vérifier si on a déjà stocké le format du mot de passe pour cet utilisateur
    const storedPasswordFormat = localStorage.getItem(`pwdFormat_${userData.id}`);
    
    // Se connecter avec l'email et le mot de passe
    // Optimisation : déterminer l'ordre des tentatives selon le format stocké ou le format du mot de passe
    let passwordVariants: string[] = [];
    
    if (storedPasswordFormat === 'uppercase') {
      passwordVariants = [password.toUpperCase()];
    } else if (storedPasswordFormat === 'original') {
      passwordVariants = [password];
    } else {
      // Pas d'info stockée, essayer les deux
      passwordVariants = [password];
      if (password !== password.toUpperCase()) {
        passwordVariants.push(password.toUpperCase());
      }
    }
    
    let lastError: any = null;
    
    for (let i = 0; i < passwordVariants.length; i++) {
      try {
        // Utiliser la fonction silencieuse pour la première tentative
        const result = i === 0 && passwordVariants.length > 1 
          ? await trySignInSilently(userData.email, passwordVariants[i])
          : await signInWithEmailAndPassword(auth, userData.email, passwordVariants[i]);
          
        // Connexion réussie, sauvegarder le format pour les prochaines fois
        if (i === 0 && passwordVariants[i] === password) {
          localStorage.setItem(`pwdFormat_${userData.id}`, 'original');
          console.log('[Auth] Connexion réussie avec le mot de passe tel quel');
        } else if (passwordVariants[i] === password.toUpperCase()) {
          localStorage.setItem(`pwdFormat_${userData.id}`, 'uppercase');
          console.log('[Auth] Connexion réussie avec le mot de passe en majuscules (compatibilité)');
        }
        
        return ensureUserRoles(userData); // Succès, on retourne directement
      } catch (error: any) {
        lastError = error;
      }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    console.error('[Auth] Échec de connexion après toutes les tentatives');
    throw new Error('Identifiants invalides');
  } catch (error) {
    console.error('[Auth] Erreur globale de connexion:', error);
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
    // Essayer d'abord avec l'association Rive Droite
    let userData = await getUserByLogin(login.toUpperCase(), ASSOCIATIONS.RIVE_DROITE);
    
    // Si l'utilisateur n'est pas trouvé dans Rive Droite, essayer avec Rive Gauche
    if (!userData) {
      userData = await getUserByLogin(login.toUpperCase(), ASSOCIATIONS.RIVE_GAUCHE);
    }
    
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

/**
 * Connecte un utilisateur avec Google
 * 
 * @returns Les données de l'utilisateur connecté ou null si non autorisé
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    // Ouvrir la popup Google
    const result = await signInWithPopup(auth, googleProvider);
    const googleUser = result.user;
    
    if (!googleUser.email) {
      throw new Error('Impossible de récupérer l\'email depuis Google');
    }
    
    // Vérifier si l'utilisateur existe dans la base de données
    // Essayer d'abord avec l'association Rive Droite
    let userData = await getUserByEmail(googleUser.email, ASSOCIATIONS.RIVE_DROITE);
    
    // Si l'utilisateur n'est pas trouvé dans Rive Droite, essayer avec Rive Gauche
    if (!userData) {
      userData = await getUserByEmail(googleUser.email, ASSOCIATIONS.RIVE_GAUCHE);
    }
    
    if (!userData) {
      // L'utilisateur n'existe pas dans la base de données
      // On tente de supprimer le compte Firebase Auth créé automatiquement
      await deleteUnauthorizedUser(googleUser);
      
      // S'assurer que l'utilisateur est déconnecté
      await signOut(auth);
      
      // Logger la tentative pour le suivi
      console.warn('Tentative de connexion Google non autorisée:', {
        email: googleUser.email,
        displayName: googleUser.displayName,
        timestamp: createParisDate().toISOString()
      });
      
      throw new Error('Compte non autorisé. Veuillez contacter l\'administrateur pour obtenir l\'accès.');
    }
    
    // L'utilisateur existe, on retourne ses données
    return ensureUserRoles(userData);
  } catch (error: any) {
    console.error('Erreur lors de la connexion Google:', error);
    
    // Si c'est notre erreur custom, on la propage
    if (error instanceof Error && error.message.includes('Compte non autorisé')) {
      throw error;
    }
    
    // Gestion des erreurs spécifiques Firebase Auth
    if (error.code === 'auth/popup-blocked') {
      throw new Error('La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les popups pour ce site.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Vous avez fermé la fenêtre de connexion');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Erreur de connexion réseau. Veuillez vérifier votre connexion internet.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Ce domaine n\'est pas autorisé. Contactez l\'administrateur.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('La connexion Google n\'est pas activée. Contactez l\'administrateur.');
    }
    
    // Pour toute autre erreur
    throw new Error(`Erreur de connexion (${error.code || 'unknown'}): ${error.message || getAuthErrorMessage(error)}`);
  }
};

/**
 * Lie un compte Google à un utilisateur existant
 * 
 * @returns true si la liaison a réussi
 */
export const linkGoogleAccount = async (): Promise<boolean> => {
  try {
    if (!auth.currentUser) {
      throw new Error('Vous devez être connecté pour lier votre compte Google');
    }
    
    // Obtenir l'email de l'utilisateur actuel
    const currentEmail = auth.currentUser.email;
    
    // Lier avec Google en utilisant linkWithPopup
    const result = await linkWithPopup(auth.currentUser, googleProvider);
    
    // Vérifier que l'email Google correspond à l'email de l'utilisateur
    if (result.user.email !== currentEmail) {
      throw new Error('L\'email de votre compte Google doit correspondre à votre email enregistré');
    }
    
    return true;
  } catch (error: any) {
    console.error('Erreur lors de la liaison Google:', error);
    
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('Ce compte Google est déjà lié à un autre utilisateur');
    } else if (error.code === 'auth/provider-already-linked') {
      throw new Error('Votre compte est déjà lié à Google');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('La fenêtre de connexion a été fermée');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les popups pour ce site.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Erreur de connexion réseau. Veuillez vérifier votre connexion internet.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Ce domaine n\'est pas autorisé. Contactez l\'administrateur.');
    }
    
    // Pour toute autre erreur, on affiche le code d'erreur pour le debug
    throw new Error(`Erreur lors de la liaison du compte Google (${error.code || 'unknown'}): ${error.message || 'Erreur inconnue'}`);
  }
};
