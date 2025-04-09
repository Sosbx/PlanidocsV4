import { useContext } from 'react';
import { UserContext } from '../../../context/auth/UserContext';

/**
 * Hook pour accéder au contexte utilisateur
 * Ce hook est une implémentation propre pour l'architecture Feature-First
 */
export const useUsers = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};
