import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import type { Selections } from '../types/planning';

export const getDesiderata = async (userId: string): Promise<{ selections: Selections; validatedAt?: string } | null> => {
  try {
    const docRef = doc(db, 'desiderata', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error getting desiderata:', error);
    throw error;
  }
};

export const saveDesiderata = async (
  userId: string, 
  selections: Selections
) => {
  try {
    const docRef = doc(db, 'desiderata', userId);
    
    const cleanSelections = Object.fromEntries(
      Object.entries(selections).filter(([_, value]) => value.type !== null || value.comment)
    );

    if (Object.keys(cleanSelections).length === 0) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, {
        userId,
        selections: cleanSelections,
        updatedAt: new Date().toISOString()
      });
    }
    return true;
  } catch (error) {
    console.error('Error saving desiderata:', error);
    throw error;
  }
};

export const validateDesiderata = async (
  userId: string, 
  selections: Selections
) => {
  try {
    const docRef = doc(db, 'desiderata', userId);
    const cleanSelections = Object.fromEntries(
      Object.entries(selections).filter(([_, value]) => value?.type !== null || value?.comment) || {}
    );

    await setDoc(docRef, {
      userId,
      selections: cleanSelections,
      validatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error validating desiderata:', { error, userId });
    throw error instanceof Error ? error : new Error('Erreur lors de la validation des desiderata');
  }
};