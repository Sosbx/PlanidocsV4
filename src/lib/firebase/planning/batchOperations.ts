import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { getCollectionName, COLLECTIONS } from '../../../utils/collectionUtils';
import type { GeneratedPlanning, ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../types/users';

/**
 * Interface pour les options de chargement batch
 */
interface BatchLoadOptions {
  userIds: string[];
  includeArchived?: boolean;
  startDate?: Date;
  endDate?: Date;
  associationId?: string;
}

/**
 * Charge tous les plannings de plusieurs utilisateurs en parallèle
 * Optimisé pour réduire le nombre de requêtes Firebase
 */
export const batchLoadUsersPlannings = async (
  options: BatchLoadOptions
): Promise<Record<string, Record<string, GeneratedPlanning>>> => {
  const { 
    userIds, 
    includeArchived = false, 
    startDate,
    endDate,
    associationId = 'RD' 
  } = options;

  try {
    // Préparer les promesses pour charger tous les utilisateurs en parallèle
    const userPromises = userIds.map(async (userId) => {
      try {
        const docRef = doc(db, getCollectionName(COLLECTIONS.GENERATED_PLANNINGS, associationId), userId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          return { userId, plannings: {} };
        }

        const data = docSnap.data();
        const userPlannings: Record<string, GeneratedPlanning> = {};

        // Traiter les périodes
        if (data.periods) {
          for (const periodId in data.periods) {
            if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
              const periodData = data.periods[periodId];
              
              if (periodData && periodData.assignments) {
                // Convertir les timestamps si nécessaire
                const assignments: Record<string, ShiftAssignment> = {};
                
                for (const key in periodData.assignments) {
                  if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                    const assignment = periodData.assignments[key];
                    
                    // Vérifier les dates si des filtres sont appliqués
                    if (startDate || endDate) {
                      const assignmentDate = new Date(assignment.date);
                      if (startDate && assignmentDate < startDate) continue;
                      if (endDate && assignmentDate > endDate) continue;
                    }
                    
                    assignments[key] = {
                      ...assignment,
                      date: typeof assignment.date === 'object' && 'seconds' in assignment.date
                        ? new Date((assignment.date as any).seconds * 1000).toISOString().split('T')[0]
                        : assignment.date
                    };
                  }
                }

                // N'ajouter la période que si elle contient des assignments
                if (Object.keys(assignments).length > 0) {
                  userPlannings[periodId] = {
                    periodId,
                    assignments,
                    periods: {
                      [periodId]: {
                        assignments,
                        uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                      }
                    },
                    uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                  };
                }
              }
            }
          }
        }

        return { userId, plannings: userPlannings };
      } catch (error) {
        console.error(`Error loading plannings for user ${userId}:`, error);
        return { userId, plannings: {} };
      }
    });

    // Exécuter toutes les requêtes en parallèle
    const results = await Promise.all(userPromises);

    // Construire la structure de retour
    const planningsMap: Record<string, Record<string, GeneratedPlanning>> = {};
    
    results.forEach(({ userId, plannings }) => {
      Object.entries(plannings).forEach(([periodId, planning]) => {
        if (!planningsMap[periodId]) {
          planningsMap[periodId] = {};
        }
        planningsMap[periodId][userId] = planning;
      });
    });

    // Si includeArchived est true, charger les archives en parallèle
    if (includeArchived) {
      const archiveResults = await batchLoadArchivedPlannings({
        userIds,
        startDate: startDate || new Date(createParisDate().setMonth(createParisDate().getMonth() - 12)),
        endDate: endDate || createParisDate(),
        associationId
      });

      // Fusionner les résultats archivés
      Object.entries(archiveResults).forEach(([periodId, periodPlannings]) => {
        if (!planningsMap[periodId]) {
          planningsMap[periodId] = {};
        }
        Object.assign(planningsMap[periodId], periodPlannings);
      });
    }

    return planningsMap;
  } catch (error) {
    console.error('Error in batchLoadUsersPlannings:', error);
    throw new Error('Erreur lors du chargement des plannings en lot');
  }
};

/**
 * Charge les plannings archivés pour plusieurs utilisateurs
 */
