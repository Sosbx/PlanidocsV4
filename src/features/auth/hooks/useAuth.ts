import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { signInUser, signOutUser, signInWithGoogle } from '../utils/session';
import { getUserByEmail } from '../../../lib/firebase/users';
import { ensureUserRoles } from '../../../features/users/utils/userUtils';
import type { User } from '../../../features/users/types';
import { ASSOCIATIONS } from '../../../constants/associations';

/**
 * Hook pour gérer l'authentification des utilisateurs
 * 
 * Fournit les fonctionnalités de connexion, déconnexion et accès aux données utilisateur
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Essayer d'abord avec l'association Rive Droite
          let userData = await getUserByEmail(firebaseUser.email!, ASSOCIATIONS.RIVE_DROITE);
          
          // Si l'utilisateur n'est pas trouvé dans Rive Droite, essayer avec Rive Gauche
          if (!userData) {
            userData = await getUserByEmail(firebaseUser.email!, ASSOCIATIONS.RIVE_GAUCHE);
          }
          
          if (userData) {
            // Assurer que l'utilisateur a la propriété roles correctement définie
            setUser(ensureUserRoles(userData));
            setError(null);
            console.log(`Utilisateur connecté depuis l'association: ${userData.associationId}`);
          } else {
            setUser(null);
            setError('Utilisateur non trouvé');
            console.error('Utilisateur authentifié mais non trouvé dans Firestore:', firebaseUser.email);
          }
        } else {
          setUser(null);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setUser(null);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const userData = await signInUser(email, password);
      setUser(userData);
      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await signOutUser();
      setUser(null);
      setError(null);
      navigate('/login');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const userData = await signInWithGoogle();
      setUser(userData);
      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, login, logout, loginWithGoogle };
};
