import React, { memo, useMemo } from 'react';
import { ViewType } from '../../types/viewTypes';
import type { ShiftAssignment } from '../../../../types/planning';
import type { ShiftExchange } from '../../../../types/exchange';
import VirtualizedMonthList from '../../../../components/VirtualizedMonthList';

interface PlanningGridProps {
  startDate: Date;
  endDate: Date;
  viewType: ViewType;
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
  todayRef?: React.RefObject<HTMLDivElement>;
  isFirstDayOfBagPeriod?: (date: Date) => boolean;
  onCellClick: (event: React.MouseEvent, cellKey: string, assignment: ShiftAssignment) => void;
  height?: number;
  width?: number | string;
}

/**
 * Composant pour afficher la grille de planning avec différentes vues
 */
const PlanningGrid: React.FC<PlanningGridProps> = memo(({
  startDate,
  endDate,
  viewType,
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
  todayRef,
  isFirstDayOfBagPeriod,
  onCellClick,
  height = 600,
  width = '100%'
}) => {
  // Calculer la hauteur en fonction du type de vue
  const calculatedHeight = useMemo(() => {
    switch (viewType) {
      case 'month':
        return height;
      case 'quadrimester':
        return height * 1.5;
      case 'semester':
        return height * 2;
      case 'year':
        return height * 3;
      case 'custom':
      default:
        return height;
    }
  }, [viewType, height]);

  // Déterminer le mode d'affichage en fonction du type de vue
  const viewMode = useMemo(() => {
    // Pour les vues avec beaucoup de mois, utiliser la vue en colonne unique
    if (viewType === 'year') {
      return 'singleColumn';
    }
    
    // Pour les autres vues, utiliser la vue multi-colonnes
    return 'multiColumn';
  }, [viewType]);
  
  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    console.log("PlanningGrid: showDesiderata a changé:", showDesiderata);
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <VirtualizedMonthList
        startDate={startDate}
        endDate={endDate}
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
        height={calculatedHeight}
        width={width}
      />
    </div>
  );
});

PlanningGrid.displayName = 'PlanningGrid';

export default PlanningGrid;
