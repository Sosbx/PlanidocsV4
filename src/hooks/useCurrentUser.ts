import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '../features/users/types';
import { getCollectionName, COLLECTIONS } from '../utils/collectionUtils';
import { ASSOCIATIONS } from '../constants/associations';

/**
 * Hook to get the current authenticated user without circular dependencies
 * This hook tries to find the user in both RD and RG associations
 */
export const useCurrentUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Essayer d'abord avec l'association Rive Droite
          let userDocRef = doc(db, getCollectionName(COLLECTIONS.USERS, ASSOCIATIONS.RIVE_DROITE), firebaseUser.uid);
          let userDoc = await getDoc(userDocRef);
          
          let userData: User | null = null;
          
          if (userDoc.exists()) {
            userData = { id: userDoc.id, ...userDoc.data() } as User;
          } else {
            // Si l'utilisateur n'est pas trouvé dans Rive Droite, essayer avec Rive Gauche
            userDocRef = doc(db, getCollectionName(COLLECTIONS.USERS, ASSOCIATIONS.RIVE_GAUCHE), firebaseUser.uid);
            userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              userData = { id: userDoc.id, ...userDoc.data() } as User;
            }
          }
          
          setUser(userData);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
};