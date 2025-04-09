import { doc, setDoc, getDoc, addDoc, updateDoc, query, where } from 'firebase/firestore';
import { collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
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
    const updatedAssignments = updateAssignmentsStatus(planning.assignments);
    
    // Récupérer le document existant
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document existant : mettre à jour uniquement la période concernée
      const existingData = docSnap.data();
      const existingPeriods = existingData.periods || {};
      
      await updateDoc(docRef, {
        [`periods.${finalPeriodId}`]: {
          assignments: updatedAssignments,
          uploadedAt: serverTimestamp()
        },
        lastUpdated: serverTimestamp()
      });
    } else {
      // Nouveau document : créer avec la structure par période
      await setDoc(docRef, {
        periods: {
          [finalPeriodId]: {
            assignments: updatedAssignments,
            uploadedAt: serverTimestamp()
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
          uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
        };
      }
      
      // Si aucun periodId n'est spécifié ou si la période n'existe pas,
      // vérifier si c'est un document au format ancien (sans périodes)
      if (data.assignments) {
        return {
          periodId: data.periodId || 'current',
          assignments: data.assignments,
          uploadedAt: data.uploadedAt?.toDate?.() || new Date(data.uploadedAt)
        };
      }
      
      // Sinon, fusionner toutes les périodes
      if (data.periods) {
        const mergedAssignments: Record<string, ShiftAssignment> = {};
        
        Object.entries(data.periods).forEach(([periodId, periodData]: [string, any]) => {
          if (periodData.assignments) {
            Object.entries(periodData.assignments).forEach(([key, assignment]) => {
              mergedAssignments[key] = assignment as ShiftAssignment;
            });
          }
        });
        
        return {
          periodId: 'merged',
          assignments: mergedAssignments,
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
 * Récupère tous les plannings d'un utilisateur par période
 * @param userId ID de l'utilisateur
 * @returns Un objet avec les plannings par période
 */
export const getAllPlanningsByPeriod = async (userId: string): Promise<Record<string, GeneratedPlanning>> => {
  try {
    const docRef = doc(db, 'generated_plannings', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const result: Record<string, GeneratedPlanning> = {};
      
      // Si c'est un document au format ancien (sans périodes)
      if (data.assignments) {
        const periodId = data.periodId || 'current';
        result[periodId] = {
          periodId,
          assignments: data.assignments,
          uploadedAt: data.uploadedAt?.toDate?.() || new Date(data.uploadedAt)
        };
        return result;
      }
      
      // Sinon, traiter chaque période
      if (data.periods) {
        Object.entries(data.periods).forEach(([periodId, periodData]: [string, any]) => {
          if (periodData.assignments) {
            const typedAssignments: Record<string, ShiftAssignment> = {};
            Object.entries(periodData.assignments).forEach(([key, assignment]) => {
              typedAssignments[key] = assignment as ShiftAssignment;
            });
            
            result[periodId] = {
              periodId,
              assignments: typedAssignments,
              uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
            };
          }
        });
      }
      
      return result;
    }
    
    return {};
  } catch (error) {
    console.error('Error getting all plannings by period:', error);
    throw new Error('Erreur lors de la récupération des plannings par période');
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
 * Supprime une période de planning
 * @param periodId ID de la période
 */
export const deletePlanningPeriod = async (periodId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'planning_periods', periodId));
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
  
  // Pour chaque garde, déterminer si elle est archivée (avant hier) ou active
  Object.entries(assignments).forEach(([key, assignment]) => {
    const [dateStr] = key.split('-');
    const assignmentDate = new Date(dateStr);
    
    updatedAssignments[key] = {
      ...assignment,
      status: isBefore(assignmentDate, yesterday) ? 'archived' : 'active'
    };
  });
  
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
    const filteredAssignments = Object.entries(planning.assignments)
      .filter(([key]) => {
        const [dateStr] = key.split('-');
        const assignmentDate = new Date(dateStr);
        return (
          !isBefore(assignmentDate, startDate) && 
          !isAfter(assignmentDate, endDate)
        );
      })
      .reduce((acc, [key, assignment]) => {
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
