/**
 * Fonctions de comparaison de dates simplifiées
 * Toutes les comparaisons sont faites en Europe/Paris
 */

import { toParisTime, isSameParisDay, formatParisDate, createParisDate } from '../timezoneUtils';
import { startOfDayParis, endOfDayParis } from '@/utils/timezoneUtils';
import { startOfDay, endOfDay, differenceInDays, isAfter, isBefore } from 'date-fns';
import type { DateInput } from './dateHelpers';

/**
 * Vérifier si une date est aujourd'hui
 */
export function isToday(date: DateInput): boolean {
  return isSameParisDay(date, createParisDate());
}

/**
 * Vérifier si une date est dans le passé (avant aujourd'hui minuit)
 */
export function isPastDate(date: DateInput): boolean {
  const dateObj = toParisTime(date);
  const today = createParisDate();
  
  // Comparer au début de la journée actuelle
  const todayStart = startOfDayParis(today);
  return isBefore(dateObj, todayStart);
}

/**
 * Vérifier si une date est dans le futur (après aujourd'hui 23h59)
 */
export function isFutureDate(date: DateInput): boolean {
  const dateObj = toParisTime(date);
  const today = createParisDate();
  
  // Comparer à la fin de la journée actuelle
  const todayEnd = endOfDayParis(today);
  return isAfter(dateObj, todayEnd);
}

/**
 * Vérifier si deux dates sont le même jour
 */
export function isSameDay(date1: DateInput, date2: DateInput): boolean {
  return isSameParisDay(date1, date2);
}

/**
 * Obtenir la différence en jours entre deux dates
 */
export function getDaysDifference(date1: DateInput, date2: DateInput): number {
  const d1 = toParisTime(date1);
  const d2 = toParisTime(date2);
  
  return differenceInDays(d1, d2);
}

/**
 * Vérifier si une date est entre deux autres dates (inclus)
 */
export function isDateBetween(
  date: DateInput, 
  startDate: DateInput, 
  endDate: DateInput,
  inclusive: boolean = true
): boolean {
  const d = toParisTime(date);
  const start = toParisTime(startDate);
  const end = toParisTime(endDate);
  
  if (inclusive) {
    return d >= start && d <= end;
  } else {
    return d > start && d < end;
  }
}

/**
 * Vérifier si une date est un jour de weekend
 */
export function isWeekendDate(date: DateInput): boolean {
  const d = toParisTime(date);
  const dayOfWeek = d.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Dimanche = 0, Samedi = 6
}

/**
 * Comparer deux dates (pour le tri)
 * Retourne -1 si date1 < date2, 0 si égales, 1 si date1 > date2
 */
export function compareDates(date1: DateInput, date2: DateInput): number {
  const d1 = toParisTime(date1);
  const d2 = toParisTime(date2);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Obtenir la date la plus ancienne d'un tableau
 */
export function getEarliestDate(dates: DateInput[]): Date | null {
  if (!dates || dates.length === 0) return null;
  
  const parsedDates = dates.map(d => toParisTime(d));
  return parsedDates.reduce((earliest, current) => 
    current < earliest ? current : earliest
  );
}

/**
 * Obtenir la date la plus récente d'un tableau
 */
export function getLatestDate(dates: DateInput[]): Date | null {
  if (!dates || dates.length === 0) return null;
  
  const parsedDates = dates.map(d => toParisTime(d));
  return parsedDates.reduce((latest, current) => 
    current > latest ? current : latest
  );
}

/**
 * Vérifier si deux dates sont dans le même mois
 */
export function isSameMonth(date1: DateInput, date2: DateInput): boolean {
  const d1 = toParisTime(date1);
  const d2 = toParisTime(date2);
  
  return d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth();
}

/**
 * Vérifier si deux dates sont dans la même année
 */
export function isSameYear(date1: DateInput, date2: DateInput): boolean {
  const d1 = toParisTime(date1);
  const d2 = toParisTime(date2);
  
  return d1.getFullYear() === d2.getFullYear();
}