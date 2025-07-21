/**
 * Utilitaire centralisé pour la gestion des fuseaux horaires
 * Force l'utilisation du fuseau horaire Europe/Paris pour toute l'application
 */

import { format as dateFnsFormat, parse as dateFnsParse, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// Utiliser le constructeur Date original si disponible (pour éviter la récursion avec dateConfig)
const DateConstructor = (window as any).OriginalDate || Date;

// Fuseau horaire cible pour toute l'application
export const TARGET_TIMEZONE = 'Europe/Paris';

/**
 * Convertit une date quelconque en date dans le fuseau horaire Europe/Paris
 * @param date Date à convertir (peut être string, number, Date ou undefined)
 * @returns Date convertie en Europe/Paris
 */
export function toParisTime(date?: Date | string | number | null): Date {
  if (!date) {
    // Si pas de date fournie, retourner la date actuelle en Europe/Paris
    return toZonedTime(new DateConstructor(), TARGET_TIMEZONE);
  }
  
  // Convertir en objet Date si nécessaire
  const dateObj = date instanceof Date ? date : new DateConstructor(date);
  
  // Vérifier si la date est valide
  if (isNaN(dateObj.getTime())) {
    console.error('Date invalide fournie à toParisTime:', date);
    return toZonedTime(new DateConstructor(), TARGET_TIMEZONE);
  }
  
  // Convertir en fuseau horaire Europe/Paris
  return toZonedTime(dateObj, TARGET_TIMEZONE);
}

/**
 * Crée une nouvelle date dans le fuseau horaire Europe/Paris
 * Remplace new Date() dans le code
 * @param args Arguments pour créer une date (année, mois, jour, etc.)
 * @returns Date en Europe/Paris
 */
export function createParisDate(...args: any[]): Date {
  if (args.length === 0) {
    // Pas d'arguments : retourner la date actuelle en Europe/Paris
    return toParisTime(new DateConstructor());
  }
  
  if (args.length === 1) {
    // Un seul argument : peut être string, number ou Date
    return toParisTime(args[0]);
  }
  
  // Plusieurs arguments : année, mois, jour, etc.
  // Créer une date avec ces valeurs dans le fuseau Europe/Paris
  const [year, month = 0, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0] = args;
  
  // Créer une date "naive" avec ces valeurs
  const naiveDate = new DateConstructor(year, month, day, hours, minutes, seconds, ms);
  
  // La convertir depuis Europe/Paris vers UTC
  return fromZonedTime(naiveDate, TARGET_TIMEZONE);
}

/**
 * Parse une date string en forçant le fuseau horaire Europe/Paris
 * @param dateString String de date au format YYYY-MM-DD ou objet Date
 * @returns Date en Europe/Paris
 */
export function parseParisDate(dateString: string | Date): Date {
  // Si c'est déjà une Date, la retourner directement
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Vérifier que c'est une string
  if (typeof dateString !== 'string') {
    console.error('parseParisDate: entrée invalide (ni string ni Date):', dateString);
    return toParisTime(new DateConstructor());
  }
  
  if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.error('Format de date invalide:', dateString);
    return toParisTime(new DateConstructor());
  }
  
  // Parser la date et la considérer comme étant en Europe/Paris
  const [year, month, day] = dateString.split('-').map(Number);
  return createParisDate(year, month - 1, day, 12, 0, 0, 0); // Midi pour éviter les problèmes DST
}

/**
 * Formate une date en utilisant le fuseau horaire Europe/Paris
 * @param date Date à formater
 * @param formatStr Format de sortie (compatible date-fns)
 * @param options Options de formatage
 * @returns String formatée
 */
export function formatParisDate(
  date: Date | string | number, 
  formatStr: string, 
  options?: { locale?: any }
): string {
  const dateObj = date instanceof Date ? date : new DateConstructor(date);
  
  if (isNaN(dateObj.getTime())) {
    console.error('Date invalide fournie à formatParisDate:', date);
    return '';
  }
  
  // Utiliser formatInTimeZone pour formater dans le bon fuseau horaire
  return formatInTimeZone(dateObj, TARGET_TIMEZONE, formatStr, {
    locale: options?.locale || fr
  });
}

