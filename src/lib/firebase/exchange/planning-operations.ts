import { Transaction, serverTimestamp, deleteField } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from './types';
import type { ShiftAssignment } from './types';

/**
 * Trouve une assignation dans un planning, quelle que soit sa structure
 * @param planningData Données du planning
 * @param assignmentKey Clé de l'assignation (format: YYYY-MM-DD-PERIOD)
 * @returns L'assignation trouvée ou null
 */
export const findAssignmentInPlanning = (
  planningData: any,
  assignmentKey: string
): any | null => {
  if (!planningData) return null;
  
  // Vérifier dans l'ancienne structure (assignments directement dans le document)
  if (planningData.assignments && planningData.assignments[assignmentKey]) {
    return planningData.assignments[assignmentKey];
  }
  
  // Vérifier dans la nouvelle structure (periods)
  if (planningData.periods) {
    for (const periodId in planningData.periods) {
      const periodData = planningData.periods[periodId];
      if (periodData && 
          periodData.assignments && 
          periodData.assignments[assignmentKey]) {
        return periodData.assignments[assignmentKey];
      }
    }
  }
  
  return null;
};

/**
 * Trouve la période qui contient une assignation
 * @param planningData Données du planning
 * @param assignmentKey Clé de l'assignation (format: YYYY-MM-DD-PERIOD)
 * @returns ID de la période ou null
 */
export const findPeriodWithAssignment = (
  planningData: any,
  assignmentKey: string
): string | null => {
  if (!planningData || !planningData.periods) return null;
  
  for (const periodId in planningData.periods) {
    const periodData = planningData.periods[periodId];
    if (periodData && 
        periodData.assignments && 
        periodData.assignments[assignmentKey]) {
      return periodId;
    }
  }
  
  // Si aucune période ne contient l'assignation mais qu'il y a des périodes, utiliser la première
  if (Object.keys(planningData.periods).length > 0) {
    return Object.keys(planningData.periods)[0];
  }
  
  return null;
};

/**
 * Supprime une assignation d'un planning
 * @param planningRef Référence au document de planning
 * @param planningData Données du planning
 * @param assignmentKey Clé de l'assignation (format: YYYY-MM-DD-PERIOD)
 * @param transaction Transaction Firestore
 */
export const removeAssignmentFromPlanningData = (
  planningRef: any,
  planningData: any,
  assignmentKey: string,
  transaction: Transaction
): void => {
  // Vérifier si le planning utilise l'ancienne structure
  if (planningData.assignments && assignmentKey in planningData.assignments) {
    // Ancienne structure - supprimer complètement le champ
    transaction.update(planningRef, {
      [`assignments.${assignmentKey}`]: deleteField(),
      uploadedAt: serverTimestamp()
    });
    console.log(`Suppression complète de l'assignation ${assignmentKey} dans l'ancienne structure`);
    return;
  }
  
  // Vérifier si le planning utilise la nouvelle structure
  if (planningData.periods) {
    const periodId = findPeriodWithAssignment(planningData, assignmentKey);
    if (periodId) {
      // Nouvelle structure - supprimer complètement dans la période identifiée
      transaction.update(planningRef, {
        [`periods.${periodId}.assignments.${assignmentKey}`]: deleteField(),
        uploadedAt: serverTimestamp()
      });
      console.log(`Suppression complète de l'assignation ${assignmentKey} dans la période ${periodId}`);
      return;
    }
  }
  
  console.log(`Aucune assignation ${assignmentKey} trouvée à supprimer`);
};

/**
 * Ajoute une assignation à un planning
 * @param planningRef Référence au document de planning
 * @param planningData Données du planning
 * @param assignmentKey Clé de l'assignation (format: YYYY-MM-DD-PERIOD)
 * @param assignmentData Données de l'assignation
 * @param transaction Transaction Firestore
 * @param specificPeriodId ID de période spécifique (optionnel)
 */
export const addAssignmentToPlanningData = (
  planningRef: any,
  planningData: any,
  assignmentKey: string,
  assignmentData: any,
  transaction: Transaction,
  specificPeriodId?: string | null
): void => {
  // Vérifier d'abord si l'assignation existe déjà
  const existingAssignment = findAssignmentInPlanning(planningData, assignmentKey);
  if (existingAssignment) {
    console.warn(`L'assignation ${assignmentKey} existe déjà dans le planning, suppression pour éviter la duplication`);
    removeAssignmentFromPlanningData(planningRef, planningData, assignmentKey, transaction);
  }
  
  // Vérifier si le planning utilise la nouvelle structure avec periods
  if (planningData.periods) {
    // Utiliser la période spécifique si fournie, sinon trouver une période appropriée
    let periodId = specificPeriodId || findPeriodWithAssignment(planningData, assignmentKey);
    
    // Si aucune période n'est trouvée, essayer de trouver une période par date
    if (!periodId) {
      // Extraire la date de la clé d'assignation (format: YYYY-MM-DD-PERIOD)
      const dateParts = assignmentKey.split('-');
      if (dateParts.length >= 3) {
        const dateStr = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
        const assignmentDate = new Date(dateStr);
        
        // Parcourir toutes les périodes pour trouver celle qui contient cette date
        for (const pid in planningData.periods) {
          const period = planningData.periods[pid];
          if (period.startDate && period.endDate) {
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            
            if (assignmentDate >= startDate && assignmentDate <= endDate) {
              periodId = pid;
              break;
            }
          }
        }
      }
    }
    
    // Si toujours pas de période trouvée mais qu'il y a des périodes, utiliser la première
    if (!periodId && Object.keys(planningData.periods).length > 0) {
      periodId = Object.keys(planningData.periods)[0];
    }
    
    if (periodId) {
      // Nouvelle structure - ajouter dans la période identifiée
      transaction.update(planningRef, {
        [`periods.${periodId}.assignments.${assignmentKey}`]: assignmentData,
        uploadedAt: serverTimestamp()
      });
      console.log(`Ajout de l'assignation ${assignmentKey} dans la période ${periodId}`);
      return; // Sortir de la fonction après avoir ajouté l'assignation dans la période
    }
  }
  
  // Fallback: si aucune période n'est trouvée, mettre à jour la structure assignments principale
  // Cela ne devrait arriver que si le planning n'a pas de périodes du tout
  console.warn(`Aucune période trouvée pour l'assignation ${assignmentKey}, utilisation de la structure assignments principale`);
  transaction.update(planningRef, {
    [`assignments.${assignmentKey}`]: assignmentData,
    uploadedAt: serverTimestamp()
  });
};

/**
 * Récupère les références aux plannings des utilisateurs impliqués dans un échange
 * @param originalUserId ID de l'utilisateur original
 * @param newUserId ID du nouvel utilisateur
 * @returns Références aux documents de planning
 */
export const getPlanningRefs = (originalUserId: string, newUserId: string) => {
  const originalUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, originalUserId);
  const newUserPlanningRef = doc(db, COLLECTIONS.PLANNINGS, newUserId);
  
  return { originalUserPlanningRef, newUserPlanningRef };
};
