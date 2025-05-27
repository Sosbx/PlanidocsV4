import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { userCreationAuth, db } from '../config';
import { getAuthErrorMessage } from './errors';
import type { User } from '../../../types/users';
import { getCollectionName } from '../users';
import { ASSOCIATIONS } from '../../../constants/associations';

export const createUser = async (userData: Omit<User, 'id' | 'hasValidatedPlanning'>, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<User> => {
  try {
    // S'assurer qu'aucun utilisateur n'est connecté sur l'instance de création
    await userCreationAuth.signOut();

    // Créer l'utilisateur avec l'instance séparée
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      userCreationAuth,
      userData.email,
      userData.password
    );

    const newUser: User = {
      ...userData,
      id: firebaseUser.uid,
      hasValidatedPlanning: false,
      associationId: associationId, // Assurer que l'associationId est définie
      roles: {
        isAdmin: userData.roles?.isAdmin || false,
        isUser: userData.roles?.isUser || true,
        isManager: userData.roles?.isManager || false,
        isPartTime: userData.roles?.isPartTime || false,
        isCAT: userData.roles?.isCAT || false,
        isReplacement: userData.roles?.isReplacement || false,
        isSuperAdmin: userData.roles?.isSuperAdmin || false
      }
    };

    // Déterminer la collection en fonction de l'association
    const collectionName = getCollectionName('users', associationId);
    console.log(`Création d'un utilisateur dans la collection ${collectionName}`);
    
    // Sauvegarder dans Firestore avec la bonne collection
    await setDoc(doc(db, collectionName, newUser.id), newUser);

    // Déconnecter l'utilisateur créé de l'instance de création
    await userCreationAuth.signOut();

    return newUser;
  } catch (error) {
    // Nettoyage en cas d'erreur
    if (userCreationAuth.currentUser) {
      try {
        await userCreationAuth.currentUser.delete();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      await userCreationAuth.signOut();
    }

    throw new Error(getAuthErrorMessage(error));
  }
};