import { doc, setDoc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { collection, getDocs, deleteDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from './config';
import { serverTimestamp } from 'firebase/firestore';
import type { GeneratedPlanning, PlanningPeriod, ShiftAssignment } from '../../types/planning';
import { format, isAfter, isBefore, subDays } from 'date-fns';

/**
 * Sauvegarde un planning généré pour un utilisateur et une période spécifique
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période (optionnel)
 * @param planning Données du planning
 */
export const saveGeneratedPlanning = async (
  userId: string, 
  planning: GeneratedPlanning,
  periodId?: string
): Promise<void> => {
  try {
    // Si un periodId est fourni, l'utiliser, sinon utiliser celui du planning ou null
    const finalPeriodId = periodId || planning.periodId || 'current';
    
    // Mettre à jour les statuts des gardes (actif/archivé) avant sauvegarde
    const updatedAssignments = updateAssignmentsStatus(planning.assignments || {});
    
    // Vérifier si la période contient des gardes archivées
    const hasArchivedAssignments = Object.values(updatedAssignments).some(
      assignment => assignment.status === 'archived'
    );
    
    // Vérifier si le nom de la période indique qu'elle est archivée
    const isPeriodNameArchived = finalPeriodId.includes('archived') || 
                                finalPeriodId.includes('past');
    
    // Déterminer si cette période doit être traitée comme archivée
    const isArchivedPeriod = hasArchivedAssignments || isPeriodNameArchived;
    
    console.log(`[PLANNING_SAVE] Sauvegarde du planning pour l'utilisateur ${userId}, période ${finalPeriodId}`);
    console.log(`[PLANNING_SAVE] Période archivée: ${isArchivedPeriod ? 'Oui' : 'Non'}`);
    console.log(`[PLANNING_SAVE] Nombre d'assignments: ${Object.keys(updatedAssignments).length}`);
    
    // Récupérer le document existant
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document existant : mettre à jour uniquement la période concernée
      // Pas besoin de stocker les données existantes pour cette opération
      await updateDoc(docRef, {
        [`periods.${finalPeriodId}`]: {
          assignments: updatedAssignments,
          uploadedAt: serverTimestamp(),
          isArchived: isArchivedPeriod // Ajouter cette information
        },
        lastUpdated: serverTimestamp()
      });
    } else {
      // Nouveau document : créer avec la structure par période
      await setDoc(docRef, {
        periods: {
          [finalPeriodId]: {
            assignments: updatedAssignments,
            uploadedAt: serverTimestamp(),
            isArchived: isArchivedPeriod // Ajouter cette information
          }
        },
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving generated planning:', error);
    throw new Error('Erreur lors de la sauvegarde du planning');
  }
};

/**
 * Supprime un planning généré pour un utilisateur
 * @param userId ID de l'utilisateur
 */
export const deletePlanning = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'generated_plannings', userId));
  } catch (error) {
    console.error('Error deleting planning:', error);
    throw new Error('Erreur lors de la suppression du planning');
  }
};

/**
 * Supprime un planning généré pour un utilisateur et une période spécifique
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période
 */
export const deletePlanningForPeriod = async (userId: string, periodId: string): Promise<void> => {
  try {
    // Récupérer le document existant
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Si le document utilise le nouveau format avec périodes
      if (data.periods && data.periods[periodId]) {
        // Supprimer uniquement la période spécifiée
        await updateDoc(docRef, {
          [`periods.${periodId}`]: deleteField()
        });
      } else {
        // Si c'est un ancien format ou si la période n'existe pas, ne rien faire
        console.warn(`Période ${periodId} non trouvée pour l'utilisateur ${userId}`);
      }
    }
  } catch (error) {
    console.error('Error deleting planning for period:', error);
    throw new Error('Erreur lors de la suppression du planning pour cette période');
  }
};

/**
 * Supprime tous les plannings pour une période spécifique
 * @param periodId ID de la période
 */
