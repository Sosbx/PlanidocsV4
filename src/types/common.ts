import { Timestamp } from 'firebase/firestore';

/**
 * Types communs partagés entre les modules auth et users
 */

/**
 * Rôles utilisateur
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user'
}

/**
 * Statut utilisateur
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

/**
 * Interface de base pour un utilisateur
 * Contient les propriétés communes à tous les types d'utilisateurs
 */
export interface BaseUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Type pour les rôles utilisateur (flags)
 */
export type UserRoleFlags = {
  isAdmin: boolean;
  isUser: boolean;
  isManager: boolean;
  isPartTime: boolean;  // mi-temps
  isCAT: boolean;       // CAT
};

/**
 * Utilitaires de conversion entre les différents types d'utilisateurs
 */

/**
 * Convertit un UserRole en UserRoleFlags
 */
export function roleToFlags(role: UserRole): UserRoleFlags {
  return {
    isAdmin: role === UserRole.ADMIN,
    isManager: role === UserRole.MANAGER,
    isUser: role === UserRole.USER,
    isPartTime: false,
    isCAT: false
  };
}

/**
 * Convertit un UserRoleFlags en UserRole
 */
export function flagsToRole(flags: UserRoleFlags): UserRole {
  if (flags.isAdmin) return UserRole.ADMIN;
  if (flags.isManager) return UserRole.MANAGER;
  return UserRole.USER;
}
