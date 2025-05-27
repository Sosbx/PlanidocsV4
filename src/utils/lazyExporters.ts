/**
 * Ce module contient des importations dynamiques pour les fonctions d'exportation volumineuses.
 * Il permet de charger ces fonctionnalités uniquement lorsqu'elles sont nécessaires.
 */

// Exportation PDF
export const loadPdfExporter = () => import('./pdfExport').then(module => module.exportPlanningToPDF);
export const loadPdfAllExporter = () => import('./pdfExport').then(module => module.exportAllPlanningsToPDFZip);

// Exportation CSV 
export const loadCsvExporter = () => import('./csvExport').then(module => module.exportPlanningToGoogleCalendarCSV);
export const loadCsvPlanningExporter = () => import('./csvExport').then(module => module.exportPlanningToCSV);
export const loadCsvAllExporter = () => import('./csvExport').then(module => module.exportAllPlanningsToZip);

// Exportation Generated Planning
export const loadGeneratedPlanningExporters = () => import('./generatedPlanningExport').then(module => ({
  toCsv: module.exportGeneratedPlanningToCSV,
  toPdf: module.exportGeneratedPlanningToPDF,
  allToPdf: module.exportAllGeneratedPlanningsToPDFZip,
  allToCsv: module.exportAllGeneratedPlanningsToCSVZip
}));

// Exportation ICS pour Apple Calendar
export const loadIcsExporter = () => import('./icsExport').then(module => module.exportPlanningToICS);

// Exportation Excel
export const loadExcelExporter = () => import('./excelExport').then(module => module.exportPlanningToExcel);

// Chargement dynamique des composants
export const loadGeneratedPlanningTable = () => import('../features/planning/components/GeneratedPlanningTable').then(module => module.default);

// Firebase services - lazy loading pour optimiser les chunks et éviter les conflicts statiques/dynamiques
export const loadPlanningService = () => import('../lib/firebase/planning');
export const loadExchangeCoreService = () => import('../lib/firebase/exchange/core');
export const loadExchangeHistoryService = () => import('../lib/firebase/exchange/history-operations');
