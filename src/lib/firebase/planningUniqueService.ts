import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { GeneratedPlanning } from '../../types/planning';
import { saveGeneratedPlanning } from './planning';

/**
 * Vérifie si un planning existe déjà pour un utilisateur et une période
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période
 * @returns true si le planning existe, false sinon
 */
export const checkPlanningExists = async (userId: string, periodId: string): Promise<boolean> => {
  try {
    const planningRef = doc(db, 'generated_plannings', userId);
    const planningDoc = await getDoc(planningRef);
    
    if (planningDoc.exists()) {
      const planningData = planningDoc.data();
      
      // Vérifier dans la structure avec périodes
      if (planningData.periods && planningData.periods[periodId]) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking planning existence:', error);
    throw error;
  }
};

/**
 * Valide et enregistre un planning unique pour un utilisateur et une période
 * Si un planning existe déjà, une erreur est levée
 * @param userId ID de l'utilisateur
 * @param planning Données du planning
 * @param periodId ID de la période
 * @param forceOverwrite Si true, écrase le planning existant
 */
export const saveUniquePlanning = async (
  userId: string,
  planning: GeneratedPlanning,
  periodId: string,
  forceOverwrite: boolean = false
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      const planningRef = doc(db, 'generated_plannings', userId);
      const planningDoc = await transaction.get(planningRef);
      
      if (planningDoc.exists()) {
        const planningData = planningDoc.data();
        
        // Vérifier si un planning existe déjà pour cette période
        if (planningData.periods && planningData.periods[periodId] && !forceOverwrite) {
          throw new Error(`Un planning existe déjà pour cette période (${periodId}) et cet utilisateur (${userId})`);
        }
      }
    });
    
    // Si on arrive ici, on peut sauvegarder le planning
    // Important: Ne pas utiliser require ou import dans une transaction - faire l'appel après
    await saveGeneratedPlanning(userId, planning, periodId);
  } catch (error) {
    console.error('Error saving unique planning:', error);
    throw error;
  }
};