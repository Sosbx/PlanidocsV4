import { addDays, addMonths, format as dateFnsFormat, isWeekend, startOfMonth, Locale } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ShiftPeriod } from '../types/exchange';
import Holidays from 'date-holidays';

// Initialiser la bibliothèque avec les paramètres français (métropole uniquement)
const holidays = new Holidays('FR');

/**
 * Vérifie si une date est un jour férié national français
 * @param date - La date à vérifier
 * @returns true si la date est un jour férié, false sinon
 */
const isHoliday = (date: Date): boolean => {
  // Utiliser la bibliothèque pour vérifier si c'est un jour férié
  const holiday = holidays.isHoliday(date);
  
  // Vérifier si c'est un jour férié national (pas régional)
  if (holiday && Array.isArray(holiday)) {
    return holiday.some(h => h.type === 'public');
  }
  
  return !!holiday;
};

/**
 * Vérifie si une date est un "pont" (jour entre un jour férié et un weekend)
 * @param date - La date à vérifier
 * @returns true si la date est un pont, false sinon
 */
const isBridge = (date: Date): boolean => {
  // Vérifier si c'est un vendredi et si le jeudi est férié
  if (date.getDay() === 5) { // Vendredi
    const thursday = new Date(date);
    thursday.setDate(date.getDate() - 1);
    if (isHoliday(thursday)) {
      return true;
    }
  }
  
  // Vérifier si c'est un lundi et si le mardi est férié
  if (date.getDay() === 1) { // Lundi
    const tuesday = new Date(date);
    tuesday.setDate(date.getDate() + 1);
    if (isHoliday(tuesday)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Vérifie si une date est un jour grisé (weekend, jour férié ou pont)
 * @param date - La date à vérifier
 * @returns true si la date doit être grisée, false sinon
 */
export const isGrayedOut = (date: Date): boolean => {
  return isWeekend(date) || isHoliday(date) || isBridge(date);
};

/**
 * Obtient tous les mois dans une plage de dates
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @returns Un tableau de dates représentant le premier jour de chaque mois
 */
export const getMonthsInRange = (startDate: Date, endDate: Date): Date[] => {
  const months: Date[] = [];
  
  // Obtenir le premier jour du mois de la date de début
  const currentMonth = startOfMonth(new Date(startDate));
  
  // Obtenir le premier jour du mois de la date de fin
  const endMonth = startOfMonth(new Date(endDate));
  
  // Ajouter le premier mois
  months.push(new Date(currentMonth));
  
  // Ajouter les mois suivants jusqu'à atteindre ou dépasser le mois de fin
  while (dateFnsFormat(currentMonth, 'yyyy-MM') !== dateFnsFormat(endMonth, 'yyyy-MM')) {
    // Ajouter un mois
    const nextMonth = addMonths(currentMonth, 1);
    
    // Mettre à jour le mois courant
    currentMonth.setFullYear(nextMonth.getFullYear());
    currentMonth.setMonth(nextMonth.getMonth());
    
    // Ajouter le mois au tableau
    months.push(new Date(currentMonth));
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
  const currentDate = new Date(startDate);
  
  // Ajouter chaque jour jusqu'à atteindre ou dépasser la date de fin
  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
};

/**
 * Formate une période (M, AM, S) en texte lisible
 * @param period - La période à formater
 * @returns La période formatée
 */
export const formatPeriod = (period: string): string => {
  switch (period) {
    case 'M':
      return 'Matin';
    case 'AM':
      return 'Après-midi';
    case 'S':
      return 'Soir';
    default:
      return period;
  }
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
 */
export const normalizePeriod = (period: string): 'M' | 'AM' | 'S' => {
  const normalizedPeriod = period.toUpperCase();
  
  if (normalizedPeriod === 'M' || normalizedPeriod === 'AM' || normalizedPeriod === 'S') {
    return normalizedPeriod as 'M' | 'AM' | 'S';
  }
  
  // Fallback pour les cas non standard
  if (normalizedPeriod.includes('MAT')) return 'M';
  if (normalizedPeriod.includes('APR') || normalizedPeriod.includes('PM')) return 'AM';
  if (normalizedPeriod.includes('SOI') || normalizedPeriod.includes('NUI')) return 'S';
  
  // Valeur par défaut
  return 'M';
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
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      console.error('Date invalide:', date);
      return typeof date === 'string' ? date : date.toString();
    }
    
    // Formater selon le type demandé
    if (formatType === 'short') {
      return dateFnsFormat(dateObj, 'dd/MM/yyyy');
    } else {
      return dateFnsFormat(dateObj, 'EEEE d MMMM yyyy', { locale: fr });
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
 */
export const formatWithCapitalizedMonth = (
  date: Date | string | number,
  formatStr: string,
  options: { locale?: Locale } = { locale: fr }
): string => {
  try {
    // Formater la date avec date-fns
    const formattedDate = dateFnsFormat(date, formatStr, options);
    
    // Capitaliser la première lettre (utile pour les mois en français)
    return formattedDate.replace(/^([a-z])|\s+([a-z])/g, function(match) {
      return match.toUpperCase();
    });
  } catch (error) {
    console.error('Erreur lors du formatage de la date avec mois capitalisé:', error);
    return String(date);
  }
};
