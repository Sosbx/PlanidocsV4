/**
 * Classe de base abstraite pour les repositories d'échanges
 */

import { BaseRepository } from './BaseRepository';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { FirestoreDocument } from '@/types/firebase';
import { ShiftPeriod } from '@/types/exchange';
import { PlanningPeriodData } from '@/types/planning';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getCollectionName } from '@/utils/collectionUtils';
import { normalizePeriod } from '@/utils/dateUtils';

/**
 * Interface de base pour les documents d'échange
 */
export interface ExchangeDocument extends FirestoreDocument {
  userId: string;
  date: string;
  period: ShiftPeriod;
  shiftType: string;
  timeSlot: string;
  status: string;
  comment?: string;
}

/**
 * Classe de base abstraite pour les repositories d'échanges
 */
export abstract class ExchangeBaseRepository<T extends ExchangeDocument> extends BaseRepository<T> {
  
  /**
   * Vérifier si une garde existe dans le planning
   */
  protected async verifyShiftExists(
    userId: string, 
    date: string, 
    period: ShiftPeriod,
    shiftType: string,
    associationId: string
  ): Promise<boolean> {
    try {
      const planningCollection = getCollectionName('planning', associationId);
      const docRef = collection(db, planningCollection);
      const generatedPlanningsDoc = await getDocs(query(docRef, where('__name__', '==', 'generatedPlannings')));
      
      if (generatedPlanningsDoc.empty) {
        console.error('Aucun planning généré trouvé');
        return false;
      }

      const planningData = generatedPlanningsDoc.docs[0].data();
      const normalizedDate = formatParisDate(new Date(date), 'yyyy-MM-dd');
      const normalizedPeriod = normalizePeriod(period);
      const key = `${userId}_${normalizedDate}-${normalizedPeriod}`;

      // Vérifier dans la nouvelle structure (periods)
      if (planningData.periods) {
        for (const periodData of Object.values(planningData.periods) as PlanningPeriodData[]) {
          const assignments = periodData.assignments || {};
          if (assignments[key]) {
            const assignment = assignments[key];
            return assignment.shiftType === shiftType;
          }
        }
      }

      // Vérifier dans l'ancienne structure (assignments directs)
      if (planningData.assignments && planningData.assignments[key]) {
        const assignment = planningData.assignments[key];
        return assignment.shiftType === shiftType;
      }

      return false;
    } catch (error) {
      console.error('Erreur lors de la vérification de la garde:', error);
      return false;
    }
  }

  /**
   * Vérifier si une garde est déjà dans un autre système d'échange
   */
  protected async checkConflictWithOtherExchangeSystems(
    userId: string,
    date: string,
    period: ShiftPeriod,
    associationId: string,
    excludeCollection?: string
  ): Promise<{ hasConflict: boolean; conflictType?: string }> {
    try {
      const normalizedDate = formatParisDate(new Date(date), 'yyyy-MM-dd');
      const normalizedPeriod = normalizePeriod(period);

      // Collections à vérifier
      const collectionsToCheck = [
        { name: 'shift_exchanges', type: 'bourse aux gardes' },
        { name: 'direct_exchanges', type: 'échange direct' }
      ].filter(col => col.name !== excludeCollection);

      for (const { name, type } of collectionsToCheck) {
        const collectionName = getCollectionName(name, associationId);
        const q = query(
          collection(db, collectionName),
          where('userId', '==', userId),
          where('date', '==', normalizedDate),
          where('period', '==', normalizedPeriod),
          where('status', 'in', ['pending', 'validated', 'matched'])
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return { hasConflict: true, conflictType: type };
        }
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Erreur lors de la vérification des conflits:', error);
      return { hasConflict: false };
    }
  }

  /**
   * Normaliser les données d'échange avant sauvegarde
   */
  protected normalizeExchangeData(data: Partial<T>): Partial<T> {
    const normalized = { ...data };

    if (normalized.date) {
      normalized.date = formatParisDate(new Date(normalized.date), 'yyyy-MM-dd');
    }

    if (normalized.period) {
      normalized.period = normalizePeriod(normalized.period) as ShiftPeriod;
    }

    return normalized;
  }

  /**
   * Valider les données d'échange
   */
  protected validateExchangeData(data: Partial<T>): void {
    if (!data.userId || !data.date || !data.period || !data.shiftType || !data.timeSlot) {
      const missingFields = [];
      if (!data.userId) missingFields.push('userId');
      if (!data.date) missingFields.push('date');
      if (!data.period) missingFields.push('period');
      if (!data.shiftType) missingFields.push('shiftType');
      if (!data.timeSlot) missingFields.push('timeSlot');
      
      throw new Error(`Données manquantes pour l'échange: ${missingFields.join(', ')}`);
    }

    // Vérifier que la période est valide
    const validPeriods = [ShiftPeriod.MORNING, ShiftPeriod.AFTERNOON, ShiftPeriod.EVENING];
    const normalizedPeriod = normalizePeriod(data.period);
    
    if (!validPeriods.includes(normalizedPeriod as ShiftPeriod)) {
      throw new Error(`Période invalide: ${data.period}. Doit être M, AM ou S`);
    }
  }

  /**
   * Obtenir la clé unique pour un échange
   */
  protected getExchangeKey(userId: string, date: string, period: ShiftPeriod): string {
    const normalizedDate = formatParisDate(new Date(date), 'yyyy-MM-dd');
    const normalizedPeriod = normalizePeriod(period);
    return `${userId}_${normalizedDate}_${normalizedPeriod}`;
  }

  /**
   * Créer une entrée d'historique commune
   */
  protected createHistoryEntry(
    originalUserId: string,
    newUserId: string,
    date: string,
    period: ShiftPeriod,
    shiftType: string,
    timeSlot: string,
    additionalData: Record<string, any> = {}
  ): Record<string, any> {
    return {
      originalUserId,
      newUserId,
      date: formatParisDate(new Date(date), 'yyyy-MM-dd'),
      period: normalizePeriod(period),
      shiftType,
      timeSlot,
      exchangedAt: createParisDate().toISOString(),
      status: 'completed',
      ...additionalData
    };
  }
}