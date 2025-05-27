/**
 * ConflictService.ts
 * 
 * Service centralisé pour la vérification et la gestion des conflits dans les échanges de gardes
 * Utilisé par tous les types d'échanges (directs et bourse aux gardes)
 * 
 * Version 1.1.0 - Implémentation de la détection de conflits entre les systèmes d'échange
 * Développé par Claude pour Planidocs
 */

import { db } from '../config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { normalizePeriod } from '../../../utils/dateUtils';
import { COLLECTIONS } from './types';
import { ShiftPeriod } from '../../../types/exchange';
import { addDays, subDays, isSameDay, parseISO, format } from 'date-fns';

// Interface pour l'entrée de vérification de conflit
export interface ConflictCheckInput {
  userId: string;
  date: string;
  period: string | ShiftPeriod;
  checkBagExchange?: boolean;
  checkDirectExchange?: boolean;
  checkAssignedShifts?: boolean;
}

// Types de conflits possibles
export enum ConflictType {
  NONE = 'none',
  SHIFT_EXCHANGE = 'shift_exchange',
  DIRECT_EXCHANGE = 'direct_exchange',
  ASSIGNED_SHIFT = 'assigned_shift',
  DESIDERATA = 'desiderata',
  GARDE_DUTY = 'garde_duty',
  REST_PERIOD = 'rest_period'
}

// Résultat d'une vérification de conflit
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: ConflictType;
  conflictDetails?: any;
  message?: string;
}

/**
 * Vérifie si une garde est en conflit avec d'autres échanges ou règles
 * @param input Données de la garde à vérifier
 * @returns Résultat de la vérification
 */
