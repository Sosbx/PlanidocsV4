import { Timestamp } from 'firebase/firestore';
import { BaseUser, UserRole, UserStatus, UserRoleFlags as CommonUserRoleFlags } from '../../types/common';

// Définir une interface locale qui étend l'interface commune
export interface UserRoleFlags extends CommonUserRoleFlags {}

/**
 * Interface pour un utilisateur de gestion
 * Étend BaseUser avec des propriétés spécifiques à la gestion des utilisateurs
 */
export interface ManagementUser extends BaseUser {
  firstName: string; // Requis dans ce contexte
  lastName: string;  // Requis dans ce contexte
  login: string;
  password: string;
  roles: UserRoleFlags;
  hasValidatedPlanning: boolean;
  
  /** Full name (optional to maintain backward compatibility) */
  fullName?: string;
  
  // Champs RGPD
  hasAcceptedTerms?: boolean;
  termsAcceptedAt?: Timestamp;
  termsVersion?: string;
  privacyAcceptedAt?: Timestamp;
  privacyVersion?: string;
}

/**
 * Adaptateurs pour convertir entre ManagementUser et BaseUser
 */
export const toBaseUser = (user: ManagementUser): BaseUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName
});

export const fromBaseUser = (baseUser: BaseUser, additionalData: Omit<ManagementUser, keyof BaseUser>): ManagementUser => ({
  ...baseUser,
  firstName: baseUser.firstName || '',  // Conversion car firstName est requis dans ManagementUser
  lastName: baseUser.lastName || '',    // Conversion car lastName est requis dans ManagementUser
  ...additionalData
});

// Pour la compatibilité avec le code existant
export type User = ManagementUser;

/**
 * Types pour la fonctionnalité de gestion des utilisateurs
 */

/**
 * Interface pour un utilisateur étendu
 */
export interface UserExtended {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: UserStatus;
  photoURL?: string;
  phoneNumber?: string;
  department?: string;
  position?: string;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
  metadata?: Record<string, any>;
  preferences?: UserPreferences;
  statistics?: UserStatistics;
  // Champs RGPD
  hasAcceptedTerms?: boolean;
  termsAcceptedAt?: Timestamp;
  termsVersion?: string;
  privacyAcceptedAt?: Timestamp;
  privacyVersion?: string;
}

/**
 * Interface pour les préférences utilisateur
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  displayOptions?: {
    compactView?: boolean;
    showWeekends?: boolean;
    defaultPeriodView?: 'day' | 'week' | 'month';
  };
}

/**
 * Interface pour les statistiques utilisateur
 */
export interface UserStatistics {
  totalShifts?: number;
  totalExchanges?: number;
  totalCessions?: number;
  totalReplacements?: number;
  lastActivity?: Timestamp;
}

/**
 * Interface pour les filtres de recherche d'utilisateurs
 */
export interface UserFilters {
  query?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  sortBy?: 'name' | 'role' | 'department' | 'lastLogin';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  page?: number;
}

/**
 * Interface pour les résultats de recherche d'utilisateurs
 */
export interface UserSearchResult {
  users: UserExtended[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
