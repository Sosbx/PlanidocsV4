import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { ExchangeHistory } from '../../../types/planning';
import { useAuth } from '../../../features/auth/hooks';
import { HistoryFilters } from '../types';
import { getCollectionName, COLLECTIONS } from '../../../utils/collectionUtils';
import { createParisDate, toParisTime, firebaseTimestampToParisDate } from '../../../utils/timezoneUtils';

export const useBagHistory = (filters: HistoryFilters, showAllUsers: boolean) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<ExchangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || !user.association) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Récupérer TOUS les documents sans filtre initial
        // On filtrera après transformation pour ne manquer aucun document
        console.log('Récupération de tous les documents exchange_history...');
        
        let q;
        try {
          // Essayer d'abord avec orderBy executedAt (nouveau format)
          q = query(
            collection(db, 'exchange_history'),
            orderBy('executedAt', 'desc')
          );
          await getDocs(q);
        } catch (error) {
          console.log('Pas d\'index sur executedAt, essai avec exchangedAt...');
          // Si pas d'index sur executedAt, essayer avec exchangedAt (ancien format)
          try {
            q = query(
              collection(db, 'exchange_history'),
              orderBy('exchangedAt', 'desc')
            );
          } catch (error2) {
            console.log('Pas d\'index sur exchangedAt, récupération sans tri...');
            // Si aucun index, récupérer sans tri
            q = query(collection(db, 'exchange_history'));
          }
        }
        
        const querySnapshot = await getDocs(q);
        const rawData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log(`Nombre total de documents récupérés: ${rawData.length}`);

        // Transformer les données au format attendu
        const transformedData = await Promise.all(rawData.map(async (entry: any) => {
          // Si c'est déjà au nouveau format, le retourner tel quel
          if (entry.participants && entry.exchanges && entry.executedAt) {
            return entry;
          }

          // Transformer l'ancien format au nouveau
          try {
            // Vérifier que les IDs utilisateurs existent
            if (!entry.originalUserId || !entry.newUserId) {
              console.warn('Document avec utilisateurs manquants:', entry);
              return null;
            }
            
            // Récupérer les noms d'utilisateurs
            const [originalUserDoc, newUserDoc] = await Promise.all([
              getDoc(doc(db, 'users', entry.originalUserId)),
              getDoc(doc(db, 'users', entry.newUserId))
            ]);

            const originalUserName = originalUserDoc.exists() 
              ? `${originalUserDoc.data()?.firstName || ''} ${originalUserDoc.data()?.lastName || ''}`.trim() || 'Utilisateur inconnu'
              : 'Utilisateur inconnu';
            
            const newUserName = newUserDoc.exists()
              ? `${newUserDoc.data()?.firstName || ''} ${newUserDoc.data()?.lastName || ''}`.trim() || 'Utilisateur inconnu'
              : 'Utilisateur inconnu';

            // Créer la structure attendue
            const transformed = {
              id: entry.id,
              participants: [
                { userId: entry.originalUserId, userName: originalUserName },
                { userId: entry.newUserId, userName: newUserName }
              ],
              exchanges: entry.isPermutation ? [
                {
                  date: entry.date,
                  shiftType: entry.originalShiftType,
                  period: entry.period,
                  timeSlot: entry.timeSlot,
                  previousAssignment: { userId: entry.originalUserId },
                  newAssignment: { userId: entry.newUserId }
                },
                {
                  date: entry.date,
                  shiftType: entry.newShiftType || entry.shiftType,
                  period: entry.period,
                  timeSlot: entry.timeSlot,
                  previousAssignment: { userId: entry.newUserId },
                  newAssignment: { userId: entry.originalUserId }
                }
              ] : [
                {
                  date: entry.date,
                  shiftType: entry.shiftType,
                  period: entry.period,
                  timeSlot: entry.timeSlot,
                  previousAssignment: { userId: entry.originalUserId },
                  newAssignment: { userId: entry.newUserId }
                }
              ],
              executedAt: entry.exchangedAt ? 
                (typeof entry.exchangedAt === 'string' ? 
                  Timestamp.fromDate(new Date(entry.exchangedAt)) : 
                  entry.exchangedAt) : 
                Timestamp.now(),
              cycleInfo: entry.cycleInfo || null,
              associationId: user.association
            };

            return transformed;
          } catch (error) {
            console.error('Error transforming exchange history entry:', error, entry);
            // En cas d'erreur, retourner null pour filtrer plus tard
            return null;
          }
        }));

        // Filtrer les entrées null
        let data = transformedData.filter(entry => entry !== null) as any[];
        
        console.log(`Documents après transformation: ${data.length}`);
        
        // Filtrer par association si l'utilisateur n'est pas admin
        // Pour les admins, on montre tout
        if (!user.isAdmin && user.association) {
          const beforeFilter = data.length;
          data = data.filter(entry => {
            // Si le document a un associationId, il doit correspondre
            if (entry.associationId) {
              return entry.associationId === user.association;
            }
            // Si pas d'associationId, on vérifie si les utilisateurs sont de la même association
            // Pour l'instant on les inclut tous pour ne rien manquer
            return true;
          });
          console.log(`Documents après filtre association (${user.association}): ${data.length} (filtré ${beforeFilter - data.length})`);
        }

        // Filter by user if not showing all users
        if (!showAllUsers && !user.isAdmin) {
          data = data.filter(entry => 
            entry.participants.some((p: any) => p.userId === user.id)
          );
        }

        // Apply filters
        if (filters.startDate) {
          const startTime = toParisTime(filters.startDate);
          data = data.filter(entry => {
            const entryTime = entry.executedAt instanceof Timestamp 
              ? entry.executedAt.toMillis() 
              : (typeof entry.executedAt === 'string' ? new Date(entry.executedAt).getTime() : 0);
            return entryTime >= startTime;
          });
        }

        if (filters.endDate) {
          const endTime = toParisTime(filters.endDate) + (24 * 60 * 60 * 1000 - 1); // End of day
          data = data.filter(entry => {
            const entryTime = entry.executedAt instanceof Timestamp 
              ? entry.executedAt.toMillis() 
              : (typeof entry.executedAt === 'string' ? new Date(entry.executedAt).getTime() : 0);
            return entryTime <= endTime;
          });
        }

        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          data = data.filter(entry =>
            entry.participants.some((p: any) =>
              p.userName.toLowerCase().includes(searchLower)
            ) ||
            entry.exchanges.some((e: any) =>
              e.date.includes(filters.searchTerm) ||
              e.shiftType.toLowerCase().includes(searchLower)
            )
          );
        }

        // Trier les données par date si pas déjà trié
        data.sort((a, b) => {
          const dateA = a.executedAt instanceof Timestamp 
            ? a.executedAt.toMillis() 
            : (typeof a.executedAt === 'string' ? new Date(a.executedAt).getTime() : 0);
          const dateB = b.executedAt instanceof Timestamp 
            ? b.executedAt.toMillis() 
            : (typeof b.executedAt === 'string' ? new Date(b.executedAt).getTime() : 0);
          return dateB - dateA; // Tri décroissant (plus récent en premier)
        });
        
        console.log(`Nombre final d'échanges à afficher: ${data.length}`);
        setHistory(data);
      } catch (err) {
        console.error('Error fetching BaG history:', err);
        setError('Erreur lors de la récupération de l\'historique');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, filters, showAllUsers]);

  return { history, loading, error };
};