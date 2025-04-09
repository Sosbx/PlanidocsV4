import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import type { User } from '../types';

// Cache pour stocker les données utilisateur
const userCache = new Map<string, User>();

export const useCachedUserData = (userIds: string[]) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Filtrer les IDs déjà en cache
        const uncachedIds = userIds.filter(id => !userCache.has(id));

        if (uncachedIds.length > 0) {
          // Charger les données manquantes en parallèle
          const promises = uncachedIds.map(async (userId) => {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const userData = { id: docSnap.id, ...docSnap.data() } as User;
              userCache.set(userId, userData);
              return userData;
            }
            return null;
          });

          await Promise.all(promises);
        }

        // Récupérer toutes les données du cache
        const cachedUsers = userIds
          .map(id => userCache.get(id))
          .filter((user): user is User => user !== undefined);

        setUsers(cachedUsers);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [userIds]);

  return { users, loading };
};