const batchLoadArchivedPlannings = async (
  options: {
    userIds: string[];
    startDate: Date;
    endDate: Date;
    associationId: string;
  }
): Promise<Record<string, Record<string, GeneratedPlanning>>> => {
  const { userIds, startDate, endDate, associationId } = options;
  
  // Déterminer les trimestres à charger
  const quarters = getQuartersInRange(startDate, endDate);
  const result: Record<string, Record<string, GeneratedPlanning>> = {};

  // Charger tous les trimestres en parallèle
  const quarterPromises = quarters.map(async (quarter) => {
    const collectionPath = associationId === 'RD' 
      ? `archived_plannings/${quarter}/users`
      : `archived_plannings_${associationId}/${quarter}/users`;

    // Charger tous les utilisateurs de ce trimestre en parallèle
    const userPromises = userIds.map(async (userId) => {
      try {
        const docRef = doc(db, collectionPath, userId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return null;
        
        const data = docSnap.data();
        const userQuarterData: { userId: string; periodId: string; planning: GeneratedPlanning }[] = [];

        if (data.periods) {
          for (const periodId in data.periods) {
            if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
              const periodData = data.periods[periodId];
              
              if (periodData && periodData.assignments) {
                userQuarterData.push({
                  userId,
                  periodId,
                  planning: {
                    periodId,
                    assignments: periodData.assignments,
                    periods: {
                      [periodId]: {
                        assignments: periodData.assignments,
                        uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                      }
                    },
                    uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                  }
                });
              }
            }
          }
        }

        return userQuarterData;
      } catch (error) {
        console.error(`Error loading archived plannings for user ${userId} in quarter ${quarter}:`, error);
        return null;
      }
    });

    const quarterResults = await Promise.all(userPromises);
    return quarterResults.filter(r => r !== null).flat();
  });

  const allQuarterResults = await Promise.all(quarterPromises);
  
  // Organiser les résultats
  allQuarterResults.flat().forEach((item) => {
    if (item) {
      const { userId, periodId, planning } = item;
      if (!result[periodId]) {
        result[periodId] = {};
      }
      result[periodId][userId] = planning;
    }
  });

  return result;
};

/**
 * Détermine les trimestres dans une plage de dates
 */
const getQuartersInRange = (startDate: Date, endDate: Date): string[] => {
  const quarters: string[] = [];
  
  const startYear = startDate.getFullYear();
  const startQuarter = Math.floor(startDate.getMonth() / 3) + 1;
  
  const endYear = endDate.getFullYear();
  const endQuarter = Math.floor(endDate.getMonth() / 3) + 1;
  
  for (let year = startYear; year <= endYear; year++) {
    const firstQuarter = year === startYear ? startQuarter : 1;
    const lastQuarter = year === endYear ? endQuarter : 4;
    
    for (let quarter = firstQuarter; quarter <= lastQuarter; quarter++) {
      quarters.push(`${year}Q${quarter}`);
    }
  }
  
  return quarters;
};

/**
 * Pré-charge les métadonnées des périodes pour optimiser les requêtes suivantes
 */
export const preloadPeriodMetadata = async (
  associationId: string = 'RD'
): Promise<{
  activePeriods: string[];
  archivedQuarters: string[];
  totalUsers: number;
}> => {
  try {
    // Charger les périodes actives
    const periodsCollection = getCollectionName('planning_periods', associationId);
    const periodsSnapshot = await getDocs(collection(db, periodsCollection));
    const activePeriods = periodsSnapshot.docs.map(doc => doc.id);

    // Charger la liste des trimestres archivés disponibles
    const archivedQuarters: string[] = [];
    // Pour l'instant, on génère les 8 derniers trimestres
    const now = createParisDate();
    for (let i = 0; i < 8; i++) {
      const date = new Date(now);
      date.setMonth(now.getMonth() - (i * 3));
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      archivedQuarters.push(`${year}Q${quarter}`);
    }

    // Compter le nombre total d'utilisateurs
    const usersCollection = getCollectionName('users', associationId);
    const usersSnapshot = await getDocs(collection(db, usersCollection));
    const totalUsers = usersSnapshot.size;

    return {
      activePeriods,
      archivedQuarters,
      totalUsers
    };
  } catch (error) {
    console.error('Error preloading metadata:', error);
    return {
      activePeriods: [],
      archivedQuarters: [],
      totalUsers: 0
    };
  }
};