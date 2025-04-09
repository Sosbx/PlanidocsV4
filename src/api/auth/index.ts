/**
 * API d'authentification
 * Exporte toutes les fonctions liées à l'authentification
 */

// Importation des fonctions depuis Firebase
// Ces imports seront remplacés par les implémentations réelles lors de la migration
import { 
  signInUser, 
  signOutUser, 
  resetPassword
} from '../../lib/firebase/auth/session';

// Ré-export des fonctions avec des noms plus standards
export const signIn = signInUser;
export const signOut = signOutUser;
export { resetPassword };

// Cette fonction sera implémentée plus tard
export const getCurrentUser = () => {
  // Pour l'instant, on utilise l'objet auth.currentUser de Firebase
  // Plus tard, cette fonction sera implémentée correctement
  return null;
};

// Types
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: any;
  error?: string;
}
