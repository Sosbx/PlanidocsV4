import React, { useRef } from 'react';
import { PlanningGrid, PeriodNavigation } from './';
import { PeriodSelector } from '../admin';
import { usePlanningViewContext } from '../../context';
import type { ShiftAssignment } from '../../../../types/planning';
import type { ShiftExchange } from '../../../../types/exchange';

interface PlanningContainerProps {
  assignments: Record<string, ShiftAssignment>;
  exchanges: Record<string, ShiftExchange>;
  directExchanges: Record<string, ShiftExchange>;
  replacements: Record<string, any>;
  desiderata?: Record<string, { type: 'primary' | 'secondary' | null }>;
  receivedShifts?: Record<string, {
    originalUserId: string;
    newUserId: string;
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  userId?: string;
  isAdminView?: boolean;
  showDesiderata?: boolean;
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
  isFirstDayOfBagPeriod?: (date: Date) => boolean;
  onCellClick: (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => void;
  showPeriodSelector?: boolean;
  children?: React.ReactNode;
}

/**
 * Conteneur pour la page de planning
 */
const PlanningContainer: React.FC<PlanningContainerProps> = ({
  assignments,
  exchanges,
  directExchanges,
  replacements,
  desiderata = {},
  receivedShifts = {},
  userId,
  isAdminView = false,
  showDesiderata = false,
  bagPhaseConfig,
  isFirstDayOfBagPeriod,
  onCellClick,
  showPeriodSelector = false,
  children
}) => {
  // Référence pour le jour actuel
  const todayRef = useRef<HTMLDivElement>(null);
  
  // Utiliser le contexte de vue du planning
  const {
    viewType,
    dateRange,
    monthsToShow,
    setViewType,
    setCustomRange,
    setMonthsToShow,
    navigateNext,
    navigatePrevious,
    resetToToday,
    jumpToDate
  } = usePlanningViewContext();
  
  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    console.log("PlanningContainer: showDesiderata a changé:", showDesiderata);
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);

  return (
    <div className="flex flex-col h-full">
      {/* Barre de navigation */}
      <PeriodNavigation
        viewType={viewType}
        dateRange={dateRange}
        onPrevious={navigatePrevious}
        onNext={navigateNext}
        onReset={resetToToday}
      />
      
      {/* Sélecteur de période (optionnel) */}
      {showPeriodSelector && (
        <PeriodSelector
          onViewChange={setViewType}
          onRangeChange={setCustomRange}
          onMonthsToShowChange={setMonthsToShow}
          currentView={viewType}
          currentRange={dateRange}
          currentMonthsToShow={monthsToShow}
        />
      )}
      
      {/* Contenu personnalisé */}
      {children}
      
      {/* Grille de planning */}
      <PlanningGrid
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        viewType={viewType}
        assignments={assignments}
        exchanges={exchanges}
        directExchanges={directExchanges}
        replacements={replacements}
        desiderata={desiderata}
        receivedShifts={receivedShifts}
        userId={userId}
        isAdminView={isAdminView}
        showDesiderata={showDesiderata}
        bagPhaseConfig={bagPhaseConfig}
        todayRef={todayRef}
        isFirstDayOfBagPeriod={isFirstDayOfBagPeriod}
        onCellClick={onCellClick}
      />
    </div>
  );
};

export default PlanningContainer;
