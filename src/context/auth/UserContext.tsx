import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, Profiler } from 'react';
import { performanceProfiler } from '../../utils/performanceProfiler';
import type { User } from '../../features/users/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { updateUser, deleteUser, createUser as createUserInFirestore } from '../../lib/firebase/users';
import { getCollectionName } from '../../utils/collectionUtils';
import { useAssociation } from '../association/AssociationContext';
import { useAuth } from '../../features/auth/hooks';

/**
 * Type pour le contexte utilisateur
 */
interface UserContextType {
  users: User[];
  loading: boolean;
  error: string | null;
  addUser: (userData: Omit<User, 'id' | 'hasValidatedPlanning'>) => Promise<void>;
  updateUser: (id: string, userData: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Provider pour le contexte utilisateur
 * Gère la liste des utilisateurs et les opérations CRUD
 */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentAssociation } = useAssociation();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    // Fonction pour charger les utilisateurs d'une association spécifique
    const loadUsersForAssociation = (associationId: string) => {
      // console.log(`UserContext: Chargement des utilisateurs pour l'association ${associationId}`); // Removed for performance

      // Obtenir le nom de la collection en fonction de l'association
      const usersCollection = getCollectionName('users', associationId);
      // console.log(`UserContext: Utilisation de la collection ${usersCollection}`); // Removed for performance

      // Pour Rive Droite, nous devons inclure les utilisateurs sans associationId
      if (associationId === 'RD') {
        // Écouter les changements dans la collection users (Rive Droite)
        // Inclure les utilisateurs avec associationId=RD OU sans associationId
        return onSnapshot(
          collection(db, usersCollection),
          (snapshot) => {
            const updatedUsers = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              } as User))
              // Filtrer pour inclure les utilisateurs avec associationId=RD OU sans associationId
              .filter(user => !user.associationId || user.associationId === 'RD');
            
            // console.log(`UserContext: ${updatedUsers.length} utilisateurs chargés pour l'association ${associationId}`); // Removed for performance
            setUsers(updatedUsers);
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error(`Error listening to users for association ${associationId}:`, error);
            setError('Erreur lors du chargement des utilisateurs');
            setLoading(false);
          }
        );
      } else {
        // Pour les autres associations (comme RG), filtrer strictement par associationId
        return onSnapshot(
          query(collection(db, usersCollection), where("associationId", "==", associationId)),
          (snapshot) => {
            const updatedUsers = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User));
            // console.log(`UserContext: ${updatedUsers.length} utilisateurs chargés pour l'association ${associationId}`); // Removed for performance
            setUsers(updatedUsers);
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error(`Error listening to users for association ${associationId}:`, error);
            setError('Erreur lors du chargement des utilisateurs');
            setLoading(false);
          }
        );
      }
    };

    // Par défaut, charger les utilisateurs de Rive Droite
    let unsubscribe = loadUsersForAssociation('RD');

    // Si l'utilisateur est connecté, charger les utilisateurs de son association
    if (currentUser && currentUser.associationId) {
      // Annuler l'abonnement précédent
      unsubscribe();
      // Charger les utilisateurs de l'association de l'utilisateur connecté
      unsubscribe = loadUsersForAssociation(currentUser.associationId);
    }

    return () => unsubscribe();
  }, [currentUser, currentAssociation]);

  // Mémoïser les fonctions pour éviter les re-renders
  const addUser = useCallback(async (userData: Omit<User, 'id' | 'hasValidatedPlanning'>) => {
      // Déterminer l'association à utiliser
      const associationId = currentUser?.associationId || 'RD';

      setLoading(true);
      setError(null);
      try {
        // Ajouter l'associationId et hasValidatedPlanning aux données utilisateur
        const userDataWithAssociation = {
          ...userData,
          associationId: associationId,
          hasValidatedPlanning: false
        };

        // Créer l'utilisateur dans Firestore avec la bonne association
        const newUser = await createUserInFirestore(userDataWithAssociation, associationId);
        setUsers(prev => [...prev, newUser]);
      } catch (error: any) {
        console.error('Error adding user:', error);
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
  }, [currentUser]);

  const updateUserCallback = useCallback(async (id: string, userData: Partial<User>) => {
      // Déterminer l'association à utiliser
      const associationId = currentUser?.associationId || 'RD';

      setError(null);
      try {
        // Mettre à jour l'utilisateur dans Firestore avec la bonne association
        await updateUser(id, userData, associationId);
        setUsers(prev => prev.map(user => 
          user.id === id ? { ...user, ...userData } : user
        ));
      } catch (error: any) {
        console.error('Error updating user:', error);
        setError(error.message);
        throw error;
      }
  }, [currentUser]);

  const deleteUserCallback = useCallback(async (id: string) => {
      // Déterminer l'association à utiliser
      const associationId = currentUser?.associationId || 'RD';

      setError(null);
      try {
        // Supprimer l'utilisateur dans Firestore avec la bonne association
        await deleteUser(id, associationId);
        setUsers(prev => prev.filter(user => user.id !== id));
      } catch (error: any) {
        console.error('Error deleting user:', error);
        setError(error.message);
        throw error;
      }
  }, [currentUser]);

  // Mémoïser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue: UserContextType = useMemo(() => ({
    users,
    loading,
    error,
    addUser,
    updateUser: updateUserCallback,
    deleteUser: deleteUserCallback
  }), [users, loading, error, addUser, updateUserCallback, deleteUserCallback]);

  // Optimisation : ne re-rendre que si nécessaire
  return (
    <Profiler id="UserProvider" onRender={performanceProfiler.onRender}>
      <UserContext.Provider value={contextValue}>
        {children}
      </UserContext.Provider>
    </Profiler>
  );
};

/**
 * Hook pour accéder au contexte utilisateur
 */
export const useUsers = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};