/**
 * Obtient le début de la journée en Europe/Paris
 * @param date Date de référence
 * @returns Début de journée en Europe/Paris
 */
export function startOfParisDay(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const start = startOfDay(parisDate);
  return fromZonedTime(start, TARGET_TIMEZONE);
}

/**
 * Obtient la fin de la journée en Europe/Paris
 * @param date Date de référence
 * @returns Fin de journée en Europe/Paris
 */
export function endOfParisDay(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const end = endOfDay(parisDate);
  return fromZonedTime(end, TARGET_TIMEZONE);
}

/**
 * Compare deux dates en tenant compte du fuseau horaire Europe/Paris
 * @param date1 Première date
 * @param date2 Deuxième date
 * @returns -1 si date1 < date2, 0 si égales, 1 si date1 > date2
 */
export function compareParisDate(
  date1: Date | string | number, 
  date2: Date | string | number
): number {
  const paris1 = toParisTime(date1);
  const paris2 = toParisTime(date2);
  
  if (paris1 < paris2) return -1;
  if (paris1 > paris2) return 1;
  return 0;
}

/**
 * Obtient la date actuelle en Europe/Paris au format YYYY-MM-DD
 * @returns String de date
 */
export function getCurrentParisDateString(): string {
  return formatParisDate(new DateConstructor(), 'yyyy-MM-dd');
}

/**
 * Vérifie si deux dates sont le même jour en Europe/Paris
 * @param date1 Première date
 * @param date2 Deuxième date
 * @returns true si même jour
 */
export function isSameParisDay(
  date1: Date | string | number, 
  date2: Date | string | number
): boolean {
  const paris1 = formatParisDate(date1, 'yyyy-MM-dd');
  const paris2 = formatParisDate(date2, 'yyyy-MM-dd');
  return paris1 === paris2;
}

/**
 * Convertit un Timestamp Firebase en date Europe/Paris
 * @param timestamp Timestamp Firebase
 * @returns Date en Europe/Paris
 */
export function firebaseTimestampToParisDate(timestamp: any): Date {
  if (!timestamp) return toParisTime(new DateConstructor());
  
  // Si c'est déjà une Date
  if (timestamp instanceof Date) {
    return toParisTime(timestamp);
  }
  
  // Si c'est un Timestamp Firebase avec toDate()
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return toParisTime(timestamp.toDate());
  }
  
  // Si c'est un objet avec seconds (Timestamp Firebase sérialisé)
  if (timestamp.seconds) {
    return toParisTime(new DateConstructor(timestamp.seconds * 1000));
  }
  
  // Sinon, essayer de le convertir directement
  return toParisTime(timestamp);
}

/**
 * Exporte les dates pour les différents formats d'export
 * @param date Date à exporter
 * @param format Format d'export ('pdf', 'excel', 'csv')
 * @returns String formatée pour l'export
 */
export function exportDateString(
  date: Date | string | number, 
  format: 'pdf' | 'excel' | 'csv' = 'pdf'
): string {
  switch (format) {
    case 'excel':
      // Format Excel standard
      return formatParisDate(date, 'dd/MM/yyyy');
    case 'csv':
      // Format ISO pour CSV
      return formatParisDate(date, 'yyyy-MM-dd');
    case 'pdf':
    default:
      // Format français pour PDF
      return formatParisDate(date, 'dd MMMM yyyy');
  }
}

/**
 * Débug : affiche les informations de timezone pour une date
 * @param date Date à analyser
 * @param label Label pour le log
 */
