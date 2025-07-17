import { doc, getDoc, collection, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { getGeneratedPlanning, saveGeneratedPlanning } from './planning';

/**
 * Notifie la bourse aux gardes d'une mise à jour de planning
 * @param userId ID de l'utilisateur
 * @param periodId ID de la période
 * @param assignments Nouvelles gardes du planning
 * @param action Type d'action ('add' | 'update' | 'delete')
 */
export const notifyExchangeSystem = async (
  userId: string,
  _periodId: string,
  assignments: Record<string, any>,
  action: 'add' | 'update' | 'delete'
): Promise<void> => {
  try {
    // Si aucune assignation, sortir directement
    if (!assignments || Object.keys(assignments).length === 0) {
      return;
    }
    
    // Récupérer les échanges existants pour cet utilisateur
    const exchangesQuery = query(
      collection(db, 'shift_exchanges'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'unavailable'])
    );
    
    const exchangesSnapshot = await getDocs(exchangesQuery);
    const existingExchanges = exchangesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        period: data.period,
        shiftType: data.shiftType,
        timeSlot: data.timeSlot,
        ...data
      };
    });
    
    await runTransaction(db, async (transaction) => {
      // Pour chaque assignation dans le planning
      for (const key in assignments) {
        const [date, period] = key.split('-');
        const assignment = assignments[key];
        
        // Vérifier s'il existe déjà un échange pour cette date/période
        const matchingExchange = existingExchanges.find(ex => 
          ex.date === date && ex.period === period
        );
        
        if (action === 'delete') {
          // Si la garde est supprimée, marquer les échanges comme indisponibles
          if (matchingExchange) {
            transaction.update(doc(db, 'shift_exchanges', matchingExchange.id), {
              status: 'unavailable',
              lastModified: createParisDate()
            });
          }
        } else if (action === 'add' || action === 'update') {
          // Si la garde est ajoutée/modifiée
          if (matchingExchange && 'shiftType' in matchingExchange && 'timeSlot' in matchingExchange) {
            // Mettre à jour l'échange existant si nécessaire
            if (matchingExchange.shiftType !== assignment.shiftType || 
                matchingExchange.timeSlot !== assignment.timeSlot) {
              transaction.update(doc(db, 'shift_exchanges', matchingExchange.id), {
                shiftType: assignment.shiftType,
                timeSlot: assignment.timeSlot,
                lastModified: createParisDate()
              });
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error notifying exchange system:', error);
    throw error;
  }
};

/**
 * Synchronise les échanges validés avec les plannings
 * @param exchangeId ID de l'échange validé
 */
export const syncValidatedExchangeWithPlanning = async (exchangeId: string): Promise<void> => {
  try {
    const historyDoc = await getDoc(doc(db, 'exchange_history', exchangeId));
    
    if (!historyDoc.exists()) {
      throw new Error(`Exchange history not found for ID: ${exchangeId}`);
    }
    
    const history = historyDoc.data();
    const originalUserId = history.originalUserId;
    const newUserId = history.newUserId;
    const date = history.date;
    const period = history.period;
    const assignmentKey = `${date}-${period}`;
    
    // Récupérer les plannings des deux utilisateurs
    const originalUserPlanning = await getGeneratedPlanning(originalUserId);
    const newUserPlanning = await getGeneratedPlanning(newUserId);
    
    if (!originalUserPlanning || !newUserPlanning) {
      throw new Error('Could not retrieve user plannings');
    }
    
    // Retirer la garde du planning de l'utilisateur original
    const originalPeriodId = history.originalUserPeriodId || findPeriodWithAssignment(originalUserPlanning, assignmentKey);
    if (originalPeriodId && originalUserPlanning.periods && originalUserPlanning.periods[originalPeriodId]) {
      const updatedPeriods = { ...originalUserPlanning.periods };
      
      if (updatedPeriods[originalPeriodId].assignments) {
        const updatedAssignments = { ...updatedPeriods[originalPeriodId].assignments };
        delete updatedAssignments[assignmentKey];
        
        updatedPeriods[originalPeriodId] = {
          ...updatedPeriods[originalPeriodId],
          assignments: updatedAssignments
        };
      }
      
      await saveGeneratedPlanning(originalUserId, {
        ...originalUserPlanning,
        periods: updatedPeriods
      }, originalPeriodId);
    }
    
    // Ajouter la garde au planning du nouvel utilisateur
    const newPeriodId = history.interestedUserPeriodId || findPeriodWithAssignment(newUserPlanning, assignmentKey);
    if (newPeriodId && newUserPlanning.periods) {
      const updatedPeriods = { ...newUserPlanning.periods };
      
      if (!updatedPeriods[newPeriodId]) {
        updatedPeriods[newPeriodId] = {
          assignments: {},
          uploadedAt: createParisDate()
        };
      }
      
      if (!updatedPeriods[newPeriodId].assignments) {
        updatedPeriods[newPeriodId].assignments = {};
      }
      
      // Récupérer les détails de la garde depuis l'historique
      updatedPeriods[newPeriodId].assignments[assignmentKey] = {
        date,
        period,
        type: period,
        shiftType: history.shiftType,
        timeSlot: history.timeSlot
      };
      
      await saveGeneratedPlanning(newUserId, {
        ...newUserPlanning,
        periods: updatedPeriods
      }, newPeriodId);
    }
  } catch (error) {
    console.error('Error syncing validated exchange with planning:', error);
    throw error;
  }
};

/**
 * Trouve la période qui contient une assignation
 * @param planning Données du planning
 * @param assignmentKey Clé de l'assignation
 */
const findPeriodWithAssignment = (planning: any, assignmentKey: string): string | null => {
  if (!planning || !planning.periods) return null;
  
  for (const periodId in planning.periods) {
    const periodData = planning.periods[periodId];
    if (periodData && periodData.assignments && periodData.assignments[assignmentKey]) {
      return periodId;
    }
  }
  
  return Object.keys(planning.periods)[0] || null;
};