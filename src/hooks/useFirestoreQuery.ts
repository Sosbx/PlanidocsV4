import { useState, useEffect } from 'react';
import { Query, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

interface UseFirestoreQueryOptions {
  includeMetadata?: boolean;
}

export function useFirestoreQuery<T = DocumentData>(
  query: Query,
  options: UseFirestoreQueryOptions = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      {
        includeMetadataChanges: options.includeMetadata,
      },
      (snapshot) => {
        setSnapshot(snapshot);
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore query error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [query, options.includeMetadata]);

  return {
    data,
    loading,
    error,
    snapshot,
  };
}