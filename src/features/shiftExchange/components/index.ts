/**
 * Composants pour la fonctionnalité de bourse aux gardes
 */

// Exporter les composants au fur et à mesure de leur migration
export { default as BagPhaseIndicator } from './BagPhaseIndicator';
export { default as CompletedPhaseExchangeItem } from './CompletedPhaseExchangeItem';
export { default as GroupedShiftExchangeList } from './GroupedShiftExchangeList';
export { default as BagPhaseConfigModal } from './BagPhaseConfigModal';
export { default as PhaseInfoBanner } from './PhaseInfoBanner';
export { default as CalendarControls } from './CalendarControls';
export { default as DisplayOptionsDropdown } from './DisplayOptionsDropdown';
export { default as ViewModeSwitcher } from './ViewModeSwitcher';
export { default as ShiftExchangeCalendarView } from './ShiftExchangeCalendarView';
export { default as ShiftExchangeFilters } from './ShiftExchangeFilters';
export { LoadingState, EmptyState, ErrorState } from './ShiftExchangeStates';
export { default as BagStatsViz } from './BagStatsViz';

// Composants d'administration
export * from './admin';

// Composants à migrer
// export { default as BagStats } from './BagStats';