export const deleteAllPlanningsForPeriod = async (periodId: string): Promise<void> => {
  try {
    // Récupérer tous les documents de plannings
    const planningsSnapshot = await getDocs(collection(db, 'generated_plannings'));
    
    // Créer un batch pour les opérations groupées
    const batch = writeBatch(db);
    
    // Pour chaque document, supprimer la période spécifiée
    planningsSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      
      // Si le document utilise le nouveau format avec périodes et contient la période spécifiée
      if (data.periods && data.periods[periodId]) {
        const docRef = doc(db, 'generated_plannings', docSnapshot.id);
        batch.update(docRef, {
          [`periods.${periodId}`]: deleteField()
        });
      }
    });
    
    // Exécuter le batch
    await batch.commit();
  } catch (error) {
    console.error('Error deleting all plannings for period:', error);
    throw new Error('Erreur lors de la suppression de tous les plannings pour cette période');
  }
};

/**
 * Récupère le planning généré d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période (optionnel)
 * @returns Le planning généré ou null si non trouvé
 */
export const getGeneratedPlanning = async (userId: string, periodId?: string): Promise<GeneratedPlanning | null> => {
  try {
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Si un periodId est spécifié, retourner uniquement cette période
      if (periodId && data.periods && data.periods[periodId]) {
        const periodData = data.periods[periodId];
        return {
          periodId,
          assignments: periodData.assignments,
          periods: { [periodId]: periodData },
          uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
        };
      }
      
      // Sinon, fusionner toutes les périodes
      if (data.periods) {
        const mergedAssignments: Record<string, ShiftAssignment> = {};
        
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodKey in data.periods) {
          if (Object.prototype.hasOwnProperty.call(data.periods, periodKey)) {
            const periodData = data.periods[periodKey];
            
            if (periodData && periodData.assignments) {
              // Utiliser une autre boucle for...in pour les assignments
              for (const assignmentKey in periodData.assignments) {
                if (Object.prototype.hasOwnProperty.call(periodData.assignments, assignmentKey)) {
                  mergedAssignments[assignmentKey] = periodData.assignments[assignmentKey] as ShiftAssignment;
                }
              }
            }
          }
        }
        
        return {
          periodId: 'merged',
          assignments: mergedAssignments,
          periods: data.periods,
          uploadedAt: data.lastUpdated?.toDate?.() || new Date(data.lastUpdated)
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting generated planning:', error);
    throw new Error('Erreur lors de la récupération du planning');
  }
};

/**
 * Récupère tous les plannings d'un utilisateur par période, avec chargement progressif
 * Par défaut, charge uniquement les 3 derniers mois + futur
 * @param userId ID de l'utilisateur
 * @param options Options de chargement (plage de dates, inclure les archives)
 * @returns Un objet avec les plannings par période
 */
export const getAllPlanningsByPeriod = async (
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    includeArchived?: boolean;
  }
): Promise<Record<string, GeneratedPlanning>> => {
  try {
    // Définir les dates par défaut (3 derniers mois + futur)
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setMonth(today.getMonth() - 3);
    
    const startDate = options?.startDate || defaultStartDate;
    const endDate = options?.endDate || new Date(today.getFullYear() + 1, 11, 31); // Fin de l'année prochaine
    const includeArchived = options?.includeArchived || false;
    
    // Récupérer les plannings de la collection principale
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    const result: Record<string, GeneratedPlanning> = {};
    
    // Traiter les plannings de la collection principale
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Si c'est un document au format ancien (sans périodes)
      if (data.assignments) {
        const periodId = data.periodId || 'current';
        result[periodId] = {
          periodId,
          assignments: filterAssignmentsByDate(data.assignments, startDate, endDate),
          periods: {}, // Ajouter un objet periods vide pour satisfaire le type
          uploadedAt: data.uploadedAt?.toDate?.() || new Date(data.uploadedAt)
        };
      }
      
      // Sinon, traiter chaque période
      if (data.periods) {
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodId in data.periods) {
          if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
            const periodData = data.periods[periodId];
            
            if (periodData && periodData.assignments) {
              const typedAssignments: Record<string, ShiftAssignment> = {};
              
              // Utiliser une autre boucle for...in pour les assignments
              for (const key in periodData.assignments) {
                if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                  typedAssignments[key] = periodData.assignments[key] as ShiftAssignment;
                }
              }
              
              // Vérifier si cette période est marquée comme archivée
              const isArchivedPeriod = includeArchived && 
                (periodData.isArchived === true || 
                 periodId.includes('archived') || 
                 periodId.includes('past'));
              
              // Si c'est une période archivée et qu'on demande l'inclusion des archives,
              // on inclut tous les assignments sans filtrer par date
              const filteredAssignments = isArchivedPeriod ? 
                typedAssignments : 
                filterAssignmentsByDate(typedAssignments, startDate, endDate);
              
              result[periodId] = {
                periodId,
                assignments: filteredAssignments,
                periods: {
                  [periodId]: {
                    assignments: filteredAssignments,
                    uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                  }
                },
                uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
              };
              
              // Si c'est une période archivée, ajouter un log
              if (isArchivedPeriod) {
                console.log(`[PLANNING_GET] Période archivée incluse: ${periodId} avec ${Object.keys(filteredAssignments).length} assignments`);
              }
            }
          }
        }
      }
    }
      
      // Si on doit inclure les archives de la collection archived_plannings
      if (includeArchived) {
        console.log(`[PLANNING_GET] Chargement des archives depuis la collection archived_plannings pour l'utilisateur ${userId}`);
        
        // Déterminer les trimestres à charger
        const quarters = getQuartersInRange(
          startDate < defaultStartDate ? startDate : defaultStartDate, 
          defaultStartDate
        );
        
        console.log(`[PLANNING_GET] Trimestres à charger: ${quarters.join(', ')}`);
        
        // Charger les plannings archivés pour chaque trimestre
        for (const quarter of quarters) {
          const archivedPlannings = await getArchivedPlanningsByQuarter(userId, quarter);
          
          // Fusionner avec les résultats
          // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
          for (const periodId in archivedPlannings) {
            if (Object.prototype.hasOwnProperty.call(archivedPlannings, periodId)) {
              const planning = archivedPlannings[periodId];
              
              if (!result[periodId]) {
                result[periodId] = planning;
              } else if (planning.assignments) {
                // S'assurer que result[periodId].assignments existe
                if (!result[periodId].assignments) {
                  result[periodId].assignments = {};
                }
                
                // Fusionner les assignments
                // Utiliser une autre boucle for...in pour les assignments
                for (const key in planning.assignments) {
                  if (Object.prototype.hasOwnProperty.call(planning.assignments, key)) {
                    result[periodId].assignments[key] = planning.assignments[key];
                  }
                }
              }
            }
          }
        }
      }
    
    return result;
  } catch (error) {
    console.error('Error getting all plannings by period:', error);
    throw new Error('Erreur lors de la récupération des plannings par période');
  }
};

