import React, { createContext, useContext } from 'react';
import { ViewType, DateRange } from '../types/viewTypes';
import { usePlanningView } from '../hooks';

/**
 * Interface pour le contexte de vue du planning
 */
interface PlanningViewContextType {
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

// Création du contexte
const PlanningViewContext = createContext<PlanningViewContextType | undefined>(undefined);

/**
 * Props pour le provider du contexte
 */
interface PlanningViewProviderProps {
  children: React.ReactNode;
  initialView?: ViewType;
  initialDateRange?: DateRange;
  onViewChange?: (startDate: Date) => void;
}

/**
 * Provider pour le contexte de vue du planning
 */
export const PlanningViewProvider: React.FC<PlanningViewProviderProps> = ({
  children,
  initialView = 'quadrimester',
  initialDateRange,
  onViewChange
}) => {
  // Utiliser le hook usePlanningView pour gérer l'état de la vue
  const planningViewState = usePlanningView(initialView, initialDateRange);
  
  // Appeler onViewChange lorsque la plage de dates change
  React.useEffect(() => {
    if (onViewChange && planningViewState.dateRange.startDate) {
      onViewChange(planningViewState.dateRange.startDate);
    }
  }, [planningViewState.dateRange.startDate, onViewChange]);
  
  return (
    <PlanningViewContext.Provider value={planningViewState}>
      {children}
    </PlanningViewContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte de vue du planning
 */
export const usePlanningViewContext = (): PlanningViewContextType => {
  const context = useContext(PlanningViewContext);
  
  if (context === undefined) {
    throw new Error('usePlanningViewContext must be used within a PlanningViewProvider');
  }
  
  return context;
};
