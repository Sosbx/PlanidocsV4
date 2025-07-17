/**
 * Fonctions utilitaires pour la gestion des périodes (M, AM, S)
 */

import type { Period } from './dateHelpers';

// Constantes pour les périodes
export const PERIOD_NAMES = {
  M: 'Matin',
  AM: 'Après-midi', 
  S: 'Soir'
} as const;

export const PERIOD_HOURS = {
  M: { start: '07:00', end: '12:59', startHour: 7, endHour: 13 },
  AM: { start: '13:00', end: '17:59', startHour: 13, endHour: 18 },
  S: { start: '18:00', end: '23:59', startHour: 18, endHour: 24 }
} as const;

export const PERIOD_ORDER = { M: 1, AM: 2, S: 3 } as const;

/**
 * Obtenir le nom d'affichage d'une période
 */
export function getPeriodName(period: Period | string): string {
  const normalizedPeriod = period.toUpperCase() as Period;
  return PERIOD_NAMES[normalizedPeriod] || period;
}

/**
 * Obtenir les horaires d'une période
 */
export function getPeriodHours(period: Period | string) {
  const normalizedPeriod = period.toUpperCase() as Period;
  return PERIOD_HOURS[normalizedPeriod] || null;
}

/**
 * Normaliser une période (gestion des variantes)
 */
export function normalizePeriod(period: string): Period {
  const normalized = period.toUpperCase();
  
  // Vérifier les valeurs standard
  if (normalized === 'M' || normalized === 'AM' || normalized === 'S') {
    return normalized as Period;
  }
  
  // Gérer les variantes
  if (normalized.includes('MAT') || normalized === 'MATIN') return 'M';
  if (normalized.includes('APR') || normalized.includes('PM') || normalized === 'APRES-MIDI') return 'AM';
  if (normalized.includes('SOI') || normalized.includes('NUI') || normalized === 'SOIR') return 'S';
  
  // Par défaut
  return 'M';
}

/**
 * Comparer deux périodes (pour le tri)
 */
export function comparePeriods(period1: Period | string, period2: Period | string): number {
  const p1 = normalizePeriod(period1);
  const p2 = normalizePeriod(period2);
  
  return PERIOD_ORDER[p1] - PERIOD_ORDER[p2];
}

/**
 * Obtenir toutes les périodes dans l'ordre
 */
export function getAllPeriods(): Period[] {
  return ['M', 'AM', 'S'];
}

/**
 * Vérifier si une chaîne est une période valide
 */
export function isValidPeriod(period: string): period is Period {
  return ['M', 'AM', 'S'].includes(period.toUpperCase());
}

/**
 * Obtenir la période suivante
 */
export function getNextPeriod(period: Period): Period | null {
  switch (period) {
    case 'M': return 'AM';
    case 'AM': return 'S';
    case 'S': return null;
    default: return null;
  }
}

/**
 * Obtenir la période précédente
 */
export function getPreviousPeriod(period: Period): Period | null {
  switch (period) {
    case 'M': return null;
    case 'AM': return 'M';
    case 'S': return 'AM';
    default: return null;
  }
}

/**
 * Formater les horaires d'une période pour l'affichage
 */
export function formatPeriodHours(period: Period): string {
  const hours = getPeriodHours(period);
  if (!hours) return '';
  
  return `${hours.start} - ${hours.end}`;
}

/**
 * Obtenir les horaires ICS pour une période (format HHMMSS)
 */
export function getPeriodICSHours(period: Period): { start: string; end: string } {
  switch (period) {
    case 'M':
      return { start: '070000', end: '125900' };
    case 'AM':
      return { start: '130000', end: '175900' };
    case 'S':
      return { start: '180000', end: '235900' };
    default:
      return { start: '000000', end: '235900' };
  }
}