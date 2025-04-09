import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { userCreationAuth, mainAuth, getAdminCredentials } from '../lib/firebase/auth/instances';
import { getAuthErrorMessage } from '../utils/errors/authErrors';

export const createAuthUser = async (email: string, password: string): Promise<string> => {
  try {
    // Utiliser l'instance séparée pour la création
    const { user } = await createUserWithEmailAndPassword(userCreationAuth, email, password);
    
    // Déconnecter immédiatement l'utilisateur créé
    await userCreationAuth.signOut();

    // Reconnecter l'admin si nécessaire
    const adminCreds = getAdminCredentials();
    if (adminCreds) {
      await signInWithEmailAndPassword(mainAuth, adminCreds.email, adminCreds.password);
    }

    return user.uid;
  } catch (error) {
    console.error('Error creating auth user:', error);
    throw new Error(getAuthErrorMessage(error));
  }
};