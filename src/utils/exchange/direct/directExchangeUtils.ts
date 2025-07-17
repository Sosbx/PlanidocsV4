import { ShiftPeriod } from '../../../types/exchange';
import { standardizePeriod } from '../../dateUtils';
import { format } from 'date-fns';
import { createParisDate, toParisTime, formatParisDate } from '../../timezoneUtils';

/**
 * Fonction utilitaire pour convertir les chaînes en valeurs d'enum ShiftPeriod
 * @param periodStr Chaîne représentant la période (M, AM, S, etc.)
 * @returns Valeur de l'enum ShiftPeriod correspondante
 */
export const stringToPeriod = (periodStr: string): ShiftPeriod => {
  switch (standardizePeriod(periodStr)) {
    case 'M': return ShiftPeriod.MORNING;
    case 'AM': return ShiftPeriod.AFTERNOON;
    case 'S': return ShiftPeriod.EVENING;
    default: return ShiftPeriod.MORNING; // Valeur par défaut
  }
};

/**
 * Fonction utilitaire pour déterminer la période à partir du timeSlot
 * @param timeSlot Chaîne représentant le créneau horaire
 * @param fallbackPeriod Période à utiliser si le timeSlot ne permet pas de déterminer la période
 * @returns Chaîne standardisée représentant la période (M, AM, S)
 */
export const getPeriodFromTimeSlot = (timeSlot: string, fallbackPeriod?: string): string => {
  if (!timeSlot) {
    return fallbackPeriod ? standardizePeriod(fallbackPeriod) : 'M';
  }
  
  if (timeSlot.includes("07:00") || timeSlot.includes("08:00") || timeSlot.includes("09:00")) {
    return 'M'; // Matin
  } else if (timeSlot.includes("13:00") || timeSlot.includes("14:00")) {
    return 'AM'; // Après-midi
  } else if (timeSlot.includes("18:00") || timeSlot.includes("19:00") || timeSlot.includes("20:00") || timeSlot.includes("20:01")) {
    return 'S'; // Soir
  }
  
  // Si on ne peut pas déterminer à partir du timeSlot, utiliser la valeur par défaut
  return fallbackPeriod ? standardizePeriod(fallbackPeriod) : 'M';
};

/**
 * Fonction utilitaire pour normaliser le format de date en YYYY-MM-DD
 * @param date Date à normaliser (peut être au format JJ/MM/AAAA ou autre)
 * @param fallbackDate Date à utiliser si la normalisation échoue
 * @returns Date au format YYYY-MM-DD
 */
export const normalizeDate = (date: string | Date, fallbackDate?: string): string => {
  try {
    // Si c'est déjà une Date, la formater
    if (date instanceof Date) {
      return formatParisDate(date, 'yyyy-MM-dd');
    }
    
    // Si c'est une chaîne, vérifier si c'est déjà au format YYYY-MM-DD
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      
      // Essayer d'extraire le mois et le jour
      const dateParts = date.split('/');
      if (dateParts.length === 3) {
        // Supposer format JJ/MM/AAAA
        const [day, month, year] = dateParts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Dernier recours: parser avec toParisTime()
      const dateObj = toParisTime(date);
      if (!isNaN(dateObj.getTime())) {
        return formatParisDate(dateObj, 'yyyy-MM-dd');
      }
    }
    
    // Si on arrive ici, la normalisation a échoué
    return fallbackDate || formatParisDate(createParisDate(), 'yyyy-MM-dd');
  } catch (error) {
    console.error(`Erreur lors de la normalisation de la date ${date}:`, error);
    return fallbackDate || formatParisDate(createParisDate(), 'yyyy-MM-dd');
  }
};

/**
 * Fonction utilitaire pour extraire la date et la période d'une clé de garde
 * @param key Clé de garde au format "date-period"
 * @returns Objet contenant la date et la période
 */
export const extractDateAndPeriodFromKey = (key: string): { date: string; period: string } => {
  const [date, periodRaw] = key.split('-');
  return {
    date,
    period: standardizePeriod(periodRaw)
  };
};

/**
 * Fonction utilitaire pour formater une date pour l'affichage
 * @param date Date à formater
 * @param format Format à utiliser (par défaut: dd/MM/yyyy)
 * @returns Date formatée
 */
export const formatDateForDisplay = (date: string | Date, displayFormat = 'dd/MM/yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? toParisTime(date) : toParisTime(date);
    return formatParisDate(dateObj, displayFormat);
  } catch (error) {
    console.error(`Erreur lors du formatage de la date ${date}:`, error);
    return String(date);
  }
};

/**
 * Fonction utilitaire pour formater une période pour l'affichage
 * @param period Période à formater
 * @returns Période formatée
 */
export const formatPeriodForDisplay = (period: string | ShiftPeriod): string => {
  const periodStr = typeof period === 'string' ? period : String(period);
  
  switch (standardizePeriod(periodStr)) {
    case 'M':
      return 'Matin';
    case 'AM':
      return 'Après-midi';
    case 'S':
      return 'Soir';
    default:
      return periodStr;
  }
};
