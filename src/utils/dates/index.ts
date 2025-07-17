/**
 * Module centralisé pour toutes les fonctions de dates
 * Point d'entrée unique pour l'utilisation des dates dans l'application
 */

// Re-exporter toutes les fonctions existantes
export * from '../timezoneUtils';
export * from '../dateUtils';
export * from '../holidayUtils';

// Exporter les nouveaux modules
export * from './dateFormats';
export * from './dateHelpers';
export * from './dateComparison';
export * from './periodHelpers';

// Exporter la locale française
export { frLocale } from '../dateLocale';

// Alias pour les fonctions les plus utilisées
export { 
  createParisDate as createDate,
  formatParisDate as formatDate,
  parseParisDate as parseDate,
  toParisTime as toLocalTime
} from '../timezoneUtils';

// Type unifié pour les entrées de dates
export type { DateInput } from './dateHelpers';