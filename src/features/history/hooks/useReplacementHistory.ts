import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, or, and, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { ReplacementHistory } from '../types';
import { useAuth } from '../../../features/auth/hooks';
import { HistoryFilters } from '../types';
import { DIRECT_EXCHANGE_COLLECTIONS } from '../../directExchange/types';
import { createParisDate, toParisTime } from '../../../utils/timezoneUtils';

export const useReplacementHistory = (filters: HistoryFilters, showAllUsers: boolean) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<ReplacementHistory[]>([]);
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
                where('userId', '==', user.uid),
                where('replacementUserId', '==', user.uid)
              )
            )
          );
        } else {
          constraints.push(and(...baseConstraints));
        }

        constraints.push(orderBy('completedAt', 'desc'));

        const q = query(collection(db, DIRECT_EXCHANGE_COLLECTIONS.DIRECT_REPLACEMENTS), ...constraints);
        const querySnapshot = await getDocs(q);
        
        let data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ReplacementHistory[];

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
            entry.date.includes(filters.searchTerm) ||
            entry.shiftType.toLowerCase().includes(searchLower) ||
            (entry.reason && entry.reason.toLowerCase().includes(searchLower))
          );
        }

        setHistory(data);
      } catch (err) {
        console.error('Error fetching replacement history:', err);
        setError('Erreur lors de la récupération de l\'historique des remplacements');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, filters, showAllUsers]);

  return { history, loading, error };
};