/**
 * Filtre les assignments par date
 * @param assignments Assignments à filtrer
 * @param startDate Date de début
 * @param endDate Date de fin
 * @returns Assignments filtrés
 */
const filterAssignmentsByDate = (
  assignments: Record<string, ShiftAssignment> | undefined,
  startDate: Date,
  endDate: Date
): Record<string, ShiftAssignment> => {
  const result: Record<string, ShiftAssignment> = {};
  
  // Vérifier que assignments n'est pas undefined
  if (!assignments) return result;
  
  // Utiliser une boucle for...in qui est plus sûre avec TypeScript dans ce cas
  for (const key in assignments) {
    if (Object.prototype.hasOwnProperty.call(assignments, key)) {
      const assignment = assignments[key];
      
      // Vérifier que assignment n'est pas null ou undefined avant d'accéder à ses propriétés
      if (assignment && assignment.date && typeof assignment.date === 'string') {
        const assignmentDate = new Date(assignment.date);
        
        if (assignmentDate >= startDate && assignmentDate <= endDate) {
          result[key] = assignment;
        }
      }
    }
  }
  
  return result;
};

/**
 * Récupère les plannings archivés d'un utilisateur pour un trimestre spécifique
 * @param userId ID de l'utilisateur
 * @param quarter Trimestre au format 'YYYYQN' (ex: '2024Q1')
 * @returns Un objet avec les plannings par période
 */
export const getArchivedPlanningsByQuarter = async (
  userId: string,
  quarter: string
): Promise<Record<string, GeneratedPlanning>> => {
  try {
    const docRef = doc(db, `archived_plannings/${quarter}/users`, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const result: Record<string, GeneratedPlanning> = {};
      
      // Traiter chaque période
      if (data.periods) {
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodId in data.periods) {
          if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
            const periodData = data.periods[periodId];
            
            if (periodData && periodData.assignments) {
              const typedAssignments: Record<string, ShiftAssignment> = {};
              
              // Utiliser une autre boucle for...in pour les assignments
              for (const key in periodData.assignments) {
                if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                  typedAssignments[key] = periodData.assignments[key] as ShiftAssignment;
                }
              }
              
              result[periodId] = {
                periodId,
                assignments: typedAssignments,
                periods: {
                  [periodId]: {
                    assignments: typedAssignments,
                    uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                  }
                },
                uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
              };
            }
          }
        }
      }
      
      return result;
    }
    
    return {};
  } catch (error) {
    console.error(`Error getting archived plannings for quarter ${quarter}:`, error);
    throw new Error(`Erreur lors de la récupération des plannings archivés pour le trimestre ${quarter}`);
  }
};

