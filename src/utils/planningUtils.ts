import { getDaysArray } from './dateUtils';
import type { Selections } from '../types/planning';

export const calculatePercentages = (
  selections: Selections,
  startDate: Date,
  endDate: Date
) => {
  const days = getDaysArray(startDate, endDate);
  const totalSlots = days.length * 3; // 3 periods per day
  
  const primaryCount = Object.values(selections).filter(v => v.type === 'primary').length;
  const secondaryCount = Object.values(selections).filter(v => v.type === 'secondary').length;
  
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
  limit: number
) => {
  const { primary, secondary } = calculatePercentages(selections, startDate, endDate);
  return type === 'primary' ? primary > limit : secondary > limit;
};