# Refactorisation des types User

Ce document explique la refactorisation effectuée pour résoudre les problèmes d'incompatibilité entre les types `User` des modules `auth` et `users`.

## Problème initial

Nous avions deux définitions différentes du type `User` :

1. Dans `src/features/auth/types.ts` :
   ```typescript
   export interface User {
     id: string;
     email: string;
     displayName: string;
     firstName?: string;
     lastName?: string;
     role: UserRole;
     status: UserStatus;
     photoURL?: string;
     // ...autres propriétés
   }
   ```

2. Dans `src/features/users/types.ts` :
   ```typescript
   export interface User {
     id: string;
     firstName: string;
     lastName: string;
     email: string;
     login: string;
     password: string;
     roles: UserRoleFlags;
     hasValidatedPlanning: boolean;
     fullName?: string;
   }
   ```

Ces deux définitions incompatibles créaient des dépendances circulaires et des problèmes de typage dans le code.

## Solution mise en place

### 1. Création d'un type de base commun

Nous avons créé un fichier `src/types/common.ts` qui contient les types communs partagés entre les modules :

```typescript
export interface BaseUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

export type UserRoleFlags = {
  isAdmin: boolean;
  isUser: boolean;
  isManager: boolean;
  isPartTime: boolean;
  isCAT: boolean;
};

// Fonctions utilitaires pour convertir entre les différents types
export function roleToFlags(role: UserRole): UserRoleFlags {
  return {
    isAdmin: role === UserRole.ADMIN,
    isManager: role === UserRole.MANAGER,
    isUser: role === UserRole.USER,
    isPartTime: false,
    isCAT: false
  };
}

export function flagsToRole(flags: UserRoleFlags): UserRole {
  if (flags.isAdmin) return UserRole.ADMIN;
  if (flags.isManager) return UserRole.MANAGER;
  return UserRole.USER;
}
```

### 2. Refactorisation du module auth

Dans `src/features/auth/types.ts`, nous avons remplacé l'interface `User` par une interface `AuthUser` qui étend `BaseUser` :

```typescript
export interface AuthUser extends BaseUser {
  displayName: string;
  role: UserRole;
  status: UserStatus;
  photoURL?: string;
  // ...autres propriétés
}

// Pour la compatibilité avec le code existant
export type User = AuthUser;

// Ré-exporter les enums pour la compatibilité avec le code existant
export { UserRole, UserStatus } from '../../types/common';
```

### 3. Refactorisation du module users

Dans `src/features/users/types.ts`, nous avons remplacé l'interface `User` par une interface `ManagementUser` qui étend `BaseUser` :

```typescript
export interface ManagementUser extends BaseUser {
  firstName: string; // Requis dans ce contexte
  lastName: string;  // Requis dans ce contexte
  login: string;
  password: string;
  roles: UserRoleFlags;
  hasValidatedPlanning: boolean;
  fullName?: string;
}

// Pour la compatibilité avec le code existant
export type User = ManagementUser;

// Définir une interface locale qui étend l'interface commune
export interface UserRoleFlags extends CommonUserRoleFlags {}
```

### 4. Adaptateurs pour la conversion entre les types

Nous avons ajouté des fonctions adaptateurs pour convertir entre les différents types d'utilisateurs :

```typescript
// Dans src/features/auth/types.ts
export const toBaseUser = (user: AuthUser): BaseUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName
});

export const fromBaseUser = (baseUser: BaseUser, additionalData: Omit<AuthUser, keyof BaseUser>): AuthUser => ({
  ...baseUser,
  ...additionalData
});

// Dans src/features/users/types.ts
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
```

## Avantages de cette refactorisation

1. **Élimination des dépendances circulaires** : Les modules `auth` et `users` dépendent maintenant d'un module commun `types/common` plutôt que l'un de l'autre.
2. **Clarification des types** : Chaque module a maintenant un type d'utilisateur spécifique à son contexte (`AuthUser` et `ManagementUser`).
3. **Compatibilité avec le code existant** : Les types `User` sont toujours disponibles dans chaque module pour maintenir la compatibilité avec le code existant.
4. **Facilité de conversion** : Les fonctions adaptateurs permettent de convertir facilement entre les différents types d'utilisateurs.
5. **Extensibilité** : Il est maintenant plus facile d'ajouter de nouvelles propriétés à chaque type d'utilisateur sans affecter les autres modules.

## Prochaines étapes possibles

1. Mettre à jour progressivement le code pour utiliser les nouveaux types spécifiques (`AuthUser` et `ManagementUser`) plutôt que le type générique `User`.
2. Ajouter des fonctions utilitaires pour convertir entre `AuthUser` et `ManagementUser` si nécessaire.
3. Étendre le type `BaseUser` avec d'autres propriétés communes si elles sont identifiées.
