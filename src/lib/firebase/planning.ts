import { doc, setDoc } from 'firebase/firestore';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import { serverTimestamp } from 'firebase/firestore';
import type { GeneratedPlanning } from '../../types/planning';

export const saveGeneratedPlanning = async (userId: string, planning: GeneratedPlanning): Promise<void> => {
  try {
    await setDoc(doc(db, 'generated_plannings', userId), {
      ...planning,
      uploadedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving generated planning:', error);
    throw new Error('Erreur lors de la sauvegarde du planning');
  }
};

export const deletePlanning = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'generated_plannings', userId));
  } catch (error) {
    console.error('Error deleting planning:', error);
    throw new Error('Erreur lors de la suppression du planning');
  }
};