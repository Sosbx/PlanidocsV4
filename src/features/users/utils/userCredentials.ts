import { z } from 'zod';
import { isSystemAdminEmail, ADMIN_EMAILS, db } from '../../../lib/firebase/config';
import { ASSOCIATIONS } from '../../../constants/associations';
import { collection, getDocs } from 'firebase/firestore';
import { getCollectionName } from '../../../lib/firebase/users';

const h24EmailSchema = z.string().email().refine(
  (email) => {
    // Vérifier si c'est un email admin du système (RD ou RG)
    if (isSystemAdminEmail(email)) {
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

// Fonction pour vérifier si un login existe déjà dans l'une des associations
async function checkLoginExists(login: string): Promise<boolean> {
  // Récupérer les utilisateurs de la rive droite
  const rdUsersCollection = getCollectionName('users', ASSOCIATIONS.RIVE_DROITE);
  const rdSnapshot = await getDocs(collection(db, rdUsersCollection));
  
  // Récupérer les utilisateurs de la rive gauche
  const rgUsersCollection = getCollectionName('users', ASSOCIATIONS.RIVE_GAUCHE);
  const rgSnapshot = await getDocs(collection(db, rgUsersCollection));
  
  // Vérifier si le login existe dans l'une des collections
  const rdExists = rdSnapshot.docs.some(doc => {
    const userData = doc.data();
    return userData.login === login;
  });
  
  const rgExists = rgSnapshot.docs.some(doc => {
    const userData = doc.data();
    return userData.login === login;
  });
  
  return rdExists || rgExists;
}

// Fonction pour générer un login unique
async function generateUniqueLogin(baseLogin: string): Promise<string> {
  let login = baseLogin;
  let counter = 2;
  
  // Vérifier si le login de base existe déjà
  let loginExists = await checkLoginExists(login);
  
  // Si le login existe, ajouter un numéro incrémental jusqu'à trouver un login unique
  while (loginExists) {
    login = `${baseLogin}${counter}`;
    loginExists = await checkLoginExists(login);
    counter++;
  }
  
  return login;
}

export const generateCredentials = async (data: { email: string } | ExternalUserData, associationId: string = ASSOCIATIONS.RIVE_DROITE) => {
  try {
    const isExternalUser = 'firstName' in data;
    const email = data.email.toLowerCase();

    // Cas des emails admin du système
    if (isSystemAdminEmail(email)) {
      // Déterminer s'il s'agit de l'admin RD ou RG
      const isRD = email === ADMIN_EMAILS.RD;
      const isRG = email === ADMIN_EMAILS.RG;
      
      // Générer le login de base
      const baseLogin = isRD ? 'SECR' : (isRG ? 'SCRG' : 'ADMI');
      // Générer un login unique
      const uniqueLogin = await generateUniqueLogin(baseLogin);
      
      return {
        email,
        firstName: 'Secrétariat',
        lastName: isRD ? 'RD' : (isRG ? 'RG' : 'Admin'),
        login: uniqueLogin,
        password: isRD ? 'SECR33' : (isRG ? 'SCRG33' : 'ADMI33'),
        associationId, // Ajouter l'associationId
        roles: {
          isAdmin: true,
          isUser: false,
          isManager: false,
          isPartTime: false,
          isCAT: false,
          isReplacement: false,
          isSuperAdmin: false
        }
      };
    }

    // Pour les utilisateurs externes
    if (isExternalUser) {
      const { firstName, lastName, email } = data;
      
      // Valider l'email avec le schema externe
      externalEmailSchema.parse(email);
      
      // Générer le login de base
      const baseLogin = lastName.slice(0, 4).toUpperCase();
      // Générer un login unique
      const uniqueLogin = await generateUniqueLogin(baseLogin);
      
      return {
        email: email.toLowerCase(),
        firstName,
        lastName,
        login: uniqueLogin,
        password: `${firstName.length < 4 
          ? (firstName + lastName.slice(0, 4 - firstName.length)).toUpperCase() 
          : firstName.slice(0, 4).toUpperCase()}33`,
        associationId, // Ajouter l'associationId
        roles: {
          isAdmin: false,
          isUser: true,
          isManager: false,
          isPartTime: false,
          isCAT: false,
          isReplacement: false,
          isSuperAdmin: false
        }
      };
    }

    // Pour les utilisateurs H24
    const validatedEmail = h24EmailSchema.parse(email);
    const [firstName, lastName] = validatedEmail
      .split('@')[0]
      .split('.');
    
    // Générer le login de base
    const baseLogin = lastName.slice(0, 4).toUpperCase();
    // Générer un login unique
    const uniqueLogin = await generateUniqueLogin(baseLogin);
    
    return {
      email: validatedEmail.toLowerCase(),
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
      lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
      login: uniqueLogin,
      password: `${firstName.length < 4 
        ? (firstName + lastName.slice(0, 4 - firstName.length)).toUpperCase() 
        : firstName.slice(0, 4).toUpperCase()}33`, // Même format de mot de passe
      associationId, // Ajouter l'associationId
      roles: {
        isAdmin: false,
        isUser: true,
        isManager: false,
        isPartTime: false,
        isCAT: false,
        isReplacement: false,
        isSuperAdmin: false
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    throw error;
  }
};
