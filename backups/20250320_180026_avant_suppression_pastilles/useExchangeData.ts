import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { format } from 'date-fns';
import type { ShiftExchange, GeneratedPlanning } from '../types/planning';

export const useExchangeData = (pageSize: number = 50) => {
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Mémoiser la date d'aujourd'hui pour éviter de la recalculer à chaque rendu
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Charger les données paginées
  const loadExchanges = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setExchanges([]);
      }
      
      // Récupérer le dernier élément pour la pagination
      const lastExchange = !reset && exchanges.length > 0 
        ? exchanges[exchanges.length - 1] 
        : null;
      
      // Créer une requête optimisée avec index composé et pagination
      let exchangesQuery = query(
        collection(db, 'shift_exchanges'),
        where('date', '>=', today),
        orderBy('date', 'asc'),
        limit(pageSize)
      );
      
      // Exécuter la requête
      const querySnapshot = await getDocs(exchangesQuery);
      
      // Vérifier s'il y a plus de données à charger
      setHasMoreData(querySnapshot.docs.length === pageSize);
      
      // Transformer les données avec conversion date
      const exchangeData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString()
        };
      }) as ShiftExchange[];

      setExchanges(prev => reset ? exchangeData : [...prev, ...exchangeData]);
      setError(null);
    } catch (err) {
      console.error('Error loading exchanges:', err);
      setError('Erreur lors du chargement des gardes');
    } finally {
      setLoading(false);
    }
  }, [exchanges, pageSize, today]);

  // Chargement initial des données
  useEffect(() => {
    loadExchanges(true);
  }, [loadExchanges]);

  return { 
    exchanges, 
    loading, 
    error, 
    hasMoreData, 
    loadMore: () => loadExchanges(false),
    refresh: () => loadExchanges(true)
  };
};

export default useExchangeData;