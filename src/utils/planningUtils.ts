import { getDaysArray } from './dateUtils';
import type { Selections } from '../types/planning';

export const calculatePercentages = (
  selections: Selections,
  startDate: Date,
  endDate: Date,
  currentPeriodOnly: boolean = true
) => {
  // Logs pour déboguer
  console.log('calculatePercentages: selections reçues:', selections);
  console.log('calculatePercentages: type de selections:', typeof selections);
  
  const days = getDaysArray(startDate, endDate);
  const totalSlots = days.length * 3; // 3 periods per day
  
  // Générer les clés de date pour la période actuelle (format: YYYY-MM-DD-PERIOD)
  const currentPeriodKeys = new Set<string>();
  if (currentPeriodOnly) {
    days.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      ['M', 'AM', 'S'].forEach(period => {
        currentPeriodKeys.add(`${dateStr}-${period}`);
      });
    });
  }
  
  // Filtrer les sélections pour ne prendre en compte que celles de la période actuelle si nécessaire
  const filteredSelections = currentPeriodOnly
    ? Object.entries(selections).reduce((acc, [key, value]) => {
        if (currentPeriodKeys.has(key)) {
          acc[key] = value;
        }
        return acc;
      }, {} as Selections)
    : selections;
  
  console.log('calculatePercentages: selections filtrées:', filteredSelections);
  
  // Vérifier le format des sélections
  if (Object.keys(filteredSelections).length > 0) {
    const firstKey = Object.keys(filteredSelections)[0];
    console.log('calculatePercentages: exemple de sélection:', firstKey, filteredSelections[firstKey]);
    console.log('calculatePercentages: type de la première sélection:', 
      filteredSelections[firstKey]?.type, 
      'est-ce un objet?', typeof filteredSelections[firstKey] === 'object'
    );
  }
  
  const primaryCount = Object.values(filteredSelections).filter(v => v.type === 'primary').length;
  const secondaryCount = Object.values(filteredSelections).filter(v => v.type === 'secondary').length;
  
  console.log('calculatePercentages: comptage:', { primaryCount, secondaryCount, totalSlots });
  
  return {
    primary: (primaryCount / totalSlots) * 100,
    secondary: (secondaryCount / totalSlots) * 100
  };
};

export const wouldExceedLimit = (
  selections: Selections,
  startDate: Date,
  endDate: Date,
  type: 'primary' | 'secondary',
  limit: number,
  currentPeriodOnly: boolean = true
) => {
  const { primary, secondary } = calculatePercentages(selections, startDate, endDate, currentPeriodOnly);
  return type === 'primary' ? primary > limit : secondary > limit;
};
