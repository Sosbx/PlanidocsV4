import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAuth } from './useAuth';

export const useDesiderataState = () => {
  const { user } = useAuth();
  const [selections, setSelectionsState] = useState<Record<string, 'primary' | 'secondary' | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSelectionsState({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'desiderata', user.id),
      (doc) => {
        if (doc.exists()) {
          setSelectionsState(doc.data()?.selections || {});
        } else {
          setSelectionsState({});
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error loading desiderata:', error);
        setSelectionsState({});
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const setSelections = (newSelections: Record<string, 'primary' | 'secondary' | null>) => {
    setSelectionsState(newSelections);
  };

  return {
    selections,
    setSelections,
    isLoading
  };
};