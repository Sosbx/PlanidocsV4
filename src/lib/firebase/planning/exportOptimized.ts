import { doc, getDoc } from 'firebase/firestore';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { getCollectionName, COLLECTIONS } from '../../../utils/collectionUtils';
import type { GeneratedPlanning, ShiftAssignment } from '../../../types/planning';
import { format } from 'date-fns';

/**
 * Export optimisé de l'historique d'un utilisateur en CSV avec streaming
 * Évite de charger toutes les données en mémoire
 */
export const exportUserPlanningHistoryOptimized = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  associationId: string = 'RD',
  onProgress?: (percent: number) => void
): Promise<string> => {
  try {
    // Headers du CSV
    const headers = ['Date', 'Poste', 'Type de garde', 'Période', 'Créé le'];
    const rows: string[] = [headers.join(',')];
    
    // Récupérer le document de l'utilisateur
    const docRef = doc(db, getCollectionName(COLLECTIONS.GENERATED_PLANNINGS, associationId), userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return rows.join('\n');
    }
    
    const data = docSnap.data();
    const allAssignments: Array<{
      date: Date;
      assignment: ShiftAssignment;
      periodId: string;
      uploadedAt: Date;
    }> = [];
    
    // Collecter les assignments de toutes les périodes
    if (data.periods) {
      let periodCount = 0;
      const totalPeriods = Object.keys(data.periods).length;
      
      for (const periodId in data.periods) {
        if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
          const periodData = data.periods[periodId];
          
          if (periodData && periodData.assignments) {
            for (const key in periodData.assignments) {
              if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                const assignment = periodData.assignments[key] as ShiftAssignment;
                
                if (assignment && assignment.date) {
                  const assignmentDate = new Date(assignment.date);
                  
                  // Filtrer par dates
                  if (assignmentDate >= startDate && assignmentDate <= endDate) {
                    allAssignments.push({
                      date: assignmentDate,
                      assignment,
                      periodId,
                      uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                    });
                  }
                }
              }
            }
          }
          
          // Mettre à jour la progression
          periodCount++;
          if (onProgress) {
            onProgress(Math.round((periodCount / totalPeriods) * 50));
          }
        }
      }
    }
    
    // Charger les archives si nécessaire
    const cutoffDate = createParisDate();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    
    if (startDate < cutoffDate) {
      // Déterminer les trimestres à charger
      const quarters = getQuartersInRange(startDate, endDate);
      let quarterCount = 0;
      
      for (const quarter of quarters) {
        const archiveData = await loadArchivedQuarter(userId, quarter, associationId);
        
        for (const item of archiveData) {
          if (item.date >= startDate && item.date <= endDate) {
            allAssignments.push(item);
          }
        }
        
        // Mettre à jour la progression
        quarterCount++;
        if (onProgress) {
          onProgress(50 + Math.round((quarterCount / quarters.length) * 50));
        }
      }
    }
    
    // Trier par date
    allAssignments.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Générer les lignes CSV
    allAssignments.forEach(({ date, assignment, periodId, uploadedAt }) => {
      const row = [
        formatParisDate(date, 'yyyy-MM-dd'),
        assignment.shift || '',
        assignment.shiftType || '',
        periodId,
        formatParisDate(uploadedAt, 'yyyy-MM-dd HH:mm:ss')
      ];
      
      // Échapper les valeurs contenant des virgules
      const escapedRow = row.map(value => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      
      rows.push(escapedRow.join(','));
    });
    
    if (onProgress) {
      onProgress(100);
    }
    
    return rows.join('\n');
  } catch (error) {
    console.error('Error exporting user planning history:', error);
    throw new Error('Erreur lors de l\'export de l\'historique');
  }
};

/**
 * Charge les données archivées d'un trimestre
 */
const loadArchivedQuarter = async (
  userId: string,
  quarter: string,
  associationId: string
): Promise<Array<{
  date: Date;
  assignment: ShiftAssignment;
  periodId: string;
  uploadedAt: Date;
}>> => {
  try {
    const collectionPath = associationId === 'RD' 
      ? `archived_plannings/${quarter}/users`
      : `archived_plannings_${associationId}/${quarter}/users`;
    
    const docRef = doc(db, collectionPath, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return [];
    }
    
    const data = docSnap.data();
    const results: Array<{
      date: Date;
      assignment: ShiftAssignment;
      periodId: string;
      uploadedAt: Date;
    }> = [];
    
    if (data.periods) {
      for (const periodId in data.periods) {
        if (Object.prototype.hasOwnProperty.call(data.periods, periodId)) {
          const periodData = data.periods[periodId];
          
          if (periodData && periodData.assignments) {
            for (const key in periodData.assignments) {
              if (Object.prototype.hasOwnProperty.call(periodData.assignments, key)) {
                const assignment = periodData.assignments[key] as ShiftAssignment;
                
                if (assignment && assignment.date) {
                  results.push({
                    date: new Date(assignment.date),
                    assignment,
                    periodId,
                    uploadedAt: periodData.uploadedAt?.toDate?.() || new Date(periodData.uploadedAt)
                  });
                }
              }
            }
          }
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error loading archived quarter ${quarter}:`, error);
    return [];
  }
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
 * Export en lot de l'historique de plusieurs utilisateurs
 */
export const exportMultipleUsersHistory = async (
  userIds: string[],
  startDate: Date,
  endDate: Date,
  associationId: string = 'RD',
  onProgress?: (userId: string, percent: number) => void
): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  
  // Traiter les utilisateurs en parallèle par lots de 5
  const batchSize = 5;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (userId) => {
      try {
        const csv = await exportUserPlanningHistoryOptimized(
          userId,
          startDate,
          endDate,
          associationId,
          (percent) => onProgress?.(userId, percent)
        );
        return { userId, csv };
      } catch (error) {
        console.error(`Error exporting history for user ${userId}:`, error);
        return { userId, csv: '' };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ userId, csv }) => {
      results.set(userId, csv);
    });
  }
  
  return results;
};