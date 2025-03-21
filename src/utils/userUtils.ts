import { v4 as uuidv4 } from 'uuid';
import type { User, UserRole } from '../types/users';

const generateStrongPassword = (base: string): string => {
  const numbers = '123456789';
  const special = '!@#$%';
  return `${base.toUpperCase()}${numbers[Math.floor(Math.random() * numbers.length)]}${special[Math.floor(Math.random() * special.length)]}`;
};

export const generateCredentials = (email: string): Omit<User, 'id' | 'hasValidatedPlanning' | 'roles'> => {
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
  if (!user.roles) {
    // Convertir l'ancien format de rôle en nouveau format
    const roles: UserRole = {
      isAdmin: user.role === 'admin',
      isUser: user.role === 'user' || user.role === 'admin', // Les admins sont aussi des utilisateurs par défaut
      isPartTime: false,
      isCAT: false
    };
    
    return {
      ...user,
      roles,
    };
  }
  return user;
};

export const getUserInitials = (user: { firstName: string; lastName: string }): string => {
  const firstInitial = user.firstName.charAt(0).toUpperCase();
  const lastInitial = user.lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
};