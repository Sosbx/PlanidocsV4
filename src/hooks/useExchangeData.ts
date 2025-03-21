import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { format } from 'date-fns';
import type { ShiftExchange, GeneratedPlanning } from '../types/planning';

export const useExchangeData = () => {
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExchanges = async () => {
      try {
        setLoading(true);
        
        // Créer une requête optimisée avec index composé
        const today = format(new Date(), 'yyyy-MM-dd');
        const exchangesQuery = query(
          collection(db, 'shift_exchanges'),
          where('date', '>=', today),
          orderBy('date', 'asc')
        );

        // Exécuter la requête
        const querySnapshot = await getDocs(exchangesQuery);
        
        // Transformer les données
        const exchangeData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
        })) as ShiftExchange[];

        setExchanges(exchangeData);
        setError(null);
      } catch (err) {
        console.error('Error loading exchanges:', err);
        setError('Erreur lors du chargement des gardes');
      } finally {
        setLoading(false);
      }
    };

    loadExchanges();
  }, []);

  return { exchanges, loading, error };
};

export default useExchangeData;