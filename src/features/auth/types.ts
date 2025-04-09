/**
 * @deprecated Ce fichier est conservé pour la compatibilité avec l'ancien code.
 * Utilisez les types depuis 'src/features/users/types.ts' à la place.
 */

// Ré-exporter les enums pour la compatibilité avec le code existant
export { UserRole, UserStatus } from '../../types/common';

// Réexporter les types depuis le nouvel emplacement
export * from '../users/types';

/**
 * Interface pour les informations d'authentification
 */
export interface AuthInfo {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: import('../users/types').User | null;
  error: Error | null;
}

/**
 * Interface pour les informations de connexion
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Interface pour les informations d'inscription
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department?: string;
  position?: string;
}
