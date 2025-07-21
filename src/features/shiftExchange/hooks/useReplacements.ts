import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface Replacement {
  id: string;
  exchangeId: string;
  replacementName?: string;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  assignedAt?: any; // Peut être un Timestamp Firebase ou une string
  assignedBy?: string;
}

interface ReplacementInfo {
  id: string;
  replacementName: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Hook pour récupérer les remplacements liés aux échanges de la bourse aux gardes
 */
export const useReplacements = (exchangeIds: string[]) => {
  const [replacements, setReplacements] = useState<Record<string, ReplacementInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('useReplacements - exchangeIds reçus:', exchangeIds);
    
    if (exchangeIds.length === 0) {
      setReplacements({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribes: (() => void)[] = [];

    try {
      // Diviser les IDs en groupes de 30 (limite Firestore pour l'opérateur IN)
      const BATCH_SIZE = 30;
      const batches: string[][] = [];
      
      for (let i = 0; i < exchangeIds.length; i += BATCH_SIZE) {
        batches.push(exchangeIds.slice(i, i + BATCH_SIZE));
      }

      const allReplacements: Record<string, ReplacementInfo> = {};

      // Créer un listener pour chaque batch
      batches.forEach((batch, batchIndex) => {
        const replacementsQuery = query(
          collection(db, 'remplacements'),
          where('exchangeId', 'in', batch),
          where('status', '==', 'assigned')
        );

        const unsubscribe = onSnapshot(
          replacementsQuery,
          (snapshot) => {
            // Supprimer les anciens remplacements de ce batch
            batch.forEach(id => {
              delete allReplacements[id];
            });

            // Ajouter les nouveaux remplacements
            snapshot.docs.forEach(doc => {
              const data = doc.data() as Replacement;
              console.log(`useReplacements - Document trouvé:`, doc.id, data);
              
              if (data.replacementName && data.assignedAt && data.assignedBy) {
                // Convertir le Timestamp Firebase en string si nécessaire
                const assignedAtStr = data.assignedAt?.toDate ? 
                  data.assignedAt.toDate().toISOString() : 
                  data.assignedAt;
                
                allReplacements[data.exchangeId] = {
                  id: doc.id,
                  replacementName: data.replacementName,
                  assignedAt: assignedAtStr,
                  assignedBy: data.assignedBy
                };
                console.log(`useReplacements - Remplacement ajouté pour exchangeId ${data.exchangeId}:`, allReplacements[data.exchangeId]);
              }
            });

            // Mettre à jour l'état avec tous les remplacements
            setReplacements({ ...allReplacements });
            
            // Si c'est le premier batch qui se termine, arrêter le loading
            if (batchIndex === 0) {
              setLoading(false);
            }
          },
          (err) => {
            console.error(`Error fetching replacements batch ${batchIndex}:`, err);
            if (batchIndex === 0) {
              setError('Erreur lors du chargement des remplacements');
              setLoading(false);
            }
          }
        );

        unsubscribes.push(unsubscribe);
      });

      // Cleanup function
      return () => {
        unsubscribes.forEach(unsubscribe => unsubscribe());
      };
    } catch (err) {
      console.error('Error setting up replacements listener:', err);
      setError('Erreur lors de la configuration du listener');
      setLoading(false);
    }
  }, [exchangeIds.join(',')]); // Utiliser join pour éviter les re-renders inutiles

  return { replacements, loading, error };
};

export default useReplacements;