/**
 * Configuration globale pour forcer l'utilisation du fuseau horaire Europe/Paris
 * Ce module remplace le constructeur Date natif pour garantir que toutes les dates
 * créées dans l'application utilisent le fuseau horaire Europe/Paris.
 * 
 * IMPORTANT: Ce fichier doit être importé au tout début de l'application (dans main.tsx)
 * avant tout autre import qui pourrait utiliser des dates.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { createParisDate, parseParisDate } from '@/utils/timezoneUtils';

// Sauvegarder le constructeur Date original AVANT tout import
const OriginalDate = window.Date;

// Exporter l'original pour que timezoneUtils puisse l'utiliser
export { OriginalDate };

const TARGET_TIMEZONE = 'Europe/Paris';

// Type pour le nouveau constructeur Date
interface ParisDateConstructor {
  new(): Date;
  new(value: number | string): Date;
  new(year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
  (): string;
  readonly prototype: Date;
  parseParisDate(s: string): number;
  UTC(year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number;
  now(): number;
}

// Créer le nouveau constructeur Date
const ParisDate: ParisDateConstructor = function(...args: any[]): Date | string {
  // Si appelé sans 'new', retourner une string comme le fait Date()
  if (!(this instanceof ParisDate)) {
    return new OriginalDate().toString();
  }

  // Gérer les différents cas d'utilisation du constructeur Date
  if (args.length === 0) {
    // createParisDate() - date actuelle
    return toZonedTime(new OriginalDate(), TARGET_TIMEZONE);
  } else if (args.length === 1) {
    const arg = args[0];
    
    if (typeof arg === 'string') {
      // new Date("2024-01-15") - parser une string
      if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Format YYYY-MM-DD - parser et considérer comme étant en Europe/Paris
        const [year, month, day] = arg.split('-').map(Number);
        const naiveDate = new OriginalDate(year, month - 1, day, 12, 0, 0, 0);
        return fromZonedTime(naiveDate, TARGET_TIMEZONE);
      }
      // Sinon, convertir via le constructeur original puis en heure de Paris
      const originalDate = new OriginalDate(arg);
      if (isNaN(originalDate.getTime())) {
        return originalDate; // Retourner Invalid Date tel quel
      }
      return toZonedTime(originalDate, TARGET_TIMEZONE);
    } else if (typeof arg === 'number') {
      // new Date(timestamp) - créer depuis un timestamp
      return toZonedTime(new OriginalDate(arg), TARGET_TIMEZONE);
    } else if (arg instanceof OriginalDate) {
      // new Date(date) - copier une date existante
      return toZonedTime(arg, TARGET_TIMEZONE);
    }
  } else {
    // new Date(year, month, day, ...) - créer avec des composants
    const [year, month = 0, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0] = args;
    const naiveDate = new OriginalDate(year, month, day, hours, minutes, seconds, ms);
    return fromZonedTime(naiveDate, TARGET_TIMEZONE);
  }

  // Fallback au constructeur original
  return toZonedTime(new OriginalDate(...args), TARGET_TIMEZONE);
} as any;

// Copier toutes les propriétés statiques du constructeur original
Object.setPrototypeOf(ParisDate, OriginalDate);
Object.setPrototypeOf(ParisDate.prototype, OriginalDate.prototype);

// Copier les méthodes statiques
const staticProps = ['parse', 'UTC', 'now'];
staticProps.forEach(prop => {
  (ParisDate as any)[prop] = (OriginalDate as any)[prop];
});

// Remplacer window.Date
(window as any).Date = ParisDate;

// Logger l'activation pour le debug
console.log('[DateConfig] Fuseau horaire Europe/Paris activé pour toutes les dates');

// Fonction pour vérifier que la configuration est active
export function isParisDateConfigActive(): boolean {
  return window.Date !== OriginalDate;
}