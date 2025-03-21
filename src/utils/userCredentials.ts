import { z } from 'zod';
import { SYSTEM_ADMIN_EMAIL } from '../lib/firebase/config';

const h24EmailSchema = z.string().email().refine(
  (email) => {
    // Vérifier si c'est l'email admin du système
    if (email === SYSTEM_ADMIN_EMAIL) {
      return true;
    }

    // Pour les autres emails, vérifier le format prenom.nom@h24scm.com
    const [localPart] = email.split('@');
    return email.endsWith('@h24scm.com') && 
           localPart.includes('.') &&
           localPart.split('.').length === 2;
  },
  { message: "L'email doit être au format prenom.nom@h24scm.com ou être l'email administrateur autorisé" }
);

const externalEmailSchema = z.string().email();

interface ExternalUserData {
  firstName: string;
  lastName: string;
  email: string;
}

export const generateCredentials = (data: { email: string } | ExternalUserData) => {
  try {
    const isExternalUser = 'firstName' in data;
    const email = data.email.toLowerCase();

    // Cas de l'email admin du système
    if (email === SYSTEM_ADMIN_EMAIL) {
      return {
        email,
        firstName: 'Secrétariat',
        lastName: 'RD',
        login: 'SECR',
        password: 'SECR33',
        roles: {
          isAdmin: true,
          isUser: false,
          isManager: false,
          isPartTime: false,
          isCAT: false
        }
      };
    }

    // Pour les utilisateurs externes
    if (isExternalUser) {
      const { firstName, lastName, email } = data;
      
      // Valider l'email avec le schema externe
      externalEmailSchema.parse(email);
      
      return {
        email: email.toLowerCase(),
        firstName,
        lastName,
        login: lastName.slice(0, 4).toUpperCase(),
        password: `${firstName.slice(0, 4).toUpperCase()}33`,
        roles: {
          isAdmin: false,
          isUser: true,
          isManager: false,
          isPartTime: false,
          isCAT: false
        }
      };
    }

    // Pour les utilisateurs H24
    const validatedEmail = h24EmailSchema.parse(email);
    const [firstName, lastName] = validatedEmail
      .split('@')[0]
      .split('.');
    
    return {
      email: validatedEmail.toLowerCase(),
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
      lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
      login: lastName.slice(0, 4).toUpperCase(),
      password: `${firstName.slice(0, 4).toUpperCase()}33`, // Même format de mot de passe
      roles: {
        isAdmin: false,
        isUser: true,
        isManager: false,
        isPartTime: false,
        isCAT: false
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    throw error;
  }
};