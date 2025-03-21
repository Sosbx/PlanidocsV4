import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/users';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { deleteUser as deleteAuthUser, signInWithEmailAndPassword } from 'firebase/auth';
import { getUsers, updateUser, deleteUser } from '../lib/firebase/users';
import { createUser } from '../lib/firebase/auth/userCreation';

interface UserContextType {
  users: User[];
  loading: boolean;
  error: string | null;
  addUser: (userData: Omit<User, 'id' | 'hasValidatedPlanning'>) => Promise<void>;
  updateUser: (id: string, userData: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Écouter les changements dans la collection users
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const updatedUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));
        setUsers(updatedUsers);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error listening to users:', error);
        setError('Erreur lors du chargement des utilisateurs');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const contextValue: UserContextType = {
    users,
    loading,
    error,
    addUser: async (userData) => {
      setLoading(true);
      setError(null);
      try {
        const newUser = await createUser(userData);
        setUsers(prev => [...prev, newUser]);
      } catch (error: any) {
        console.error('Error adding user:', error);
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    updateUser: async (id, userData) => {
      setError(null);
      try {
        await updateUser(id, userData);
        setUsers(prev => prev.map(user => 
          user.id === id ? { ...user, ...userData } : user
        ));
      } catch (error: any) {
        console.error('Error updating user:', error);
        setError(error.message);
        throw error;
      }
    },
    deleteUser: async (id) => {
      setError(null);
      try {
        await deleteUser(id);
        setUsers(prev => prev.filter(user => user.id !== id));
      } catch (error: any) {
        console.error('Error deleting user:', error);
        setError(error.message);
        throw error;
      }
    },
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsers = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};