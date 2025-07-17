/**
 * Fonctions utilitaires pour la manipulation des dates
 * Toutes les dates sont gérées en Europe/Paris
 */

import { formatParisDate, parseParisDate, toParisTime, createParisDate } from '../timezoneUtils';
import { frLocale } from '../dateLocale';
import { DATE_FORMATS } from './dateFormats';

// Types
export type Period = 'M' | 'AM' | 'S';
export type DateInput = Date | string | number;

export interface CellKeyData {
  date: string;
  period: Period;
}

/**
 * Parser et valider une clé de cellule au format YYYY-MM-DD-PERIOD
 */
export function parseCellKey(cellKey: string): CellKeyData | null {
  const parts = cellKey.split('-');
  if (parts.length !== 4) return null;
  
  const dateStr = parts.slice(0, 3).join('-');
  const period = parts[3] as Period;
  
  // Valider le format de date
  if (!isValidDateString(dateStr)) return null;
  
  // Valider la période
  if (!['M', 'AM', 'S'].includes(period)) return null;
  
  return { date: dateStr, period };
}

/**
 * Créer une clé pour les assignments/échanges
 */
export function createDatePeriodKey(date: DateInput, period: string): string {
  const dateStr = typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/) 
    ? date 
    : formatParisDate(date, DATE_FORMATS.ISO_DATE);
  
  return `${dateStr}-${period}`;
}

/**
 * Vérifier si une chaîne est une date valide au format YYYY-MM-DD
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  // Vérifier que la date est valide
  const date = parseParisDate(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Formater une date avec la première lettre du mois/jour en majuscule
 */
export function formatDateCapitalized(date: DateInput, format: string): string {
  const formatted = formatParisDate(date, format, { locale: frLocale });
  
  // Capitaliser la première lettre et après les espaces
  return formatted.replace(/^([a-z])|\s+([a-z])/g, (match) => match.toUpperCase());
}

/**
 * Obtenir un format de date prédéfini avec capitalisation
 */
export function formatDateAs(
  date: DateInput, 
  type: 'short' | 'medium' | 'long' | 'withTime' | 'file'
): string {
  let format: string;
  
  switch (type) {
    case 'short':
      format = DATE_FORMATS.SHORT_DATE_MONTH;
      break;
    case 'medium':
      format = DATE_FORMATS.MEDIUM_DATE;
      break;
    case 'long':
      format = DATE_FORMATS.LONG_DATE;
      break;
    case 'withTime':
      format = DATE_FORMATS.DATE_WITH_TIME;
      break;
    case 'file':
      format = DATE_FORMATS.FILE_DATE;
      break;
    default:
      format = DATE_FORMATS.ISO_DATE;
  }
  
  return formatDateCapitalized(date, format);
}

/**
 * Convertir une date pour l'export avec le bon format
 */
export function formatDateForExport(
  date: DateInput, 
  exportType: 'pdf' | 'excel' | 'csv' | 'ics'
): string {
  switch (exportType) {
    case 'pdf':
      return formatParisDate(date, DATE_FORMATS.EXPORT_PDF, { locale: frLocale });
    case 'excel':
      return formatParisDate(date, DATE_FORMATS.EXPORT_EXCEL);
    case 'csv':
      return formatParisDate(date, DATE_FORMATS.EXPORT_CSV);
    case 'ics':
      return formatParisDate(date, DATE_FORMATS.EXPORT_ICS_DATE);
    default:
      return formatParisDate(date, DATE_FORMATS.ISO_DATE);
  }
}

/**
 * Extraire le mois et l'année d'une date pour l'affichage
 */
export function getMonthYearDisplay(date: DateInput): string {
  return formatDateCapitalized(date, DATE_FORMATS.MONTH_YEAR);
}

/**
 * Obtenir une date à partir d'une clé de cellule
 */
export function getDateFromCellKey(cellKey: string): Date | null {
  const parsed = parseCellKey(cellKey);
  if (!parsed) return null;
  
  return parseParisDate(parsed.date);
}

/**
 * Normaliser une date en string au format ISO
 */
export function normalizeDateString(date: DateInput): string {
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }
  return formatParisDate(date, DATE_FORMATS.ISO_DATE);
}

/**
 * Créer une date sûre (gestion des erreurs intégrée)
 */
export function safeCreateDate(date?: DateInput | null): Date {
  if (!date) return createParisDate();
  
  try {
    const result = typeof date === 'string' ? parseParisDate(date) : toParisTime(date);
    if (isNaN(result.getTime())) {
      console.warn('Date invalide fournie:', date);
      return createParisDate();
    }
    return result;
  } catch (error) {
    console.error('Erreur lors de la création de la date:', error);
    return createParisDate();
  }
}