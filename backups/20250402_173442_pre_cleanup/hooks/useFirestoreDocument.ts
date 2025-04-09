import { useState, useEffect } from 'react';
import { DocumentReference, onSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';

interface UseFirestoreDocumentOptions {
  includeMetadata?: boolean;
}

export function useFirestoreDocument<T = DocumentData>(
  docRef: DocumentReference,
  options: UseFirestoreDocumentOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      {
        includeMetadataChanges: options.includeMetadata,
      },
      (snapshot) => {
        setSnapshot(snapshot);
        setData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as T : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore document error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [docRef, options.includeMetadata]);

  return {
    data,
    loading,
    error,
    snapshot,
  };
}