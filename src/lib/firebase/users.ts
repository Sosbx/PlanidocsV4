import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { 
  deleteUser as deleteAuthUser, 
  signInWithEmailAndPassword, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  AuthError
} from 'firebase/auth';
import { db, userCreationAuth, auth, isSystemAdminEmail } from './config';
import { getDesiderata } from './desiderata';
// import { getAuthErrorMessage } from './auth/errors';
import { ensureUserRoles } from '../../features/users/utils/userUtils';
import type { User } from '../../features/users/types';
import { ASSOCIATIONS } from '../../constants/associations';
import { getCollectionName, COLLECTIONS } from '../../utils/collectionUtils';

const USERS_COLLECTION = COLLECTIONS.USERS;

export const getUserByEmail = async (email: string, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<User | null> => {
  try {
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    const q = query(collection(db, collectionName), where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const userData = {
      id: doc.id,
      ...doc.data()
    } as User;
    
    // Assurer que l'utilisateur a la propriété roles correctement définie
    return ensureUserRoles(userData);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw new Error('Erreur lors du chargement des données utilisateur');
  }
};

export const getUserByLogin = async (login: string, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<User | null> => {
  try {
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    const q = query(collection(db, collectionName), where("login", "==", login.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const userData = {
      id: doc.id,
      ...doc.data()
    } as User;
    
    // Assurer que l'utilisateur a la propriété roles correctement définie
    return ensureUserRoles(userData);
  } catch (error) {
    console.error('Error fetching user by login:', error);
    throw new Error('Erreur lors du chargement des données utilisateur');
  }
};

export const getUsers = async (associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<User[]> => {
  try {
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => {
      const userData = {
        id: doc.id,
        ...doc.data()
      } as User;
      
      // Assurer que l'utilisateur a la propriété roles correctement définie
      return ensureUserRoles(userData);
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Erreur lors du chargement des utilisateurs');
  }
};

export const updateUser = async (id: string, userData: Partial<User>, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<void> => {
  try {
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    const currentUser = auth.currentUser;
    const userDoc = await getDoc(doc(db, collectionName, id));
    const currentUserData = userDoc.data() as User;

    // Si le mot de passe est modifié et que l'utilisateur est connecté
    if (userData.password && 
        currentUser && 
        currentUser.email === currentUserData.email && 
        userData.password !== currentUserData.password) {
      try {
        // Réauthentifier l'utilisateur avec l'ancien mot de passe
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentUserData.password
        );
        await reauthenticateWithCredential(currentUser, credential);

        // Mettre à jour le mot de passe dans Firebase Auth
        await updatePassword(currentUser, userData.password);
      } catch (error) {
        console.error('Error updating password in Firebase Auth:', error);
        throw new Error('Erreur lors de la mise à jour du mot de passe. Veuillez vous reconnecter et réessayer.');
      }
    }

    // Mettre à jour les données dans Firestore
    await updateDoc(doc(db, collectionName, id), userData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error instanceof Error ? error : new Error('Erreur lors de la mise à jour de l\'utilisateur');
  }
};

export const deleteUser = async (id: string, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<void> => {
  // S'assurer qu'aucun utilisateur n'est connecté sur l'instance de création
  try {
    await userCreationAuth.signOut();
  } catch (error) {
    console.error('Error signing out before deletion:', error);
  }

  try {
    // 1. Récupérer les données de l'utilisateur
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    const userDoc = await getDoc(doc(db, collectionName, id));
    if (!userDoc.exists()) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data() as User;

    // Vérifier si c'est un admin système (RD ou RG)
    if (isSystemAdminEmail(userData.email)) {
      throw new Error('Impossible de supprimer l\'administrateur système');
    }

    // 2. Se connecter avec les identifiants de l'utilisateur
    try {
      await signInWithEmailAndPassword(userCreationAuth, userData.email, userData.password);
    } catch (error) {
      const authError = error as AuthError;
      console.error('Error signing in as user:', {
        code: authError.code,
        message: authError.message,
        email: userData.email
      });
      throw new Error('Erreur d\'authentification lors de la suppression');
    }

    // 3. Supprimer le compte Firebase Auth
    if (userCreationAuth.currentUser) {
      try {
        await deleteAuthUser(userCreationAuth.currentUser);
      } catch (error) {
        const authError = error as AuthError;
        console.error('Error deleting auth user:', {
          code: authError.code,
          message: authError.message,
          userId: id
        });
        throw new Error('Erreur lors de la suppression du compte d\'authentification');
      }
    }

    // 4. Supprimer les desiderata de l'utilisateur
    try {
      const desiderataCollection = getCollectionName(COLLECTIONS.DESIDERATA, associationId);
      const desiderata = await getDesiderata(id, associationId);
      if (desiderata) {
        await deleteDoc(doc(db, desiderataCollection, id));
      }
    } catch (error) {
      console.error('Error deleting desiderata:', {
        error,
        userId: id
      });
      // Continue with deletion even if desiderata deletion fails
    }

    // 5. Supprimer l'utilisateur de Firestore
    await deleteDoc(doc(db, collectionName, id));

  } catch (error) {
    console.error('Error deleting user:', {
      error,
      userId: id,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error instanceof Error ? error : new Error('Erreur lors de la suppression de l\'utilisateur');
  } finally {
    // 6. Toujours se déconnecter à la fin
    try {
      await userCreationAuth.signOut();
    } catch (signOutError) {
      console.error('Error signing out after deletion:', signOutError);
    }
  }
};

/**
 * Crée un nouvel utilisateur dans Firestore
 * @param userData Données de l'utilisateur à créer
 * @param associationId Identifiant de l'association (RD ou RG)
 * @returns L'utilisateur créé
 */
export const createUser = async (userData: Omit<User, 'id'>, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<User> => {
  try {
    const collectionName = getCollectionName(USERS_COLLECTION, associationId);
    
    // Vérifier si l'email existe déjà
    const existingUser = await getUserByEmail(userData.email, associationId);
    if (existingUser) {
      throw new Error(`Un utilisateur avec l'email ${userData.email} existe déjà`);
    }
    
    // Vérifier si le login existe déjà
    const existingLogin = await getUserByLogin(userData.login, associationId);
    if (existingLogin) {
      throw new Error(`Un utilisateur avec l'identifiant ${userData.login} existe déjà`);
    }
    
    // Créer un nouveau document avec un ID généré automatiquement
    const newUserRef = doc(collection(db, collectionName));
    
    // Ajouter l'ID de l'association aux données utilisateur
    const userWithAssociation = {
      ...userData,
      associationId,
      id: newUserRef.id
    };
    
    // Enregistrer dans Firestore
    await setDoc(newUserRef, userWithAssociation);
    
    return userWithAssociation as User;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error instanceof Error ? error : new Error('Erreur lors de la création de l\'utilisateur');
  }
};
