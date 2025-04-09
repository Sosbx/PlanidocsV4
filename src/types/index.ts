/**
 * Re-export all types to simplify imports
 */

// Re-export planning types
export * from './planning';

// Re-export exchange types
export * from './exchange';

/**
 * Base user interface with common properties
 * This is a transitional type to handle the different user types
 */
export interface BaseUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Type guards to safely handle different user types
export function isAuthUser(user: BaseUser): user is import('../features/auth/types').User {
  return 'role' in user && 'status' in user;
}

export function isAppUser(user: BaseUser): user is import('../features/users/types').User {
  return 'roles' in user && 'hasValidatedPlanning' in user;
}

export function isExtendedUser(user: BaseUser): user is import('../features/users/types').UserExtended {
  return 'role' in user && 'status' in user && 'preferences' in user;
}