export const checkShiftConflict = async (input: ConflictCheckInput): Promise<ConflictCheckResult> => {
  try {
    // Normaliser la période pour éviter les incohérences
    const normalizedPeriod = normalizePeriod(input.period);
    
    // 1. Vérifier si la garde existe déjà dans la bourse aux gardes
    if (input.checkBagExchange !== false) {
      const bagConflict = await checkBagExchangeConflict(input.userId, input.date, normalizedPeriod);
      if (bagConflict.hasConflict) {
        return bagConflict;
      }
    }
    
    // 2. Vérifier si la garde existe déjà dans les échanges directs
    if (input.checkDirectExchange !== false) {
      const directConflict = await checkDirectExchangeConflict(input.userId, input.date, normalizedPeriod);
      if (directConflict.hasConflict) {
        return directConflict;
      }
    }
    
    // 3. Vérifier si la garde est assignée à l'utilisateur
    if (input.checkAssignedShifts !== false) {
      const assignmentConflict = await checkShiftAssignmentConflict(input.userId, input.date, normalizedPeriod);
      if (assignmentConflict.hasConflict) {
        return assignmentConflict;
      }
    }
    
    // 4. Vérifier les règles de temps de repos
    const restConflict = await checkRestPeriodConflict(input.userId, input.date, normalizedPeriod);
    if (restConflict.hasConflict) {
      return restConflict;
    }
    
    // Aucun conflit trouvé
    return {
      hasConflict: false,
      conflictType: ConflictType.NONE
    };
  } catch (error) {
    console.error("Erreur lors de la vérification des conflits:", error);
    return {
      hasConflict: true,
      conflictType: ConflictType.NONE,
      message: `Erreur lors de la vérification: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Vérifie si une garde est en conflit avec la bourse aux gardes
 */
const checkBagExchangeConflict = async (
  userId: string, 
  date: string,
  period: string
): Promise<ConflictCheckResult> => {
  // Rechercher dans la collection shift_exchanges
  const bagExchangeQuery = query(
    collection(db, 'shift_exchanges'),
    where('date', '==', date),
    where('period', '==', period),
    where('userId', '==', userId),
    where('status', 'in', ['pending', 'unavailable'])
  );
  
  const bagExchangeSnapshot = await getDocs(bagExchangeQuery);
  
  if (!bagExchangeSnapshot.empty) {
    return {
      hasConflict: true,
      conflictType: ConflictType.SHIFT_EXCHANGE,
      conflictDetails: {
        exchangeId: bagExchangeSnapshot.docs[0].id,
        exchangeData: bagExchangeSnapshot.docs[0].data()
      },
      message: "Cette garde est déjà proposée dans la bourse aux gardes"
    };
  }
  
  return { hasConflict: false };
};

/**
 * Vérifie si une garde est en conflit avec les échanges directs
 */
const checkDirectExchangeConflict = async (
  userId: string, 
  date: string,
  period: string
): Promise<ConflictCheckResult> => {
  // Rechercher dans la collection direct_exchanges
  const directExchangeQuery = query(
    collection(db, COLLECTIONS.DIRECT_EXCHANGES),
    where('date', '==', date),
    where('period', '==', period),
    where('userId', '==', userId),
    where('status', 'in', ['pending', 'unavailable'])
  );
  
  const directExchangeSnapshot = await getDocs(directExchangeQuery);
  
  if (!directExchangeSnapshot.empty) {
    return {
      hasConflict: true,
      conflictType: ConflictType.DIRECT_EXCHANGE,
      conflictDetails: {
        exchangeId: directExchangeSnapshot.docs[0].id,
        exchangeData: directExchangeSnapshot.docs[0].data()
      },
      message: "Cette garde est déjà proposée en échange direct"
    };
  }
  
  return { hasConflict: false };
};

/**
 * Vérifie si une garde est bien assignée à l'utilisateur
 */
const checkShiftAssignmentConflict = async (
  userId: string, 
  date: string,
  period: string
): Promise<ConflictCheckResult> => {
  // Rechercher dans la collection plannings_période
  const planningQuery = query(
    collection(db, 'user_planning'),
    where('userId', '==', userId)
  );
  
  const planningSnapshot = await getDocs(planningQuery);
  
  if (planningSnapshot.empty) {
    return {
      hasConflict: true,
      conflictType: ConflictType.ASSIGNED_SHIFT,
      message: "Aucun planning trouvé pour cet utilisateur"
    };
  }
  
  // Vérifier si la garde existe dans le planning
  let hasAssignment = false;
  for (const doc of planningSnapshot.docs) {
    const data = doc.data();
    
    if (data && data.assignments) {
      const assignments = data.assignments;
      const assignments_by_date = data.assignments_by_date;
      
      // Check in both formats
      if (assignments && assignments[date] && assignments[date][period]) {
        hasAssignment = true;
        break;
      }
      
      if (assignments_by_date && assignments_by_date[date]) {
        const dayAssignments = assignments_by_date[date];
        if (Array.isArray(dayAssignments)) {
          for (const assignment of dayAssignments) {
            if (assignment.period === period || assignment.type === period) {
              hasAssignment = true;
              break;
            }
          }
        }
      }
    }
  }
  
  if (!hasAssignment) {
    return {
      hasConflict: true,
      conflictType: ConflictType.ASSIGNED_SHIFT,
      message: "Cette garde n'est pas assignée à cet utilisateur"
    };
  }
  
  return { hasConflict: false };
};

/**
 * Vérifie les règles de temps de repos entre gardes
 */
const checkRestPeriodConflict = async (
  userId: string, 
  date: string,
  period: string
): Promise<ConflictCheckResult> => {
  // Cette fonction est une version simplifiée - une implémentation complète devrait 
  // vérifier toutes les règles métier spécifiques aux médecins (repos de garde, etc.)
  
  // Convertir la date en objet Date
  const shiftDate = parseISO(date);
  
  // Vérifier les gardes 24h avant et après
  const dayBefore = format(subDays(shiftDate, 1), 'yyyy-MM-dd');
  const dayAfter = format(addDays(shiftDate, 1), 'yyyy-MM-dd');
  
  // Rechercher les gardes dans ces jours
  const shiftsQuery = query(
    collection(db, 'user_planning'),
    where('userId', '==', userId)
  );
  
  const shiftsSnapshot = await getDocs(shiftsQuery);
  
  if (!shiftsSnapshot.empty) {
    for (const doc of shiftsSnapshot.docs) {
      const data = doc.data();
      
      if (data && data.assignments_by_date) {
        // Vérifier le jour précédent
        if (data.assignments_by_date[dayBefore]) {
          const prevDayShifts = data.assignments_by_date[dayBefore];
          if (Array.isArray(prevDayShifts) && prevDayShifts.length > 0) {
            // Si le shift précédent est du soir (S) et le nouveau du matin (M)
            if (prevDayShifts.some(s => s.period === 'S' || s.type === 'S') && 
                (period === 'M' || period === ShiftPeriod.MORNING)) {
              return {
                hasConflict: true,
                conflictType: ConflictType.REST_PERIOD,
                message: "Temps de repos insuffisant entre une garde du soir et du matin"
              };
            }
          }
        }
        
        // Vérifier le jour suivant (si votre période actuelle est du soir)
        if ((period === 'S' || period === ShiftPeriod.EVENING) && data.assignments_by_date[dayAfter]) {
          const nextDayShifts = data.assignments_by_date[dayAfter];
          if (Array.isArray(nextDayShifts) && nextDayShifts.length > 0) {
            // Si le shift suivant est du matin (M)
            if (nextDayShifts.some(s => s.period === 'M' || s.type === 'M')) {
              return {
                hasConflict: true,
                conflictType: ConflictType.REST_PERIOD,
                message: "Temps de repos insuffisant entre une garde du soir et du matin"
              };
            }
          }
        }
      }
    }
  }
  
  return { hasConflict: false };
};

/**
 * Vérifie les conflits pour un remplacement ou un échange
 * @param date Date de la garde
 * @param period Période de la garde
 * @param sourceUserId ID de l'utilisateur qui propose la garde
 * @param targetUserId ID de l'utilisateur qui recevrait la garde
 */
export const checkReplacementConflict = async (
  date: string,
  period: string | ShiftPeriod,
  sourceUserId: string,
  targetUserId: string
): Promise<ConflictCheckResult> => {
  try {
    // 1. Vérifier que la garde appartient bien au sourceUserId
    const sourceCheck = await checkShiftAssignmentConflict(sourceUserId, date, normalizePeriod(period));
    if (sourceCheck.hasConflict) {
      return {
        ...sourceCheck,
        message: "Cette garde n'est pas assignée à l'utilisateur qui la propose"
      };
    }
    
    // 2. Vérifier que le targetUserId n'a pas déjà une garde ce jour-là à cette période
    const targetCheck: ConflictCheckInput = {
      userId: targetUserId,
      date,
      period,
      checkAssignedShifts: true
    };
    
    const conflictCheck = await checkShiftConflict(targetCheck);
    if (!conflictCheck.hasConflict) {
      // Si pas de conflit, c'est que le targetUserId n'a pas de garde à cette période
      // Ce qui est bon pour un remplacement
      return { hasConflict: false };
    } else if (conflictCheck.conflictType === ConflictType.ASSIGNED_SHIFT) {
      // Si le conflit est de type ASSIGNED_SHIFT, c'est que le targetUserId a déjà une garde
      // ce qui représente un conflit pour un remplacement
      return {
        hasConflict: true,
        conflictType: ConflictType.ASSIGNED_SHIFT,
        message: "Le médecin remplaçant a déjà une garde à cette période"
      };
    }
    
    // Si autre type de conflit, renvoyer celui-ci
    return conflictCheck;
  } catch (error) {
    console.error("Erreur lors de la vérification des conflits de remplacement:", error);
    return {
      hasConflict: true,
      message: `Erreur lors de la vérification: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};