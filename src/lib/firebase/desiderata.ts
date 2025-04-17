import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';
import type { Selections, PeriodSelection } from '../../types/planning';

export const getDesiderata = async (userId: string): Promise<{ selections: Selections; validatedAt?: string } | null> => {
  try {
    const docRef = doc(db, 'desiderata', userId);
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
  currentPeriodOnly: boolean = false
): Promise<{ selections: Selections; validatedAt?: string }> => {
  try {
    // 1. Récupérer les desiderata actifs (toujours inclus)
    const activeDesiderata = await getDesiderata(userId);
    console.log(`getAllDesiderata: Desiderata actifs pour ${userId}:`, 
                activeDesiderata?.selections ? Object.keys(activeDesiderata.selections).length : 0);
    
    const mergedSelections: Selections = activeDesiderata?.selections || {};
    
    // Si on ne veut que la période courante, retourner directement les desiderata actifs
    if (currentPeriodOnly) {
      console.log(`getAllDesiderata: Retour des désidératas de période courante uniquement pour ${userId}:`, 
                  Object.keys(mergedSelections).length);
      return {
        selections: mergedSelections,
        validatedAt: activeDesiderata?.validatedAt
      };
    }
    
    // 2. Si demandé, récupérer et fusionner les desiderata archivés
    if (includeArchived) {
      console.log(`getAllDesiderata: Récupération des désidératas archivés pour ${userId}`);
      
      // Récupérer les périodes archivées
      const archivedPeriodsSnapshot = await getDocs(collection(db, 'archived_planning_periods'));
      console.log(`getAllDesiderata: ${archivedPeriodsSnapshot.docs.length} périodes archivées trouvées`);
      
      // Pour chaque période archivée, récupérer les desiderata de l'utilisateur
      for (const periodDoc of archivedPeriodsSnapshot.docs) {
        const desiderataRef = doc(collection(periodDoc.ref, 'desiderata'), userId);
        const desiderataSnap = await getDoc(desiderataRef);
        
        if (desiderataSnap.exists()) {
          const data = desiderataSnap.data();
          console.log(`getAllDesiderata: Période archivée ${periodDoc.id}, désidératas trouvés:`, 
                      data.selections ? Object.keys(data.selections).length : 0);
          
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
    
    console.log(`getAllDesiderata: Retour de ${Object.keys(mergedSelections).length} désidératas pour ${userId} (includeArchived=${includeArchived})`);
    console.log(`getAllDesiderata: Clés des désidératas:`, Object.keys(mergedSelections));
    
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
