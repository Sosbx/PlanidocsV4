import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { signInUser, signOutUser } from '../utils/session';
import { getUserByEmail } from '../../../lib/firebase/users';
import { ensureUserRoles } from '../../../features/users/utils/userUtils';
import type { User } from '../../../features/users/types';

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
          const userData = await getUserByEmail(firebaseUser.email!);
          if (userData) {
            // Assurer que l'utilisateur a la propriété roles correctement définie
            setUser(ensureUserRoles(userData));
            setError(null);
          } else {
            setUser(null);
            setError('Utilisateur non trouvé');
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, login, logout };
};
