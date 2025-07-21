import { addDays, addMonths, isWeekend, startOfMonth } from 'date-fns';
import { startOfMonthParis, addMonthsParis } from '@/utils/timezoneUtils';
import { ShiftPeriod } from '../types/exchange';
import { isHoliday as checkHoliday, isBridgeDay } from './holidayUtils';
import { parseParisDate, formatParisDate, toParisTime, createParisDate } from './timezoneUtils';
import { formatDateCapitalized } from './dates/dateHelpers';
import { normalizePeriod as normalizePeriodHelper, getPeriodName } from './dates/periodHelpers';
import { frLocale as fr } from './dateLocale';

/**
 * Vérifie si une date est un jour férié national français
 * @param date - La date à vérifier
 * @returns true si la date est un jour férié, false sinon
 */
const isHoliday = (date: Date): boolean => {
  return checkHoliday(date);
};

/**
 * Vérifie si une date est un "pont" (jour entre un jour férié et un weekend)
 * @param date - La date à vérifier
 * @returns true si la date est un pont, false sinon
 */
const isBridge = (date: Date): boolean => {
  return isBridgeDay(date);
};

/**
 * Vérifie si une date est un jour grisé (weekend, jour férié ou pont)
 * @param date - La date à vérifier
 * @returns true si la date doit être grisée, false sinon
 */
export const isGrayedOut = (date: Date): boolean => {
  const parisDate = toParisTime(date);
  return isWeekend(parisDate) || isHoliday(parisDate) || isBridge(parisDate);
};

/**
 * Obtient tous les mois dans une plage de dates
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @returns Un tableau de dates représentant le premier jour de chaque mois
 */
export const getMonthsInRange = (startDate: Date, endDate: Date): Date[] => {
  const months: Date[] = [];
  
  // Convertir en Europe/Paris dès le début
  let currentMonth = startOfMonthParis(toParisTime(startDate));
  const endMonth = startOfMonthParis(toParisTime(endDate));
  
  // Ajouter tous les mois jusqu'à la fin
  while (currentMonth <= endMonth) {
    // Créer une nouvelle instance pour éviter les mutations
    months.push(toParisTime(new Date(currentMonth)));
    // Passer au mois suivant sans muter currentMonth
    currentMonth = addMonthsParis(currentMonth, 1);
  }
  
  return months;
};

/**
 * Obtient un tableau de dates pour tous les jours dans une plage de dates
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @returns Un tableau de dates pour chaque jour dans la plage
 */
export const getDaysArray = (startDate: Date, endDate: Date): Date[] => {
  const days: Date[] = [];
  let currentDate = toParisTime(startDate);
  const end = toParisTime(endDate);
  
  // Réinitialiser les heures pour éviter les problèmes de comparaison
  currentDate.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Ajouter chaque jour jusqu'à atteindre la date de fin (incluse)
  while (currentDate <= end) {
    days.push(toParisTime(currentDate));
    // Utiliser addDays pour éviter les problèmes de mutation et de changement d'heure
    currentDate = addDays(currentDate, 1);
  }
  
  return days;
};

/**
 * Formate une période (M, AM, S) en texte lisible
 * @param period - La période à formater
 * @returns La période formatée
 * @deprecated Utiliser getPeriodName depuis dates/periodHelpers
 */
export const formatPeriod = (period: string): string => {
  // Utiliser directement getPeriodName qui est déjà importé en haut du fichier
  return getPeriodName(period);
};

/**
 * Obtient le texte d'affichage pour une période
 * @param period - La période (M, AM, S ou ShiftPeriod)
 * @returns Le texte d'affichage de la période
 */
export const getPeriodDisplayText = (period: string | ShiftPeriod): string => {
  let normalizedPeriod: string;
  
  // Si c'est un ShiftPeriod, le convertir en chaîne
  if (typeof period !== 'string') {
    switch (period) {
      case ShiftPeriod.MORNING:
        normalizedPeriod = 'M';
        break;
      case ShiftPeriod.AFTERNOON:
        normalizedPeriod = 'AM';
        break;
      case ShiftPeriod.EVENING:
        normalizedPeriod = 'S';
        break;
      default:
        normalizedPeriod = 'M';
    }
  } else {
    normalizedPeriod = period;
  }
  
  // Utiliser formatPeriod pour obtenir le texte d'affichage
  return formatPeriod(normalizedPeriod);
};

/**
 * Normalise une période pour assurer la cohérence
 * @param period - La période à normaliser
 * @returns La période normalisée
 * @deprecated Utiliser normalizePeriod depuis dates/periodHelpers
 */
export const normalizePeriod = (period: string): 'M' | 'AM' | 'S' => {
  return normalizePeriodHelper(period);
};

/**
 * Formate une date selon le format spécifié
 * @param date - La date à formater (chaîne au format YYYY-MM-DD ou objet Date)
 * @param formatType - Le type de format ('short' pour JJ/MM/YYYY, 'long' pour format complet)
 * @returns La date formatée
 */
export const formatDate = (date: string | Date, formatType: 'short' | 'long' = 'short'): string => {
  try {
    // Convertir en objet Date si c'est une chaîne
    const dateObj = typeof date === 'string' ? parseParisDate(date) : toParisTime(date);
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      console.error('Date invalide:', date);
      return typeof date === 'string' ? date : date.toString();
    }
    
    // Formater selon le type demandé
    if (formatType === 'short') {
      return formatParisDate(dateObj, 'dd/MM/yyyy');
    } else {
      return formatParisDate(dateObj, 'EEEE d MMMM yyyy', { locale: fr });
    }
  } catch (error) {
    console.error('Erreur lors du formatage de la date:', error);
    return typeof date === 'string' ? date : date.toString();
  }
};

/**
 * Formate une date avec la première lettre du mois en majuscule
 * @param date - La date à formater
 * @param formatStr - Le format à utiliser (comme dans date-fns)
 * @param options - Options supplémentaires pour le formatage
 * @returns La date formatée avec le mois capitalisé
 * @deprecated Utiliser formatDateCapitalized depuis dates/dateHelpers
 */
export const formatWithCapitalizedMonth = (
  date: Date | string | number,
  formatStr: string,
  options: { locale?: any } = { locale: fr }
): string => {
  return formatDateCapitalized(date, formatStr);
};

/**
 * Parse une date au format YYYY-MM-DD en temps local
 * Évite les problèmes de décalage de fuseau horaire lors de la conversion
 * @param dateString - La date au format YYYY-MM-DD
 * @returns Un objet Date en temps local
 */
export const parseLocalDate = (dateString: string): Date => {
  // Utiliser la fonction de parsing qui force le fuseau horaire Europe/Paris
  return parseParisDate(dateString);
};
