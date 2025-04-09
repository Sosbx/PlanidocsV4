import { v4 as uuidv4 } from 'uuid';
import type { User, UserRoleFlags } from '../types';

const generateStrongPassword = (base: string): string => {
  const numbers = '123456789';
  const special = '!@#$%';
  return `${base.toUpperCase()}${numbers[Math.floor(Math.random() * numbers.length)]}${special[Math.floor(Math.random() * special.length)]}`;
};

export const generateBasicCredentials = (email: string): Omit<User, 'id' | 'hasValidatedPlanning' | 'roles'> => {
  const [firstName, lastName] = email.split('@')[0].split('.');
  
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  const login = lastName.slice(0, 4).toUpperCase();
  const basePassword = firstName.slice(0, 4);
  
  return {
    firstName: capitalizedFirstName,
    lastName: capitalizedLastName,
    email,
    login,
    password: generateStrongPassword(basePassword),
  };
};

// Fonction pour assurer la compatibilité avec l'ancien format de rôle
export const ensureUserRoles = (user: any): User => {
  if (!user) {
    console.error('ensureUserRoles: user is null or undefined');
    return user;
  }
  
  // Si l'utilisateur n'a pas de propriété roles, la créer à partir de la propriété role
  if (!user.roles) {
    // Convertir l'ancien format de rôle en nouveau format
    const roles: UserRoleFlags = {
      isAdmin: user.role === 'admin',
      isUser: user.role === 'user' || user.role === 'admin', // Les admins sont aussi des utilisateurs par défaut
      isManager: user.role === 'manager',
      isPartTime: false,
      isCAT: false
    };
    
    return {
      ...user,
      roles,
    };
  }
  
  // Si l'utilisateur a une propriété roles mais qu'elle n'a pas toutes les propriétés attendues
  const roles = user.roles;
  const updatedRoles: UserRoleFlags = {
    isAdmin: typeof roles.isAdmin === 'boolean' ? roles.isAdmin : user.role === 'admin',
    isUser: typeof roles.isUser === 'boolean' ? roles.isUser : user.role === 'user' || user.role === 'admin',
    isManager: typeof roles.isManager === 'boolean' ? roles.isManager : user.role === 'manager',
    isPartTime: typeof roles.isPartTime === 'boolean' ? roles.isPartTime : false,
    isCAT: typeof roles.isCAT === 'boolean' ? roles.isCAT : false
  };
  
  // Si les rôles ont été modifiés, retourner un nouvel objet
  if (JSON.stringify(roles) !== JSON.stringify(updatedRoles)) {
    return {
      ...user,
      roles: updatedRoles,
    };
  }
  
  // Sinon, retourner l'objet original
  return user;
};

export const getUserInitials = (user: { firstName: string; lastName: string }): string => {
  const firstInitial = user.firstName.charAt(0).toUpperCase();
  const lastInitial = user.lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
};
