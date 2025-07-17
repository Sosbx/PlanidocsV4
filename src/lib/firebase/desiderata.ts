import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import type { Selections, PeriodSelection } from '../../types/planning';
import { ASSOCIATIONS } from '../../constants/associations';
import { getCollectionName } from '../../utils/collectionUtils';

export const getDesiderata = async (userId: string, associationId: string = ASSOCIATIONS.RIVE_DROITE): Promise<{ selections: Selections; validatedAt?: string } | null> => {
  try {
    const collectionName = getCollectionName('desiderata', associationId);
    const docRef = doc(db, collectionName, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        selections: data.selections || {},
        validatedAt: data.validatedAt
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting desiderata:', error);
    throw error;
  }
};

/**
 * Récupère tous les desiderata d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param includeArchived Si true, inclut les desiderata archivés (défaut: false)
 * @param currentPeriodOnly Si true, ne retourne que les desiderata de la période courante, même si includeArchived=true (défaut: false)
 * @returns Les desiderata actifs et optionnellement archivés
 */
export const getAllDesiderata = async (
  userId: string, 
  includeArchived: boolean = false,
  currentPeriodOnly: boolean = false,
  associationId: string = ASSOCIATIONS.RIVE_DROITE
): Promise<{ selections: Selections; validatedAt?: string }> => {
  try {
    // 1. Récupérer les desiderata actifs (toujours inclus)
    const activeDesiderata = await getDesiderata(userId, associationId);
    
    const mergedSelections: Selections = activeDesiderata?.selections || {};
    
    // Si on ne veut que la période courante, retourner directement les desiderata actifs
    if (currentPeriodOnly) {
      return {
        selections: mergedSelections,
        validatedAt: activeDesiderata?.validatedAt
      };
    }
    
    // 2. Si demandé, récupérer et fusionner les desiderata archivés
    if (includeArchived) {
      // Récupérer les périodes archivées
      const archivedCollectionName = getCollectionName('archived_planning_periods', associationId);
      const archivedPeriodsSnapshot = await getDocs(collection(db, archivedCollectionName));
      
      // Pour chaque période archivée, récupérer les desiderata de l'utilisateur
      for (const periodDoc of archivedPeriodsSnapshot.docs) {
        const desiderataCollectionName = getCollectionName('desiderata', associationId);
        const desiderataRef = doc(collection(periodDoc.ref, desiderataCollectionName), userId);
        const desiderataSnap = await getDoc(desiderataRef);
        
        if (desiderataSnap.exists()) {
          const data = desiderataSnap.data();
          
          // Fusionner les selections avec les desiderata actifs
          if (data.selections) {
            Object.entries(data.selections).forEach(([key, value]) => {
              // Ne pas écraser les desiderata actifs
              if (!mergedSelections[key]) {
                mergedSelections[key] = value as PeriodSelection;
              }
            });
          }
        }
      }
      
    }
    
    return {
      selections: mergedSelections,
      validatedAt: activeDesiderata?.validatedAt
    };
  } catch (error) {
    console.error('Error getting all desiderata:', error);
    throw error;
  }
};

export const saveDesiderata = async (
  userId: string, 
  selections: Selections,
  associationId: string = ASSOCIATIONS.RIVE_DROITE
) => {
  try {
    const collectionName = getCollectionName('desiderata', associationId);
    const docRef = doc(db, collectionName, userId);
    
    const cleanSelections = Object.fromEntries(
      Object.entries(selections).filter(([_, value]) => value.type !== null || value.comment)
    );

    if (Object.keys(cleanSelections).length === 0) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, {
        userId,
        associationId,
        selections: cleanSelections,
        updatedAt: createParisDate().toISOString()
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
  selections: Selections,
  associationId: string = ASSOCIATIONS.RIVE_DROITE
) => {
  try {
    const collectionName = getCollectionName('desiderata', associationId);
    const docRef = doc(db, collectionName, userId);
    const cleanSelections = Object.fromEntries(
      Object.entries(selections).filter(([_, value]) => value?.type !== null || value?.comment) || {}
    );

    await setDoc(docRef, {
      userId,
      associationId,
      selections: cleanSelections,
      validatedAt: createParisDate().toISOString(),
      updatedAt: createParisDate().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error validating desiderata:', { error, userId });
    throw error instanceof Error ? error : new Error('Erreur lors de la validation des desiderata');
  }
};
