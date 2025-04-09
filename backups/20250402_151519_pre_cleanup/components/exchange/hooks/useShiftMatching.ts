import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { standardizePeriod, arePeriodsEquivalent } from '../../../utils/periodUtils';
import { ShiftAssignment } from '../../../types/planning';
import { ShiftMatchingResult, FormattedShift } from '../types/exchangeTypes';

/**
 * Hook pour gérer la correspondance entre les gardes proposées et les gardes disponibles
 */
export const useShiftMatching = (userAssignments: Record<string, ShiftAssignment>) => {
  const [matchingLogs, setMatchingLogs] = useState<string[]>([]);

  /**
   * Ajoute un log à la liste des logs de correspondance
   */
  const addLog = useCallback((message: string, data?: any) => {
    setMatchingLogs(prev => [...prev, message]);
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }, []);

  /**
   * Formate les gardes de l'utilisateur pour l'échange
   */
  const formatUserShiftsForExchange = useCallback(() => {
    const formattedShifts: FormattedShift[] = [];

    Object.entries(userAssignments || {})
      .filter(([key, assignment]) => {
        // Vérifier si l'assignment existe et a une date
        if (!assignment || !assignment.date) return false;
        
        // Exclure les gardes passées
        const today = new Date();
        try {
          const shiftDate = new Date(assignment.date);
          return shiftDate >= today;
        } catch (error) {
          console.error('Error parsing date:', error);
          return false;
        }
      })
      .forEach(([originalKey, assignment], index) => {
        // S'assurer que assignment.period ou assignment.type existe
        const periodValue = assignment.period || assignment.type || 'M';
        
        // Standardiser la période de l'assignment pour assurer la cohérence
        const standardizedPeriod = standardizePeriod(periodValue);
        
        // Créer une copie de l'assignment avec la période standardisée
        const standardizedAssignment = {
          ...assignment,
          period: standardizedPeriod as 'M' | 'AM' | 'S',
          // Ajout d'un identifiant unique pour ce composant
          tempUniqueId: `${originalKey}_${index}`
        };
        
        addLog(`Garde disponible pour échange - Clé originale: ${originalKey}, Période standardisée: ${periodValue} -> ${standardizedPeriod}`);
        
        formattedShifts.push({
          key: originalKey, // Garder la clé originale
          originalKey, // Conserver la clé originale pour référence
          assignment: standardizedAssignment
        });
      });

    return formattedShifts;
  }, [userAssignments, addLog]);

  /**
   * Trouve les correspondances entre les gardes proposées et les gardes disponibles
   */
  const findMatchingShifts = useCallback((proposedShifts: Array<{
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }>): ShiftMatchingResult => {
    addLog("DÉBUT DE LA RECHERCHE DE CORRESPONDANCES POUR LES GARDES");
    addLog(`Gardes proposées: ${proposedShifts.length}`);
    addLog(`Gardes disponibles: ${Object.keys(userAssignments).length}`);
    
    // Créer un index des gardes disponibles pour une recherche plus efficace
    const availableShiftsIndex = new Map<string, {
      key: string;
      assignment: ShiftAssignment;
      shiftType: string;
      timeSlot: string;
      originalPeriod: string; // Ajout de la période originale pour le débogage
      standardizedPeriod: string; // Ajout de la période standardisée pour le débogage
    }[]>();
    
    // Indexer toutes les gardes disponibles par date et période pour une recherche plus rapide
    Object.entries(userAssignments).forEach(([key, assignment]) => {
      if (!assignment || !assignment.date) return;
      
      try {
        const periodValue = assignment.period || assignment.type || 'M';
        const assignmentPeriod = standardizePeriod(periodValue);
        const assignmentDate = format(new Date(assignment.date), 'yyyy-MM-dd');
        
        // Créer une clé composite pour l'index
        const indexKey = `${assignmentDate}|${assignmentPeriod}`;
        
        // Stocker la référence dans l'index
        if (!availableShiftsIndex.has(indexKey)) {
          availableShiftsIndex.set(indexKey, []);
        }
        availableShiftsIndex.get(indexKey)?.push({
          key,
          assignment,
          shiftType: assignment.shiftType || '',
          timeSlot: assignment.timeSlot || '',
          originalPeriod: periodValue, // Stocker la période originale
          standardizedPeriod: assignmentPeriod // Stocker la période standardisée
        });
        
        addLog(`Garde indexée: ${key} - Date: ${assignmentDate}, Période originale: ${periodValue}, Période standardisée: ${assignmentPeriod}, Type: ${assignment.shiftType}, TimeSlot: ${assignment.timeSlot}`);
        
        // Créer un index secondaire avec la période originale pour les cas où la standardisation échoue
        const secondaryIndexKey = `${assignmentDate}|${periodValue}`;
        if (secondaryIndexKey !== indexKey) {
          if (!availableShiftsIndex.has(secondaryIndexKey)) {
            availableShiftsIndex.set(secondaryIndexKey, []);
          }
          availableShiftsIndex.get(secondaryIndexKey)?.push({
            key,
            assignment,
            shiftType: assignment.shiftType || '',
            timeSlot: assignment.timeSlot || '',
            originalPeriod: periodValue,
            standardizedPeriod: assignmentPeriod
          });
          
          addLog(`Garde indexée (secondaire): ${key} - Date: ${assignmentDate}, Période originale: ${periodValue}, Période standardisée: ${assignmentPeriod}`);
        }
      } catch (e) {
        console.error('⚠️ Erreur lors de l\'indexation de la garde:', e);
      }
    });
    
    const matchedKeys: string[] = [];
    const matchDetails: ShiftMatchingResult['matchDetails'] = [];
    
    // Pour chaque garde proposée
    proposedShifts.forEach((proposedShift, index) => {
      addLog(`\nAnalyse de la garde proposée #${index + 1}:`, proposedShift);
      
      if (!proposedShift.date || !proposedShift.period) {
        addLog('⚠️ Garde proposée incomplète');
        return;
      }
      
      // Standardiser la période de la garde proposée
      const proposedPeriod = standardizePeriod(proposedShift.period);
      addLog(`Période standardisée: ${proposedShift.period} -> ${proposedPeriod}`);
      
      // Normaliser la date de la garde proposée
      let proposedDateNormalized;
      try {
        proposedDateNormalized = format(new Date(proposedShift.date), 'yyyy-MM-dd');
        addLog(`Date normalisée: ${proposedShift.date} -> ${proposedDateNormalized}`);
      } catch (e) {
        console.error('⚠️ Erreur lors de la normalisation de la date proposée:', e);
        return;
      }
      
      // Rechercher d'abord une correspondance exacte dans l'index
      const exactMatchKey = `${proposedDateNormalized}|${proposedPeriod}`;
      const exactMatches = availableShiftsIndex.get(exactMatchKey);
      
      // Rechercher également avec la période originale non standardisée
      const originalPeriodMatchKey = `${proposedDateNormalized}|${proposedShift.period}`;
      const originalPeriodMatches = availableShiftsIndex.get(originalPeriodMatchKey);
      
      // Combiner les résultats des deux recherches
      const combinedMatches = [
        ...(exactMatches || []),
        ...(originalPeriodMatches || []).filter(match => 
          // Éviter les doublons
          !exactMatches?.some(exactMatch => exactMatch.key === match.key)
        )
      ];
      
      addLog(`Recherche de correspondances - Clé exacte: ${exactMatchKey}, Clé originale: ${originalPeriodMatchKey}`);
      addLog(`Correspondances trouvées - Exactes: ${exactMatches?.length || 0}, Originales: ${originalPeriodMatches?.length || 0}, Combinées: ${combinedMatches.length}`);
      
      if (combinedMatches.length > 0) {
        // Trouver la meilleure correspondance parmi les gardes trouvées
        let bestMatch = combinedMatches[0];
        let bestScore = 0;
        
        for (const match of combinedMatches) {
          // Calculer un score de correspondance
          let score = 0;
          
          // Points pour la correspondance de période
          if (match.standardizedPeriod === proposedPeriod) {
            score += 10; // Correspondance de période standardisée
          } else if (match.originalPeriod === proposedShift.period) {
            score += 8; // Correspondance de période originale
          } else if (arePeriodsEquivalent(match.originalPeriod, proposedShift.period)) {
            score += 6; // Périodes équivalentes
          }
          
          // Ajouter des points pour le type de garde
          if (match.shiftType === proposedShift.shiftType) {
            score += 3;
          }
          
          // Ajouter des points pour le timeSlot
          if (match.timeSlot === proposedShift.timeSlot) {
            score += 2;
          }
          
          addLog(`Évaluation de la correspondance - Clé: ${match.key}, Score: ${score}, Période originale: ${match.originalPeriod}, Période standardisée: ${match.standardizedPeriod}`);
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }
        
        addLog(`✅ CORRESPONDANCE TROUVÉE: ${proposedDateNormalized} ${proposedPeriod} -> ${bestMatch.key} (score: ${bestScore})`);
        
        if (!matchedKeys.includes(bestMatch.key)) {
          matchedKeys.push(bestMatch.key);
          
          // Ajouter les détails de la correspondance
          matchDetails.push({
            proposedShift,
            matchedKey: bestMatch.key,
            score: bestScore,
            matchType: bestScore >= 10 ? 'exact' : 'partial'
          });
        }
      } else {
        addLog(`Aucune correspondance trouvée pour ${exactMatchKey}, recherche de correspondances par date uniquement...`);
        
        // Si pas de correspondance, rechercher par date uniquement
        let bestPartialMatch: string | null = null;
        let bestPartialScore = 0;
        
        // Parcourir toutes les gardes disponibles pour trouver des correspondances partielles
        for (const [indexKey, shifts] of availableShiftsIndex.entries()) {
          const [indexDate, indexPeriod] = indexKey.split('|');
          
          if (indexDate === proposedDateNormalized) {
            // Correspondance de date trouvée
            for (const shift of shifts) {
              // Calculer un score pour cette correspondance partielle
              let score = 5; // Score de base pour la date
              
              // Ajouter des points si la période est proche
              if (arePeriodsEquivalent(shift.originalPeriod, proposedShift.period)) {
                score += 3;
              }
              
              // Ajouter des points pour le type de garde
              if (shift.shiftType === proposedShift.shiftType) {
                score += 2;
              }
              
              addLog(`Évaluation de correspondance partielle - Clé: ${shift.key}, Score: ${score}`);
              
              if (score > bestPartialScore) {
                bestPartialScore = score;
                bestPartialMatch = shift.key;
              }
            }
          }
        }
        
        if (bestPartialMatch) {
          addLog(`⚠️ CORRESPONDANCE PARTIELLE TROUVÉE: ${proposedDateNormalized} -> ${bestPartialMatch} (score: ${bestPartialScore})`);
          
          if (!matchedKeys.includes(bestPartialMatch)) {
            matchedKeys.push(bestPartialMatch);
            
            // Ajouter les détails de la correspondance
            matchDetails.push({
              proposedShift,
              matchedKey: bestPartialMatch,
              score: bestPartialScore,
              matchType: 'partial'
            });
          }
        } else {
          addLog(`❌ Aucune correspondance trouvée pour la garde: ${proposedDateNormalized} ${proposedPeriod}`);
          
          // Ajouter les détails de l'échec de correspondance
          matchDetails.push({
            proposedShift,
            matchedKey: '',
            score: 0,
            matchType: 'none'
          });
        }
      }
    });
    
    addLog(`RÉSULTAT FINAL - Gardes correspondantes: ${matchedKeys.join(', ')}`);
    
    return {
      matchedKeys,
      matchDetails
    };
  }, [userAssignments, addLog]);

  return {
    formatUserShiftsForExchange,
    findMatchingShifts,
    matchingLogs
  };
};

export default useShiftMatching;
