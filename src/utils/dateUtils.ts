import { format, startOfMonth, eachMonthOfInterval, Locale } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isHoliday, isBridgeDay } from './holidayUtils';
import { ShiftPeriod } from '../types/exchange';

export const getDaysArray = (start: Date, end: Date): Date[] => {
  const arr = [];
  const dt = new Date(start);
  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
};

export const getMonthsInRange = (start: Date, end: Date) => {
  return eachMonthOfInterval({ start, end });
};

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isGrayedOut = (date: Date): boolean => {
  return isWeekend(date) || isHoliday(date) || isBridgeDay(date);
};

/**
 * Formate une date avec le nom du mois commençant par une majuscule
 * @param date La date à formater
 * @param formatString Le format de date (utilisant la syntaxe de date-fns)
 * @param options Options additionnelles pour le formatage
 * @returns La date formatée avec le mois en majuscule
 */
export const formatWithCapitalizedMonth = (
  date: Date | number, 
  formatString: string, 
  options?: { locale?: Locale }
): string => {
  const formatted = format(date, formatString, { locale: fr, ...options });
  
  // Si le format contient un nom de mois (MMMM ou MMM), le mettre en majuscule
  if (formatString.includes('MMMM') || formatString.includes('MMM')) {
    return formatted.replace(/^([a-zà-ü])|(\s)([a-zà-ü])/g, (match, p1, p2, p3) => {
      if (p1) return p1.toUpperCase();
      if (p3) return p2 + p3.toUpperCase();
      return match;
    });
  }
  
  return formatted;
};

// Importer les fonctions améliorées de periodUtils
import { 
  standardizePeriod as standardizePeriodImproved,
  periodToEnum,
  formatPeriodForDisplay
} from './periodUtils';

/**
 * Normalise une période dans le format standardisé (ShiftPeriod enum)
 * @param period La période à normaliser (string, any)
 * @returns La période normalisée (ShiftPeriod)
 */
export const normalizePeriod = (period: unknown): ShiftPeriod => {
  return periodToEnum(period);
};

// Fonction de rétrocompatibilité pour éviter de casser les appels existants
export const standardizePeriod = normalizePeriod;

/**
 * Obtient le texte d'affichage pour une période donnée
 * @param period La période (ShiftPeriod ou string)
 * @returns Le texte formaté pour la période
 */
export const getPeriodDisplayText = (period: ShiftPeriod | string): string => {
  return formatPeriodForDisplay(period);
};

// Fonction de rétrocompatibilité
export const formatPeriod = getPeriodDisplayText;

/**
 * Formate une date pour l'affichage
 * @param dateStr La date au format ISO (YYYY-MM-DD)
 * @param type Le type de formatage (long, medium, short)
 * @returns La date formatée
 */
export const formatDate = (dateStr: string, type: 'long' | 'medium' | 'short' = 'medium'): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    
    switch (type) {
      case 'long':
        return format(date, 'EEEE d MMMM yyyy', { locale: fr }).replace(/^\w/, c => c.toUpperCase());
      case 'medium':
        return format(date, 'd MMMM yyyy', { locale: fr });
      case 'short':
        return format(date, 'dd/MM/yyyy');
      default:
        return format(date, 'd MMMM yyyy', { locale: fr });
    }
  } catch (error) {
    console.error(`Erreur lors du formatage de la date ${dateStr}:`, error);
    return dateStr;
  }
};

/**
 * Formate une date et une période pour l'affichage
 * @param dateStr La date au format ISO (YYYY-MM-DD)
 * @param period La période (ShiftPeriod ou string)
 * @param type Le type de formatage de date (long, medium, short)
 * @returns La date et la période formatées
 */
export const formatDateWithPeriod = (dateStr: string, period: ShiftPeriod | string, type: 'long' | 'medium' | 'short' = 'medium'): string => {
  return `${formatDate(dateStr, type)} (${getPeriodDisplayText(period)})`;
};

/**
 * Standardise une clé de garde au format "date-period"
 * @param key La clé à standardiser
 * @returns La clé standardisée avec la période normalisée
 */
export const standardizeShiftKey = (key: string): string => {
  if (!key || !key.includes('-')) return key;
  
  const [date, periodRaw] = key.split('-');
  const standardizedPeriod = normalizePeriod(periodRaw);
  
  return `${date}-${standardizedPeriod}`;
};
