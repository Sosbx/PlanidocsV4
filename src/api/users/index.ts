/**
 * API utilisateurs
 * Exporte toutes les fonctions liées à la gestion des utilisateurs
 */

// Importation des fonctions depuis Firebase
import { 
  getUserByLogin,
  getUserByEmail,
  getUsers,
  updateUser,
  deleteUser
} from '../../lib/firebase/users';

// Ré-export des fonctions pour maintenir la compatibilité
export {
  getUserByLogin,
  getUserByEmail,
  getUsers,
  updateUser,
  deleteUser
};

// Alias pour maintenir la compatibilité avec les anciens noms de fonctions
export const getUserById = async (id: string) => {
  // Cette fonction sera implémentée plus tard
  // Pour l'instant, elle retourne null
  return null;
};

export const getAllUsers = getUsers;
export const updateUserProfile = updateUser;
export const updateUserRole = updateUser;
export const updateUserStatus = updateUser;

// Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  login: string;
  role: 'admin' | 'user' | 'replacement';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

export interface UserUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'admin' | 'user' | 'replacement';
  status?: 'active' | 'inactive';
}
