import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { getMonthsInRange } from '../utils/dateUtils';
import MonthTable from './MonthTable';
import type { ShiftAssignment } from '../types/planning';
import type { ShiftExchange } from '../types/exchange';

interface VirtualizedMonthListProps {
  startDate: Date;
  endDate: Date;
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
  onLoadPreviousMonth?: () => void;
  onLoadNextMonth?: () => void;
}

/**
 * Composant qui virtualise l'affichage des tableaux mensuels
 * Utilise react-window pour n'afficher que les mois visibles à l'écran
 * ou un affichage horizontal pour le mode multi-colonnes
 */
const VirtualizedMonthList: React.FC<VirtualizedMonthListProps> = ({
  startDate,
  endDate,
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
  width = '100%',
  onLoadPreviousMonth,
  onLoadNextMonth
}) => {
  // Mémoïser le calcul des mois dans la plage de dates
  const months = useMemo(() => {
    return getMonthsInRange(startDate, endDate);
  }, [startDate, endDate]);

  // Mémoïser la hauteur approximative d'un mois (300px par défaut)
  const itemHeight = useMemo(() => {
    // On pourrait calculer la hauteur en fonction du nombre de jours dans le mois
    // mais pour simplifier, on utilise une hauteur fixe
    return 300;
  }, []);
  
  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    console.log("VirtualizedMonthList: showDesiderata a changé:", showDesiderata);
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);

  // Si aucun mois n'est dans la plage, ne rien rendre
  if (months.length === 0) {
    return null;
  }

  // Affichage horizontal pour le mode multi-colonnes
  return (
    <div 
      className="planning-months-container"
      style={{
        height: height,
        width: width,
        overflowX: 'auto',
        overflowY: 'auto',
        whiteSpace: 'nowrap',
        padding: '10px 0',
        border: 'none', // S'assurer qu'il n'y a pas de bordure
        maxWidth: '100%', // Assurer que le conteneur ne dépasse pas la largeur de son parent
        position: 'relative', // Ajouter position relative pour le contexte de positionnement
        display: 'block', // Forcer l'affichage en bloc
        boxSizing: 'border-box' // S'assurer que le padding est inclus dans la largeur
      }}
    >
      <div 
        style={{
          display: 'inline-flex',
          flexWrap: 'nowrap',
          gap: '16px',
          border: 'none', // S'assurer qu'il n'y a pas de bordure
          minWidth: 'min-content', // Assurer que le contenu peut s'étendre au-delà de la largeur du parent
          width: 'auto', // Permettre au conteneur de s'étendre naturellement
          overflow: 'visible' // Permettre au contenu de déborder
        }}
      >
        {months.map((month, index) => (
          <div key={month.getTime()} className="month-table-wrapper">
            <MonthTable
              month={month}
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
              showPreviousButton={index === 0 && onLoadPreviousMonth !== undefined}
              showNextButton={index === months.length - 1 && onLoadNextMonth !== undefined}
              onLoadPreviousMonth={index === 0 ? onLoadPreviousMonth : undefined}
              onLoadNextMonth={index === months.length - 1 ? onLoadNextMonth : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualizedMonthList;
