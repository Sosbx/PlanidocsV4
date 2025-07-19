import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { ExchangeHistory } from '../../../types/planning';
import { useAuth } from '../../../features/auth/hooks';
import { HistoryFilters } from '../types';
import { getCollectionName, COLLECTIONS } from '../../../utils/collectionUtils';
import { createParisDate, toParisTime } from '../../../utils/timezoneUtils';

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
        let q = query(
          collection(db, 'exchange_history'),
          where('associationId', '==', user.association),
          orderBy('executedAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        let data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ExchangeHistory[];

        // Filter by user if not showing all users
        if (!showAllUsers && !user.isAdmin) {
          data = data.filter(entry => 
            entry.participants.some(p => p.userId === user.uid)
          );
        }

        // Apply filters
        if (filters.startDate) {
          const startTime = toParisTime(filters.startDate);
          data = data.filter(entry => {
            const entryTime = entry.executedAt instanceof Timestamp 
              ? entry.executedAt.toMillis() 
              : 0;
            return entryTime >= startTime;
          });
        }

        if (filters.endDate) {
          const endTime = toParisTime(filters.endDate) + (24 * 60 * 60 * 1000 - 1); // End of day
          data = data.filter(entry => {
            const entryTime = entry.executedAt instanceof Timestamp 
              ? entry.executedAt.toMillis() 
              : 0;
            return entryTime <= endTime;
          });
        }

        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          data = data.filter(entry =>
            entry.participants.some(p =>
              p.userName.toLowerCase().includes(searchLower)
            ) ||
            entry.exchanges.some(e =>
              e.date.includes(filters.searchTerm) ||
              e.shiftType.toLowerCase().includes(searchLower)
            )
          );
        }

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