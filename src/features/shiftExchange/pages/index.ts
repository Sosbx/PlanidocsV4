import { lazy } from 'react';

/**
 * Pages pour la fonctionnalité de bourse aux gardes
 * Utilise le lazy loading pour optimiser le chargement
 */

// Page utilisateur - export direct car c'est la page principale
export { default as ShiftExchangePage } from './ShiftExchangePage';

// Page admin - lazy loading pour réduire le bundle initial
export const AdminShiftExchangePage = lazy(() => 
  import(/* webpackChunkName: "admin-shift-exchange" */ './AdminShiftExchangePage')
);