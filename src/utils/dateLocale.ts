/**
 * Fichier centralisé pour la gestion de la locale date-fns
 * Évite d'importer toute la bibliothèque de locales
 */

import fr from 'date-fns/locale/fr';

// Export de la locale française uniquement
export const frLocale = fr;

// Configuration par défaut pour les formats de date
export const defaultDateOptions = {
  locale: frLocale
};