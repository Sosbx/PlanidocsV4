import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

interface UseFirestoreQueryOptions {
  includeMetadata?: boolean;
  throttleMs?: number; // Temps minimum entre les mises à jour
}

export function useFirestoreQuery<T = DocumentData>(
  query: Query,
  options: UseFirestoreQueryOptions = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  
  // Utilisation de refs pour stocker les données temporaires
  const pendingDataRef = useRef<T[] | null>(null);
  const pendingSnapshotRef = useRef<QuerySnapshot | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const throttleMs = options.throttleMs ?? 200; // Valeur par défaut de 200ms

  // Fonction pour appliquer les mises à jour en tenant compte du throttling
  const applyUpdates = () => {
    const now = Date.now();
    if (pendingDataRef.current && pendingSnapshotRef.current) {
      // Si le temps écoulé depuis la dernière mise à jour est suffisant
      if (now - lastUpdateRef.current >= throttleMs) {
        setData(pendingDataRef.current);
        setSnapshot(pendingSnapshotRef.current);
        lastUpdateRef.current = now;
        pendingDataRef.current = null;
        pendingSnapshotRef.current = null;
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        // Sinon, planifier une mise à jour différée
        if (timeoutRef.current === null) {
          timeoutRef.current = setTimeout(() => {
            applyUpdates();
            timeoutRef.current = null;
          }, throttleMs - (now - lastUpdateRef.current));
        }
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    pendingDataRef.current = null;
    pendingSnapshotRef.current = null;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const unsubscribe = onSnapshot(
      query,
      {
        includeMetadataChanges: options.includeMetadata,
      },
      (snapshot) => {
        // Traitement optimisé des données
        const processedData = snapshot.docs.map(doc => {
          const docData = doc.data();
          // Convertir les timestamps Firestore en objets Date standard pour éviter des conversions répétées
          return { id: doc.id, ...docData } as T;
        });
        
        // Stocker les données en attente
        pendingDataRef.current = processedData;
        pendingSnapshotRef.current = snapshot;
        
        // Indiquer que le chargement est terminé - sans throttle pour cette indication
        if (loading) {
          setLoading(false);
          setError(null);
        }
        
        // Appliquer les mises à jour selon le throttling
        applyUpdates();
      },
      (err) => {
        console.error('Firestore query error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      unsubscribe();
    };
  }, [query, options.includeMetadata, loading, throttleMs]);

  return {
    data,
    loading,
    error,
    snapshot,
  };
}