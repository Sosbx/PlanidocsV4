import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { userCreationAuth, db } from '../config';
import { getAuthErrorMessage } from './errors';
import type { User } from '../../../types/users';

export const createUser = async (userData: Omit<User, 'id' | 'hasValidatedPlanning'>): Promise<User> => {
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
      roles: {
        isAdmin: userData.roles?.isAdmin || false,
        isUser: userData.roles?.isUser || true
      }
    };

    // Sauvegarder dans Firestore
    await setDoc(doc(db, 'users', newUser.id), newUser);

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