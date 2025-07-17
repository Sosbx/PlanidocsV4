import React, { useMemo, useState } from 'react';
// import { FixedSizeList as List } from 'react-window'; // Désactivé temporairement pour la virtualisation
import { getMonthsInRange } from '../utils/dateUtils';
import { createParisDate } from '../utils/timezoneUtils';
import MonthTable from './MonthTable';
import type { ShiftAssignment } from '../types/planning';
import type { ShiftExchange } from '../types/exchange';

// Styles définis localement dans ce fichier pour éviter les problèmes d'importation

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
  height?: number | string;
  width?: number | string;
  onLoadPreviousMonth?: () => void;
  onLoadNextMonth?: () => void;
  maxMonths?: number;
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
  height = 'calc(100vh - 250px)', // Hauteur dynamique optimisée pour petits écrans
  width = '100%',
  onLoadPreviousMonth,
  onLoadNextMonth,
  maxMonths = 7 // Maximum 7 mois affichés simultanément
}) => {
  // État local pour les mois - permettra de forcer des re-rendus
  const [monthsState, setMonthsState] = useState(() => getMonthsInRange(startDate, endDate));
  
  // Mémoïser le calcul des mois dans la plage de dates avec limite
  const months = useMemo(() => {
    const allMonths = getMonthsInRange(startDate, endDate);
    // Limiter le nombre de mois affichés si nécessaire
    if (allMonths.length > maxMonths) {
      // Prioriser les mois autour de la date actuelle
      const today = createParisDate();
      const currentMonthIndex = allMonths.findIndex(month => 
        month.getFullYear() === today.getFullYear() && 
        month.getMonth() === today.getMonth()
      );
      
      if (currentMonthIndex !== -1) {
        // Afficher les mois autour du mois actuel
        const startIndex = Math.max(0, currentMonthIndex - Math.floor(maxMonths / 2));
        const endIndex = Math.min(allMonths.length, startIndex + maxMonths);
        return allMonths.slice(startIndex, endIndex);
      } else {
        // Si le mois actuel n'est pas dans la plage, afficher les premiers mois
        return allMonths.slice(0, maxMonths);
      }
    }
    return allMonths;
  }, [startDate, endDate, maxMonths]);
  
  // Mémoïser la hauteur approximative d'un mois (300px par défaut)
  const itemHeight = useMemo(() => {
    // On pourrait calculer la hauteur en fonction du nombre de jours dans le mois
    // mais pour simplifier, on utilise une hauteur fixe
    return 300;
  }, []);
  
  // Mise à jour de l'état local uniquement lors du changement des mois
  React.useEffect(() => {
    console.log("VirtualizedMonthList: Mise à jour de la liste des mois");
    setMonthsState(months);
  }, [months]);
  
  // Mettre à jour l'état lorsque les données importantes changent
  React.useEffect(() => {
    console.log("VirtualizedMonthList: Données importantes modifiées");
    // Mise à jour simple sans re-rendus multiples
    setMonthsState([...months]);
  }, [showDesiderata, directExchanges, exchanges, replacements, bagPhaseConfig, width, months]);

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
        overflowY: 'auto', // Permettre le scroll vertical pour les petits écrans
        whiteSpace: 'nowrap',
        padding: '10px 0',
        border: 'none',
        maxWidth: '100%',
        position: 'relative',
        display: 'block',
        boxSizing: 'border-box'
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
        {monthsState.map((month, index) => (
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