/**
 * Détermine les trimestres dans une plage de dates
 * @param startDate Date de début
 * @param endDate Date de fin
 * @returns Liste des trimestres au format 'YYYYQN'
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
 * Archive les plannings plus anciens que 3 mois
 * @returns Nombre de plannings archivés
 */
export const archiveOldPlannings = async (): Promise<number> => {
  try {
    // Définir la date limite (3 mois avant aujourd'hui)
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setMonth(today.getMonth() - 3);
    
    // Déterminer le trimestre cible pour l'archivage
    const targetYear = cutoffDate.getFullYear();
    const targetQuarter = Math.floor(cutoffDate.getMonth() / 3) + 1;
    const quarterKey = `${targetYear}Q${targetQuarter}`;
    
    // Récupérer tous les documents de plannings
    const planningsSnapshot = await getDocs(collection(db, 'generated_plannings'));
    
    let archivedCount = 0;
    const batch = writeBatch(db);
    
    // Pour chaque utilisateur
    for (const docSnapshot of planningsSnapshot.docs) {
      const userId = docSnapshot.id;
      const data = docSnapshot.data();
      
      // Assignments à archiver
      const assignmentsToArchive: Record<string, Record<string, ShiftAssignment>> = {};
      
      // Assignments à conserver
      const assignmentsToKeep: Record<string, Record<string, ShiftAssignment>> = {};
      
      // Traiter chaque période
      if (data.periods) {
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodId in data.periods) {
          if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
            const periodData = data.periods[periodId];
            
            if (periodData && periodData.assignments) {
              const oldAssignments: Record<string, ShiftAssignment> = {};
              const newAssignments: Record<string, ShiftAssignment> = {};
              
              // Utiliser une autre boucle for...in pour les assignments
              for (const key in periodData.assignments) {
                if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                  const assignment = periodData.assignments[key];
                  
                  if (assignment && assignment.date && typeof assignment.date === 'string') {
                    const assignmentDate = new Date(assignment.date);
                    
                    if (assignmentDate < cutoffDate) {
                      oldAssignments[key] = assignment as ShiftAssignment;
                    } else {
                      newAssignments[key] = assignment as ShiftAssignment;
                    }
                  }
                }
              }
              
              // Si des assignments doivent être archivés
              if (Object.keys(oldAssignments).length > 0) {
                assignmentsToArchive[periodId] = oldAssignments;
              }
              
              // Si des assignments doivent être conservés
              if (Object.keys(newAssignments).length > 0) {
                assignmentsToKeep[periodId] = newAssignments;
              }
            }
          }
        }
      }
      
      // Si des assignments doivent être archivés
      if (Object.keys(assignmentsToArchive).length > 0) {
        // Référence au document d'archive
        const archiveRef = doc(db, `archived_plannings/${quarterKey}/users`, userId);
        
        // Préparer les données d'archive
        const archiveData: any = {
          periods: {}
        };
        
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodId in assignmentsToArchive) {
          if (Object.prototype.hasOwnProperty.call(assignmentsToArchive, periodId)) {
            const assignments = assignmentsToArchive[periodId];
            archiveData.periods[periodId] = {
              assignments,
              uploadedAt: data.periods[periodId]?.uploadedAt || serverTimestamp()
            };
          }
        }
        
        // Ajouter l'opération d'archivage au batch
        batch.set(archiveRef, archiveData, { merge: true });
        
        // Mettre à jour le document original
        const originalRef = doc(db, 'generated_plannings', userId);
        
        // Préparer les données mises à jour
        const updatedData: any = {
          periods: {}
        };
        
        // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
        for (const periodId in assignmentsToKeep) {
          if (Object.prototype.hasOwnProperty.call(assignmentsToKeep, periodId)) {
            const assignments = assignmentsToKeep[periodId];
            updatedData.periods[periodId] = {
              assignments,
              uploadedAt: data.periods[periodId]?.uploadedAt || serverTimestamp()
            };
          }
        }
        
        // Ajouter l'opération de mise à jour au batch
        batch.set(originalRef, updatedData);
        
        archivedCount++;
      }
    }
    
    // Exécuter le batch
    await batch.commit();
    
    return archivedCount;
  } catch (error) {
    console.error('Error archiving old plannings:', error);
    throw new Error('Erreur lors de l\'archivage des anciens plannings');
  }
};

