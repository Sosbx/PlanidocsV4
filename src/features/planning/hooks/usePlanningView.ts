import { useState, useCallback, useMemo } from 'react';
import { 
  createParisDate, 
  startOfMonthParis, 
  endOfMonthParis, 
  startOfYearParis, 
  endOfYearParis,
  addMonthsParis,
  subMonthsParis
} from '../../../utils/timezoneUtils';
import { ViewType, DateRange } from '../types/viewTypes';

/**
 * Interface pour le résultat du hook usePlanningView
 */
interface UsePlanningViewResult {
  viewType: ViewType;
  dateRange: DateRange;
  monthsToShow: number;
  setViewType: (type: ViewType) => void;
  setCustomRange: (startDate: Date, endDate: Date) => void;
  setMonthsToShow: (months: number) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;
  resetToToday: () => void;
  jumpToDate: (date: Date) => void;
}

/**
 * Hook personnalisé pour gérer les différentes vues temporelles du planning
 * @param initialView - Type de vue initial (par défaut: 'month')
 * @param initialDateRange - Plage de dates initiale (optionnel)
 * @returns Fonctions et états pour gérer les vues temporelles
 */
export const usePlanningView = (
  initialView: ViewType = 'month',
  initialDateRange?: DateRange
): UsePlanningViewResult => {
  // État pour le type de vue actuel
  const [viewType, setViewType] = useState<ViewType>(initialView);
  
  // État pour la plage de dates
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Si une plage de dates initiale est fournie, l'utiliser
    if (initialDateRange) {
      return initialDateRange;
    }
    
    const today = createParisDate();
    
    // Sinon, définir la plage de dates initiale en fonction du type de vue
    switch (initialView) {
      case 'month':
        return {
          startDate: startOfMonthParis(today),
          endDate: endOfMonthParis(today)
        };
      case 'quadrimester':
        return {
          startDate: startOfMonthParis(today),
          endDate: endOfMonthParis(addMonthsParis(today, 3))
        };
      case 'semester':
        return {
          startDate: startOfMonthParis(today),
          endDate: endOfMonthParis(addMonthsParis(today, 5))
        };
      case 'year':
        return {
          startDate: startOfYearParis(today),
          endDate: endOfYearParis(today)
        };
      case 'custom':
      default:
        return {
          startDate: startOfMonthParis(today),
          endDate: endOfMonthParis(today)
        };
    }
  });
  
  // État pour le nombre de mois à afficher en vue personnalisée
  const [monthsToShow, setMonthsToShow] = useState<number>(() => {
    switch (initialView) {
      case 'month': return 1;
      case 'quadrimester': return 4;
      case 'semester': return 6;
      case 'year': return 12;
      case 'custom': return 1;
      default: return 1;
    }
  });
  
  /**
   * Met à jour la plage de dates en fonction du type de vue
   */
  const updateDateRangeForViewType = useCallback((type: ViewType, baseDate: Date = createParisDate()) => {
    switch (type) {
      case 'month':
        setDateRange({
          startDate: startOfMonthParis(baseDate),
          endDate: endOfMonthParis(baseDate)
        });
        setMonthsToShow(1);
        break;
      case 'quadrimester':
        setDateRange({
          startDate: startOfMonthParis(baseDate),
          endDate: endOfMonthParis(addMonthsParis(baseDate, 3))
        });
        setMonthsToShow(4);
        break;
      case 'semester':
        setDateRange({
          startDate: startOfMonthParis(baseDate),
          endDate: endOfMonthParis(addMonthsParis(baseDate, 5))
        });
        setMonthsToShow(6);
        break;
      case 'year':
        setDateRange({
          startDate: startOfYearParis(baseDate),
          endDate: endOfYearParis(baseDate)
        });
        setMonthsToShow(12);
        break;
      case 'custom':
        // Ne rien faire, la plage personnalisée est définie séparément
        break;
    }
  }, []);
  
  /**
   * Change le type de vue et met à jour la plage de dates en conséquence
   */
  const handleViewTypeChange = useCallback((type: ViewType) => {
    setViewType(type);
    
    // Si on passe à une vue non personnalisée, mettre à jour la plage de dates
    if (type !== 'custom') {
      updateDateRangeForViewType(type);
    }
  }, [updateDateRangeForViewType]);
  
  /**
   * Définit une plage de dates personnalisée et passe en vue personnalisée
   */
  const handleCustomRangeChange = useCallback((startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate });
    setViewType('custom');
  }, []);
  
  /**
   * Navigue vers la période suivante en fonction du type de vue
   */
  const navigateNext = useCallback(() => {
    const { startDate } = dateRange;
    
    switch (viewType) {
      case 'month':
        updateDateRangeForViewType('month', addMonthsParis(startDate, 1));
        break;
      case 'quadrimester':
        updateDateRangeForViewType('quadrimester', addMonthsParis(startDate, 4));
        break;
      case 'semester':
        updateDateRangeForViewType('semester', addMonthsParis(startDate, 6));
        break;
      case 'year':
        updateDateRangeForViewType('year', addMonthsParis(startDate, 12));
        break;
      case 'custom':
        // Pour la vue personnalisée, avancer du nombre de mois défini
        const newStartDate = addMonthsParis(startDate, monthsToShow);
        setDateRange({
          startDate: newStartDate,
          endDate: endOfMonthParis(addMonthsParis(newStartDate, monthsToShow - 1))
        });
        break;
    }
  }, [viewType, dateRange, monthsToShow, updateDateRangeForViewType]);
  
  /**
   * Navigue vers la période précédente en fonction du type de vue
   */
  const navigatePrevious = useCallback(() => {
    const { startDate } = dateRange;
    
    switch (viewType) {
      case 'month':
        updateDateRangeForViewType('month', subMonthsParis(startDate, 1));
        break;
      case 'quadrimester':
        updateDateRangeForViewType('quadrimester', subMonthsParis(startDate, 4));
        break;
      case 'semester':
        updateDateRangeForViewType('semester', subMonthsParis(startDate, 6));
        break;
      case 'year':
        updateDateRangeForViewType('year', subMonthsParis(startDate, 12));
        break;
      case 'custom':
        // Pour la vue personnalisée, reculer du nombre de mois défini
        const newStartDate = subMonthsParis(startDate, monthsToShow);
        setDateRange({
          startDate: newStartDate,
          endDate: endOfMonthParis(addMonthsParis(newStartDate, monthsToShow - 1))
        });
        break;
    }
  }, [viewType, dateRange, monthsToShow, updateDateRangeForViewType]);
  
  /**
   * Réinitialise la vue à la date actuelle
   */
  const resetToToday = useCallback(() => {
    updateDateRangeForViewType(viewType, createParisDate());
  }, [viewType, updateDateRangeForViewType]);
  
  /**
   * Saute à une date spécifique tout en conservant le type de vue
   */
  const jumpToDate = useCallback((date: Date) => {
    updateDateRangeForViewType(viewType, date);
  }, [viewType, updateDateRangeForViewType]);
  
  /**
   * Met à jour le nombre de mois à afficher pour la vue personnalisée
   */
  const handleMonthsToShowChange = useCallback((months: number) => {
    setMonthsToShow(months);
    
    // Si on est déjà en vue personnalisée, mettre à jour la plage de dates
    if (viewType === 'custom') {
      setDateRange((prev: DateRange) => ({
        startDate: prev.startDate,
        endDate: endOfMonthParis(addMonthsParis(prev.startDate, months - 1))
      }));
    }
  }, [viewType]);
  
  return {
    viewType,
    dateRange,
    monthsToShow,
    setViewType: handleViewTypeChange,
    setCustomRange: handleCustomRangeChange,
    setMonthsToShow: handleMonthsToShowChange,
    navigateNext,
    navigatePrevious,
    resetToToday,
    jumpToDate
  };
};

export default usePlanningView;
