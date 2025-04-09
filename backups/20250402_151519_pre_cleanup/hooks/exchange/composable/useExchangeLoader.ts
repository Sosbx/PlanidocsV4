import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
from "../../lib/firebase/config";
import { useAuth } from '../../useAuth';
import type { ShiftExchange, GeneratedPlanning } from '../../../types/planning';

interface UseExchangeLoaderResult {
  exchanges: ShiftExchange[];
  loading: boolean;
  error: string | null;
  userAssignments: Record<string, any>;
}

/**
 * Hook responsable uniquement du chargement des données d'échange depuis Firestore
 * Séparé de useExchangeData pour une meilleure séparation des préoccupations
 */
export function useExchangeLoader(): UseExchangeLoaderResult {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAssignments, setUserAssignments] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    
    // Stockage des fonctions de nettoyage
    const cleanupFunctions: (() => void)[] = [];
    
    const addCleanup = (fn: (() => void) | undefined | null) => {
      if (typeof fn === 'function') {
        cleanupFunctions.push(fn);
      }
    };
    
    setLoading(true);
    
    // Date d'aujourd'hui
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      // 1. Requête optimisée pour obtenir les échanges
      const exchangesQuery = query(
        collection(db, 'shift_exchanges'),
        where('date', '>=', today),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('date', 'asc'),
        limit(100) // Limiter à 100 résultats
      );
      
      // 2. Écouteur principal pour les échanges
      const unsubscribeMain = onSnapshot(
        exchangesQuery,
        (snapshot) => {
          const exchangeData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ShiftExchange[];
          
          // Trier les échanges
          exchangeData.sort((a, b) => {
            if (a.status === 'pending' && b.status === 'unavailable') return -1;
            if (a.status === 'unavailable' && b.status === 'pending') return 1;
            return a.date.localeCompare(b.date);
          });
          
          setExchanges(exchangeData);
          setLoading(false);
        },
        (error) => {
          console.error('Error loading exchanges:', error);
          
          // Message d'erreur personnalisé pour l'index manquant
          let errorMessage = 'Erreur lors du chargement des échanges';
          
          // Vérifier si c'est une erreur d'index manquant
          if (error.message && error.message.includes('requires an index')) {
            errorMessage = 'Configuration de la base de données requise. Veuillez contacter l\'administrateur.';
            console.warn('Index Firestore manquant. Créez l\'index via le lien dans l\'erreur de console.');
          }
          
          setError(errorMessage);
          
          // Définir un délai avant de réessayer
          setTimeout(() => {
            // Essayer de charger sans orderBy pour récupérer au moins des données
            try {
              const simpleQuery = query(
                collection(db, 'shift_exchanges'),
                where('date', '>=', today),
                where('status', 'in', ['pending', 'unavailable'])
              );
              
              const fallbackUnsubscribe = onSnapshot(
                simpleQuery,
                (snapshot) => {
                  const exchangeData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as ShiftExchange[];
                  
                  setExchanges(exchangeData);
                  setLoading(false);
                },
                () => setLoading(false)
              );
              
              // Ajouter au nettoyage
              addCleanup(fallbackUnsubscribe);
            } catch (error) {
              console.error('Fallback query error:', error);
              setLoading(false);
            }
          }, 1000);
        }
      );
      
      // Ajouter l'écouteur principal à nettoyer
      addCleanup(unsubscribeMain);
      
      // Charger le planning de l'utilisateur
      const loadUserPlanning = async () => {
        try {
          const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
          if (planningDoc.exists()) {
            const planning = planningDoc.data() as GeneratedPlanning;
            setUserAssignments(planning.assignments || {});
          }
        } catch (error) {
          console.error('Error loading user planning:', error);
        }
      };
      
      // Lancer le chargement du planning
      loadUserPlanning();
      
    } catch (error) {
      console.error('Error setting up data loading:', error);
      setError('Erreur lors du chargement des données');
      setLoading(false);
    }
    
    // Fonction de nettoyage principale pour l'effet
    return () => {
      // Exécuter toutes les fonctions de nettoyage
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      });
    };
  }, [user]);

  return {
    exchanges,
    loading,
    error,
    userAssignments
  };
}