/**
 * Crée une nouvelle période de planning
 * @param period Données de la période
 * @returns ID de la période créée
 */
export const createPlanningPeriod = async (period: Omit<PlanningPeriod, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'planning_periods'), {
      ...period,
      startDate: period.startDate,
      endDate: period.endDate,
      validatedAt: period.validatedAt || null
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating planning period:', error);
    throw new Error('Erreur lors de la création de la période de planning');
  }
};

/**
 * Récupère toutes les périodes de planning
 * @returns Liste des périodes de planning
 */
export const getPlanningPeriods = async (): Promise<PlanningPeriod[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'planning_periods'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      startDate: doc.data().startDate.toDate(),
      endDate: doc.data().endDate.toDate(),
      status: doc.data().status,
      bagPhase: doc.data().bagPhase,
      isValidated: doc.data().isValidated,
      validatedAt: doc.data().validatedAt?.toDate() || null
    }));
  } catch (error) {
    console.error('Error getting planning periods:', error);
    throw new Error('Erreur lors de la récupération des périodes de planning');
  }
};

/**
 * Met à jour une période de planning
 * @param periodId ID de la période
 * @param updates Mises à jour à appliquer
 */
export const updatePlanningPeriod = async (
  periodId: string, 
  updates: Partial<PlanningPeriod>
): Promise<void> => {
  try {
    const periodRef = doc(db, 'planning_periods', periodId);
    
    // Préparer les données pour Firestore
    const updateData: any = { ...updates };
    if (updates.startDate) updateData.startDate = updates.startDate;
    if (updates.endDate) updateData.endDate = updates.endDate;
    if (updates.validatedAt) updateData.validatedAt = updates.validatedAt;
    
    await updateDoc(periodRef, updateData);
  } catch (error) {
    console.error('Error updating planning period:', error);
    throw new Error('Erreur lors de la mise à jour de la période de planning');
  }
};

/**
 * Supprime une période de planning et tous les plannings associés
 * @param periodId ID de la période
 */
export const deletePlanningPeriod = async (periodId: string): Promise<void> => {
  try {
    // 1. D'abord supprimer tous les plannings associés à cette période
    await deleteAllPlanningsForPeriod(periodId);
    console.log(`Tous les plannings associés à la période ${periodId} ont été supprimés`);
    
    // 2. Ensuite supprimer la période elle-même
    await deleteDoc(doc(db, 'planning_periods', periodId));
    console.log(`Période ${periodId} supprimée avec succès`);
  } catch (error) {
    console.error('Error deleting planning period:', error);
    throw new Error('Erreur lors de la suppression de la période de planning');
  }
};

/**
 * Valide la BAG et fusionne la période future avec la période active
 * @param futurePeriodId ID de la période future à valider
 */
export const validateBagAndMergePeriods = async (futurePeriodId: string): Promise<void> => {
  try {
    // 1. Récupérer toutes les périodes
    const periods = await getPlanningPeriods();
    
    // 2. Identifier la période future et la période active
    const futurePeriod = periods.find(p => p.id === futurePeriodId);
    const activePeriod = periods.find(p => p.status === 'active');
    
    if (!futurePeriod) {
      throw new Error('Période future non trouvée');
    }
    
    // 3. Mettre à jour les statuts des périodes
    const batch = writeBatch(db);
    
    // Mettre à jour la période future
    const futurePeriodRef = doc(db, 'planning_periods', futurePeriodId);
    batch.update(futurePeriodRef, {
      status: 'active',
      bagPhase: 'completed',
      isValidated: true,
      validatedAt: new Date()
    });
    
    // Si une période active existe, la marquer comme archivée
    if (activePeriod) {
      const activePeriodRef = doc(db, 'planning_periods', activePeriod.id);
      batch.update(activePeriodRef, {
        status: 'archived'
      });
    }
    
    // 4. Exécuter le batch
    await batch.commit();
    
    // 5. Mettre à jour la configuration des périodes de planning
    await setDoc(doc(db, 'config', 'planning_periods'), {
      currentPeriod: {
        startDate: futurePeriod.startDate,
        endDate: futurePeriod.endDate
      },
      // Réinitialiser la période future
      futurePeriod: null
    });
  } catch (error) {
    console.error('Error validating BAG and merging periods:', error);
    throw new Error('Erreur lors de la validation de la BAG et de la fusion des périodes');
  }
};

