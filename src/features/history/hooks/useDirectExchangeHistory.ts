import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, or, and, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { DirectExchange } from '../../directExchange/types';
import { useAuth } from '../../../features/auth/hooks';
import { HistoryFilters } from '../types';
import { getCollectionName, COLLECTIONS } from '../../../utils/collectionUtils';
import { createParisDate, toParisTime } from '../../../utils/timezoneUtils';

export const useDirectExchangeHistory = (filters: HistoryFilters, showAllUsers: boolean) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<DirectExchange[]>([]);
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
        let constraints = [];
        
        // Base query constraints
        const baseConstraints = [
          where('associationId', '==', user.association),
          where('status', '==', 'completed')
        ];
        
        // If not admin or not showing all users, filter by user
        if (!showAllUsers && !user.isAdmin) {
          constraints.push(
            and(
              ...baseConstraints,
              or(
                where('initiatorId', '==', user.uid),
                where('completedBy', '==', user.uid)
              )
            )
          );
        } else {
          constraints.push(and(...baseConstraints));
        }

        constraints.push(orderBy('completedAt', 'desc'));

        const q = query(collection(db, COLLECTIONS.DIRECT_EXCHANGES), ...constraints);
        const querySnapshot = await getDocs(q);
        
        let data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectExchange[];

        // Apply additional filters
        if (filters.startDate) {
          const startTime = toParisTime(filters.startDate);
          data = data.filter(entry => {
            const completedAt = entry.completedAt;
            if (!completedAt) return false;
            const entryTime = completedAt instanceof Timestamp 
              ? completedAt.toMillis() 
              : 0;
            return entryTime >= startTime;
          });
        }

        if (filters.endDate) {
          const endTime = toParisTime(filters.endDate) + (24 * 60 * 60 * 1000 - 1);
          data = data.filter(entry => {
            const completedAt = entry.completedAt;
            if (!completedAt) return false;
            const entryTime = completedAt instanceof Timestamp 
              ? completedAt.toMillis() 
              : 0;
            return entryTime <= endTime;
          });
        }

        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          data = data.filter(entry =>
            entry.initiatorName.toLowerCase().includes(searchLower) ||
            (entry.completedByName && entry.completedByName.toLowerCase().includes(searchLower)) ||
            entry.shiftDate.includes(filters.searchTerm) ||
            entry.shiftType.toLowerCase().includes(searchLower)
          );
        }

        if (filters.type) {
          data = data.filter(entry => entry.type === filters.type);
        }

        setHistory(data);
      } catch (err) {
        console.error('Error fetching direct exchange history:', err);
        setError('Erreur lors de la récupération de l\'historique des échanges directs');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, filters, showAllUsers]);

  return { history, loading, error };
};