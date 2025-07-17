/**
 * Formats de dates centralisés pour toute l'application
 * Utilise le format de date-fns
 * Tous les formats utilisent automatiquement le fuseau horaire Europe/Paris
 */

export const DATE_FORMATS = {
  // Formats d'affichage courts
  SHORT_DATE: 'dd/MM',
  SHORT_DATE_MONTH: 'd MMM',
  SHORT_DATE_YEAR: 'dd/MM/yyyy',
  SHORT_WEEKDAY: 'EEE',
  SHORT_WEEKDAY_DATE: 'EEE d MMM',
  
  // Formats d'affichage moyens
  MEDIUM_DATE: 'dd MMM yyyy',
  MEDIUM_DATE_WEEKDAY: 'EEE d MMM yyyy',
  MEDIUM_DATE_TIME: 'dd MMM yyyy HH:mm',
  
  // Formats d'affichage longs
  LONG_DATE: 'EEEE d MMMM yyyy',
  LONG_DATE_NO_YEAR: 'EEEE d MMMM',
  DATE_WITH_TIME: 'dd MMMM yyyy à HH:mm',
  LONG_DATE_TIME: 'EEEE d MMMM yyyy HH:mm',
  
  // Formats techniques
  ISO_DATE: 'yyyy-MM-dd',
  ISO_DATE_TIME: "yyyy-MM-dd'T'HH:mm:ss",
  CALENDAR_KEY: 'yyyyMMdd',
  MONTH_YEAR: 'MMMM yyyy',
  YEAR_MONTH: 'yyyy-MM',
  TIME_ONLY: 'HH:mm',
  
  // Formats pour les exports
  EXPORT_PDF: 'dd MMMM yyyy',
  EXPORT_EXCEL: 'dd/MM/yyyy',
  EXPORT_CSV: 'yyyy-MM-dd',
  EXPORT_ICS_DATE: 'yyyyMMdd',
  EXPORT_ICS_TIME: 'HHmmss',
  EXPORT_ICS_DATETIME: "yyyyMMdd'T'HHmmss",
  
  // Formats pour les noms de fichiers
  FILE_DATE: 'dd-MM-yyyy',
  FILE_TIMESTAMP: 'yyyy-MM-dd_HH-mm-ss',
  
  // Formats spéciaux
  DAY_NAME: 'EEEE',
  MONTH_NAME: 'MMMM',
  YEAR_ONLY: 'yyyy',
  DAY_ONLY: 'd',
} as const;

// Type pour les clés de formats
export type DateFormatKey = keyof typeof DATE_FORMATS;
export type DateFormat = typeof DATE_FORMATS[DateFormatKey];

// Alias pour les formats les plus utilisés
export const DISPLAY_DATE_SHORT = DATE_FORMATS.SHORT_DATE_MONTH;
export const DISPLAY_DATE_MEDIUM = DATE_FORMATS.MEDIUM_DATE;
export const DISPLAY_DATE_LONG = DATE_FORMATS.LONG_DATE;
export const TECHNICAL_DATE = DATE_FORMATS.ISO_DATE;

/**
 * Formats prédéfinis pour différents contextes d'affichage
 */
export const CONTEXT_FORMATS = {
  // Affichage dans les tables
  TABLE_HEADER: DATE_FORMATS.SHORT_DATE_MONTH,
  TABLE_CELL: DATE_FORMATS.DAY_ONLY,
  TABLE_MONTH_HEADER: DATE_FORMATS.MONTH_YEAR,
  
  // Affichage dans les modales
  MODAL_TITLE: DATE_FORMATS.LONG_DATE,
  MODAL_DATE: DATE_FORMATS.MEDIUM_DATE,
  MODAL_TIME: DATE_FORMATS.TIME_ONLY,
  
  // Affichage dans les listes
  LIST_ITEM: DATE_FORMATS.SHORT_DATE_MONTH,
  LIST_GROUP_HEADER: DATE_FORMATS.MONTH_YEAR,
  
  // Affichage dans les formulaires
  FORM_PLACEHOLDER: DATE_FORMATS.SHORT_DATE_YEAR,
  FORM_VALUE: DATE_FORMATS.SHORT_DATE_YEAR,
  
  // Affichage dans les notifications
  NOTIFICATION_DATE: DATE_FORMATS.MEDIUM_DATE,
  NOTIFICATION_TIME: DATE_FORMATS.TIME_ONLY,
  
  // Affichage mobile
  MOBILE_COMPACT: DATE_FORMATS.SHORT_DATE_MONTH,
  MOBILE_FULL: DATE_FORMATS.MEDIUM_DATE,
} as const;

/**
 * Map des formats selon le type d'export
 */
export const EXPORT_FORMAT_MAP = {
  pdf: DATE_FORMATS.EXPORT_PDF,
  excel: DATE_FORMATS.EXPORT_EXCEL,
  csv: DATE_FORMATS.EXPORT_CSV,
  ics: DATE_FORMATS.EXPORT_ICS_DATE,
} as const;

/**
 * Map des formats de date/heure selon le type d'export
 */
export const EXPORT_DATETIME_FORMAT_MAP = {
  pdf: DATE_FORMATS.LONG_DATE_TIME,
  excel: DATE_FORMATS.MEDIUM_DATE_TIME,
  csv: DATE_FORMATS.ISO_DATE_TIME,
  ics: DATE_FORMATS.EXPORT_ICS_DATETIME,
} as const;

/**
 * Obtient le format approprié pour un type d'export
 */
export function getExportFormat(exportType: 'pdf' | 'excel' | 'csv' | 'ics'): string {
  return EXPORT_FORMAT_MAP[exportType];
}

/**
 * Obtient le format de date et heure pour un type d'export
 */
export function getExportDateTimeFormat(exportType: 'pdf' | 'excel' | 'csv' | 'ics'): string {
  return EXPORT_DATETIME_FORMAT_MAP[exportType];
}