/**
 * Met à jour le statut des gardes (actif/archivé) en fonction de la date
 * @param assignments Assignations de gardes
 * @returns Assignations mises à jour
 */
export const updateAssignmentsStatus = (
  assignments: Record<string, ShiftAssignment>
): Record<string, ShiftAssignment> => {
  const yesterday = subDays(new Date(), 1);
  const updatedAssignments: Record<string, ShiftAssignment> = {};
  
  // Utiliser une boucle for...in pour éviter les erreurs TypeScript avec Object.entries
  for (const key in assignments) {
    if (Object.prototype.hasOwnProperty.call(assignments, key)) {
      const assignment = assignments[key];
      const [dateStr] = key.split('-');
      const assignmentDate = new Date(dateStr);
      
      updatedAssignments[key] = {
        ...assignment,
        status: isBefore(assignmentDate, yesterday) ? 'archived' : 'active'
      };
    }
  }
  
  return updatedAssignments;
};

/**
 * Exporte l'historique de planning d'un utilisateur en CSV
 * @param userId ID de l'utilisateur
 * @param startDate Date de début
 * @param endDate Date de fin
 * @returns Contenu CSV
 */
export const exportUserPlanningHistoryToCsv = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<string> => {
  try {
    // 1. Récupérer le planning de l'utilisateur
    const planning = await getGeneratedPlanning(userId);
    
    if (!planning) {
      throw new Error('Planning non trouvé');
    }
    
    // 2. Filtrer les gardes dans la plage de dates
    // S'assurer que assignments n'est jamais undefined
    const assignments = planning.assignments || {};
    
    // Créer un tableau d'entrées à partir des assignments en évitant Object.entries
    // pour résoudre l'erreur TypeScript
    const entries: [string, ShiftAssignment][] = [];
    
    // Utiliser une boucle for...in qui est plus sûre avec TypeScript dans ce cas
    for (const key in assignments) {
      if (Object.prototype.hasOwnProperty.call(assignments, key)) {
        entries.push([key, assignments[key]]);
      }
    }
    
    // Filtrer les entrées par date
    const filteredEntries = entries.filter(([key]) => {
      const [dateStr] = key.split('-');
      const assignmentDate = new Date(dateStr);
      return (
        !isBefore(assignmentDate, startDate) && 
        !isAfter(assignmentDate, endDate)
      );
    });
    
    // Convertir en objet
    const filteredAssignments = filteredEntries.reduce((acc, [key, assignment]) => {
      acc[key] = assignment;
      return acc;
    }, {} as Record<string, ShiftAssignment>);
    
    // 3. Convertir en CSV
    const headers = ['Date', 'Période', 'Type de garde', 'Créneau horaire', 'Statut'];
    const rows = Object.entries(filteredAssignments).map(([key, assignment]) => {
      const [dateStr, period] = key.split('-');
      const formattedDate = format(new Date(dateStr), 'dd/MM/yyyy');
      const periodLabel = period === 'M' ? 'Matin' : period === 'AM' ? 'Après-midi' : 'Soir';
      
      return [
        formattedDate,
        periodLabel,
        assignment.shiftType,
        assignment.timeSlot,
        assignment.status === 'archived' ? 'Archivé' : 'Actif'
      ];
    });
    
    // Trier par date
    rows.sort((a, b) => {
      const dateA = a[0].split('/').reverse().join('');
      const dateB = b[0].split('/').reverse().join('');
      return dateA.localeCompare(dateB);
    });
    
    // Générer le CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csvContent;
  } catch (error) {
    console.error('Error exporting user planning history:', error);
    throw new Error('Erreur lors de l\'export de l\'historique de planning');
  }
};
