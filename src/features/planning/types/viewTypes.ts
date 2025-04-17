/**
 * Types pour les vues temporelles du planning
 */

/**
 * Types de vues disponibles pour le planning
 */
export type ViewType = 'month' | 'quadrimester' | 'semester' | 'year' | 'custom';

/**
 * Interface pour la plage de dates
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Interface pour les options de vue
 */
export interface ViewOptions {
  viewType: ViewType;
  dateRange: DateRange;
  monthsToShow?: number; // Pour la vue personnalisée
}

/**
 * Interface pour les options de navigation
 */
export interface NavigationOptions {
  navigateNext: () => void;
  navigatePrevious: () => void;
  resetToToday: () => void;
  jumpToDate: (date: Date) => void;
}
