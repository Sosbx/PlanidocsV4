import { useCallback } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { PlanningPeriod } from '../../../types/planning';
import { generatePeriodName } from '../utils/dateRangeDetector';

interface UsePlanningPeriodsOptions {
  createPlanningPeriod?: (period: Omit<PlanningPeriod, 'id'>) => Promise<string>;
  allPeriods?: PlanningPeriod[];
}

export const usePlanningPeriods = ({
  createPlanningPeriod,
  allPeriods = []
}: UsePlanningPeriodsOptions) => {
  /**
   * Crée une période adaptée aux dates détectées
   * @returns Un objet contenant les informations sur les deux périodes (passée et future)
   */
  const createPeriodFromDateRange = useCallback(async (
    startDate: Date,
    endDate: Date,
    customName?: string,
    bagEnabled: boolean = true
  ): Promise<{ 
    periodId: string; 
    period: PlanningPeriod | null;
    pastPeriodId: string | null;
    pastPeriod: PlanningPeriod | null;
    futurePeriodId: string | null;
    futurePeriod: PlanningPeriod | null;
  }> => {
    if (!createPlanningPeriod) {
      throw new Error('Fonction de création de période non disponible');
    }
    
    // Vérifier si une période existante couvre déjà complètement cette plage de dates
    const exactMatchingPeriod = allPeriods.find(period => 
      period.startDate <= startDate && period.endDate >= endDate
    );
    
    if (exactMatchingPeriod) {
      console.log(`Période existante trouvée pour la plage ${startDate.toISOString()} - ${endDate.toISOString()}: ${exactMatchingPeriod.id}`);
      
      // Retourner la période existante au lieu d'en créer une nouvelle
      return {
        periodId: exactMatchingPeriod.id,
        period: exactMatchingPeriod,
        pastPeriodId: null,
        pastPeriod: null,
        futurePeriodId: null,
        futurePeriod: null
      };
    }
    
    // Vérifier s'il y a des périodes qui chevauchent partiellement
    const overlappingPeriods = allPeriods.filter(period => {
      // Normaliser les dates en Europe/Paris sans les secondes
      const normalizeDate = (date: Date, isEndDate: boolean = false): Date => {
        const normalized = new Date(date);
        if (isEndDate) {
          // Pour la fin: mettre à 23:59:00 (sans secondes)
          normalized.setHours(23, 59, 0, 0);
        } else {
          // Pour le début: mettre à 00:00:00 (sans secondes)
          normalized.setHours(0, 0, 0, 0);
        }
        return normalized;
      };
      
      const newPeriodStart = normalizeDate(startDate);
      const newPeriodEnd = normalizeDate(endDate, true);
      const existingPeriodStart = normalizeDate(period.startDate);
      const existingPeriodEnd = normalizeDate(period.endDate, true);
      
      // Vérifier si les périodes sont exactement adjacentes
      // Une journée = 24h * 60min * 60sec * 1000ms = 86400000ms
      const ONE_DAY = 86400000;
      
      // La nouvelle période se termine juste avant l'existante (adjacente)
      const isAdjacentBefore = (existingPeriodStart.getTime() - newPeriodEnd.getTime()) <= ONE_DAY && 
                              (existingPeriodStart.getTime() - newPeriodEnd.getTime()) > 0;
      
      // La nouvelle période commence juste après l'existante (adjacente)
      const isAdjacentAfter = (newPeriodStart.getTime() - existingPeriodEnd.getTime()) <= ONE_DAY && 
                             (newPeriodStart.getTime() - existingPeriodEnd.getTime()) > 0;
      
      // Si les périodes sont adjacentes, pas de chevauchement
      if (isAdjacentBefore || isAdjacentAfter) {
        console.log(`Périodes adjacentes détectées: nouvelle (${newPeriodStart.toLocaleDateString()} - ${newPeriodEnd.toLocaleDateString()}) et existante (${existingPeriodStart.toLocaleDateString()} - ${existingPeriodEnd.toLocaleDateString()})`);
        return false;
      }
      
      // Calculer le chevauchement réel
      const overlapStart = Math.max(newPeriodStart.getTime(), existingPeriodStart.getTime());
      const overlapEnd = Math.min(newPeriodEnd.getTime(), existingPeriodEnd.getTime());
      
      // Il y a chevauchement seulement si overlapStart <= overlapEnd
      const hasOverlap = overlapStart <= overlapEnd;
      
      if (hasOverlap) {
        console.log(`Chevauchement détecté entre ${newPeriodStart.toLocaleDateString()} - ${newPeriodEnd.toLocaleDateString()} et ${existingPeriodStart.toLocaleDateString()} - ${existingPeriodEnd.toLocaleDateString()}`);
      }
      
      return hasOverlap;
    });
    
    // Log pour le débogage
    console.log(`Périodes existantes: ${allPeriods.length}`, 
      allPeriods.map(p => ({
        name: p.name,
        start: p.startDate.toISOString(),
        end: p.endDate.toISOString()
      }))
    );
    console.log(`Nouvelle période: ${startDate.toISOString()} - ${endDate.toISOString()}`);
    console.log(`Périodes chevauchantes détectées: ${overlappingPeriods.length}`, 
      overlappingPeriods.map(p => ({
        name: p.name,
        start: p.startDate.toISOString(),
        end: p.endDate.toISOString()
      }))
    );
    
    if (overlappingPeriods.length > 0) {
      const overlappingPeriodDetails = overlappingPeriods.map(p => 
        `${p.name} (${p.startDate.toLocaleDateString()} - ${p.endDate.toLocaleDateString()})`
      ).join(', ');
      
      throw new Error(`Impossible de créer une période qui chevauche des périodes existantes: ${overlappingPeriodDetails}`);
    }
    
    const today = createParisDate();
    today.setHours(0, 0, 0, 0);
    
    // Générer un nom si non fourni
    const periodName = customName && customName.trim() !== '' ? customName : generatePeriodName(startDate, endDate);
    
    // Créer une ou deux périodes selon les dates
    // Période passée (avant aujourd'hui)
    let pastPeriodId: string | null = null;
    
    // Si la date de début est avant aujourd'hui, créer une période archivée pour les dates passées
    if (startDate < today) {
      // Calculer la date de fin pour la période passée (la veille d'aujourd'hui)
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(today.getDate() - 1);
      
      // Utiliser la date de début réelle des données importées
      // Pas besoin d'étendre artificiellement la période
      const periodStartDate = new Date(startDate);
      
      console.log(`[PERIOD_CREATE] Date de début de période passée: ${periodStartDate.toISOString()}`);
      
      const pastPeriod: Omit<PlanningPeriod, 'id'> = {
        name: `${periodName} - Passé`,
        startDate: periodStartDate,
        endDate: yesterdayDate,
        status: 'archived',
        bagPhase: 'completed',
        isValidated: true,
        validatedAt: today
      };
      
      // Créer la période archivée dans Firebase
      pastPeriodId = await createPlanningPeriod(pastPeriod);
      console.log('Période archivée créée:', pastPeriodId);
    }
    
    // Période future (à partir d'aujourd'hui)
    let futurePeriodId: string | null = null;
    
    if (endDate >= today) {
      // Ajuster la date de début si nécessaire (pour les dates à partir d'aujourd'hui)
      const adjustedStartDate = startDate < today ? today : startDate;
      
      // Déterminer le statut et la phase BAG selon la checkbox
      const status = bagEnabled ? 'future' : 'active';
      const bagPhase = bagEnabled ? 'submission' : 'completed';
      const isValidated = !bagEnabled; // Si BaG désactivée, période validée
      
      const futurePeriod: Omit<PlanningPeriod, 'id'> = {
        name: `${periodName}${pastPeriodId ? ' - Futur' : ''}`,
        startDate: adjustedStartDate,
        endDate: endDate,
        status: status,
        bagPhase: bagPhase,
        isValidated: isValidated,
        validatedAt: isValidated ? today : undefined
      };
      
      // Créer la période future dans Firebase
      futurePeriodId = await createPlanningPeriod(futurePeriod);
      console.log('Période future/active créée:', futurePeriodId);
    }
    
    // Construire les objets période pour les périodes créées
    const returnPeriodId = futurePeriodId || pastPeriodId || '';
    let returnPeriod: PlanningPeriod | null = null;
    
    // Construire l'objet période passée si créée
    let pastPeriodObj: PlanningPeriod | null = null;
    if (pastPeriodId) {
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(today.getDate() - 1);
      
      pastPeriodObj = {
        id: pastPeriodId,
        name: `${periodName} - Passé`,
        startDate: startDate, 
        endDate: yesterdayDate,
        status: 'archived',
        bagPhase: 'completed',
        isValidated: true,
        validatedAt: today
      };
    }
    
    // Construire l'objet période future si créée
    let futurePeriodObj: PlanningPeriod | null = null;
    if (futurePeriodId) {
      futurePeriodObj = {
        id: futurePeriodId,
        name: `${periodName}${pastPeriodId ? ' - Futur' : ''}`,
        startDate: startDate < today ? today : startDate,
        endDate: endDate,
        status: bagEnabled ? 'future' : 'active',
        bagPhase: bagEnabled ? 'submission' : 'completed',
        isValidated: !bagEnabled,
        validatedAt: !bagEnabled ? today : undefined
      };
    }
    
    // Définir la période de retour par défaut (préférer la période future)
    if (futurePeriodObj) {
      returnPeriod = futurePeriodObj;
    } else if (pastPeriodObj) {
      returnPeriod = pastPeriodObj;
    }
    
    // Retourner les informations sur les deux périodes
    return { 
      periodId: returnPeriodId, 
      period: returnPeriod,
      pastPeriodId,
      pastPeriod: pastPeriodObj,
      futurePeriodId,
      futurePeriod: futurePeriodObj
    };
  }, [createPlanningPeriod, allPeriods]);

  /**
   * Trouve une période qui correspond exactement à la plage de dates spécifiée
   */
  const findMatchingPeriod = useCallback((startDate: Date, endDate: Date): PlanningPeriod | undefined => {
    return allPeriods.find(period => 
      period.startDate <= startDate && period.endDate >= endDate
    );
  }, [allPeriods]);

  /**
   * Trouve les périodes avec un chevauchement significatif sur la plage de dates spécifiée
   * @param startDate Date de début
   * @param endDate Date de fin
   * @returns Liste des périodes avec un chevauchement significatif (au moins 50%)
   */
  const findSimilarPeriods = useCallback((startDate: Date, endDate: Date): PlanningPeriod[] => {
    // Calculer la durée de la période en jours
    const periodDuration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Si la période est trop courte, utiliser une durée minimale
    const effectiveDuration = Math.max(periodDuration, 1);
    
    // Trouver les périodes avec un chevauchement significatif (au moins 50% de chevauchement)
    return allPeriods.filter(period => {
      // Calculer les dates de début et de fin du chevauchement
      const overlapStart = new Date(Math.max(startDate.getTime(), period.startDate.getTime()));
      const overlapEnd = new Date(Math.min(endDate.getTime(), period.endDate.getTime()));
      
      // Si pas de chevauchement, retourner false
      if (overlapStart > overlapEnd) return false;
      
      // Calculer la durée du chevauchement en jours
      const overlapDuration = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Calculer le pourcentage de chevauchement par rapport à la période détectée
      const overlapPercentage = (overlapDuration / effectiveDuration) * 100;
      
      // Retourner true si le chevauchement est significatif (au moins 10%)
      return overlapPercentage >= 10;
    });
  }, [allPeriods]);

  return {
    createPeriodFromDateRange,
    findMatchingPeriod,
    findSimilarPeriods
  };
};

export default usePlanningPeriods;