export function debugTimezone(date: Date | string | number, label: string = 'Date'): void {
  const dateObj = date instanceof Date ? date : new DateConstructor(date);
  const parisDate = toParisTime(dateObj);
  
  console.log(`[TIMEZONE DEBUG] ${label}:`, {
    original: dateObj.toISOString(),
    paris: formatParisDate(parisDate, 'yyyy-MM-dd HH:mm:ss zzz'),
    parisDateString: formatParisDate(parisDate, 'yyyy-MM-dd'),
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    targetTimezone: TARGET_TIMEZONE
  });
}

/**
 * Wrapper pour startOfMonth avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @returns Premier jour du mois en Europe/Paris
 */
export function startOfMonthParis(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const start = dateFnsFormat(parisDate, 'yyyy-MM-01');
  return parseParisDate(start);
}

/**
 * Wrapper pour endOfMonth avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @returns Dernier jour du mois en Europe/Paris
 */
export function endOfMonthParis(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const year = parisDate.getFullYear();
  const month = parisDate.getMonth();
  // Obtenir le dernier jour du mois
  const lastDay = new DateConstructor(year, month + 1, 0).getDate();
  return createParisDate(year, month, lastDay, 23, 59, 59, 999);
}

/**
 * Wrapper pour startOfYear avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @returns Premier jour de l'année en Europe/Paris
 */
export function startOfYearParis(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const year = parisDate.getFullYear();
  return createParisDate(year, 0, 1, 0, 0, 0, 0);
}

/**
 * Wrapper pour endOfYear avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @returns Dernier jour de l'année en Europe/Paris
 */
export function endOfYearParis(date?: Date | string | number): Date {
  const parisDate = toParisTime(date || new DateConstructor());
  const year = parisDate.getFullYear();
  return createParisDate(year, 11, 31, 23, 59, 59, 999);
}

/**
 * Wrapper pour addMonths avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @param amount Nombre de mois à ajouter
 * @returns Date avec les mois ajoutés en Europe/Paris
 */
export function addMonthsParis(date: Date | string | number, amount: number): Date {
  const parisDate = toParisTime(date);
  const year = parisDate.getFullYear();
  const month = parisDate.getMonth();
  const day = parisDate.getDate();
  const hours = parisDate.getHours();
  const minutes = parisDate.getMinutes();
  const seconds = parisDate.getSeconds();
  const ms = parisDate.getMilliseconds();
  
  // Calculer la nouvelle date
  const newDate = createParisDate(year, month + amount, day, hours, minutes, seconds, ms);
  
  // Gérer le cas où le jour n'existe pas dans le nouveau mois
  // (ex: 31 janvier + 1 mois = 28/29 février)
  if (newDate.getDate() !== day) {
    // Revenir au dernier jour du mois précédent
    return createParisDate(year, month + amount + 1, 0, hours, minutes, seconds, ms);
  }
  
  return newDate;
}

/**
 * Wrapper pour subMonths avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @param amount Nombre de mois à soustraire
 * @returns Date avec les mois soustraits en Europe/Paris
 */
export function subMonthsParis(date: Date | string | number, amount: number): Date {
  return addMonthsParis(date, -amount);
}

/**
 * Wrapper pour addDays avec fuseau horaire Europe/Paris
 * @param date Date de référence
 * @param amount Nombre de jours à ajouter
 * @returns Date avec les jours ajoutés en Europe/Paris
 */
export function addDaysParis(date: Date | string | number, amount: number): Date {
  const parisDate = toParisTime(date);
  const year = parisDate.getFullYear();
  const month = parisDate.getMonth();
  const day = parisDate.getDate();
  const hours = parisDate.getHours();
  const minutes = parisDate.getMinutes();
  const seconds = parisDate.getSeconds();
  const ms = parisDate.getMilliseconds();
  
  // Créer la nouvelle date avec les jours ajoutés
  return createParisDate(year, month, day + amount, hours, minutes, seconds, ms);
}

/**
 * Alias courts pour les fonctions les plus utilisées
 */
export const startOfDayParis = startOfParisDay;
export const endOfDayParis = endOfParisDay;