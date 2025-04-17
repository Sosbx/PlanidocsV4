import React, { useMemo } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isGrayedOut } from '../utils/dateUtils';
import PlanningGridCell from './PlanningGridCell';
import type { ShiftAssignment } from '../types/planning';
import type { ShiftExchange } from '../types/exchange';

interface MonthTableProps {
  month: Date;
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
  showPreviousButton?: boolean;
  showNextButton?: boolean;
  onLoadPreviousMonth?: () => void;
  onLoadNextMonth?: () => void;
}

/**
 * Composant de tableau mensuel optimisé
 * Utilise React.memo pour éviter les re-rendus inutiles
 */
const MonthTable: React.FC<MonthTableProps> = React.memo(({
  month,
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
  showPreviousButton = false,
  showNextButton = false,
  onLoadPreviousMonth,
  onLoadNextMonth
}) => {
  // Mémoïser le calcul des jours filtrés
  const filteredDays = useMemo(() => {
    // Créer un tableau de tous les jours du mois
    const days = Array.from(
      { length: getDaysInMonth(month) },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    );

    // Filtrer les jours pour n'inclure que ceux dans la plage de dates
    return days.filter(date => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const compareStart = new Date(startDate);
      compareStart.setHours(0, 0, 0, 0);
      
      const compareEnd = new Date(endDate);
      compareEnd.setHours(23, 59, 59, 999);
      
      return startOfDay >= compareStart && startOfDay <= compareEnd;
    });
  }, [month, startDate, endDate]);

  // Forcer le re-rendu lorsque showDesiderata change
  React.useEffect(() => {
    // Cet effet ne fait rien, mais force le composant à se re-rendre
    // lorsque showDesiderata change
  }, [showDesiderata]);

  // Si aucun jour n'est dans la plage, ne pas rendre le tableau
  if (filteredDays.length === 0) {
    return null;
  }

  return (
    <div className="inline-block align-top mr-4 mb-4" style={{ flexShrink: 0 }}>
      <table className="border border-gray-200 bg-white">
        <thead>
          <tr>
            <th colSpan={4} className="px-3 py-2 text-xs font-medium text-gray-500 border-b bg-gray-50/70 relative">
              {showPreviousButton && (
                <button 
                  onClick={onLoadPreviousMonth}
                  className="absolute left-1 top-1/2 transform -translate-y-1/2 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
                  title="Mois précédent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              
              {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
              
              {showNextButton && (
                <button 
                  onClick={onLoadNextMonth}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
                  title="Mois suivant"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </th>
          </tr>
          <tr className="bg-gray-50/70">
            <th className="border px-2 py-1 text-xs font-normal text-gray-500 w-16">Jour</th>
            <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">M</th>
            <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">AM</th>
            <th className="border px-2 py-1 text-xs font-semibold text-gray-600 w-12">S</th>
          </tr>
        </thead>
        <tbody>
          {filteredDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const grayedOut = isGrayedOut(day);
            
            // Déterminer si ce jour est hier pour appliquer un style spécial à la bordure
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const isYesterday = yesterday.toDateString() === day.toDateString();
            const isToday = today.toDateString() === day.toDateString();
            
            // Déterminer si ce jour est le premier jour de la période BAG
            const isBagPeriodStart = isFirstDayOfBagPeriod && isFirstDayOfBagPeriod(day);
            
            return (
              <tr 
                key={dateStr} 
                className={`${isBagPeriodStart ? 'relative' : ''}`}
              >
                <td 
                  className={`
                    border px-2 py-1 text-[11px] relative
                    ${grayedOut ? 'text-gray-400 bg-gray-50/50' : 'text-gray-500 bg-gray-50/30'}
                    ${isYesterday ? 'border-b-indigo-300 border-b-2' : ''}
                    ${isBagPeriodStart && bagPhaseConfig.phase !== 'completed' ? 'border-t-2 border-t-red-400' : ''}
                  `} 
                  data-grayed-out={grayedOut ? 'true' : 'false'}
                  title={isYesterday ? "Séparation entre jours passés et futurs" : isBagPeriodStart ? "Début de la période Bourse aux Gardes" : ""}
                >
                  {/* Indicateur subtil pour la Bourse aux Gardes avec la bordure border-t-2 border-t-red-400 */}
                  
                  {/* Marqueur pour le scroll vers aujourd'hui */}
                  {isToday && (
                    <div ref={todayRef} className="absolute top-0 left-0 right-0 bottom-0 z-5 pointer-events-none"></div>
                  )}
                  <div className="flex justify-start items-center relative">
                    {/* Texte "BàG" vertical parfaitement collé à la bordure gauche */}
                    {isBagPeriodStart && bagPhaseConfig.phase !== 'completed' && (
                      <div className="absolute top-0 h-full text-[7px] text-red-500 opacity-30 font-bold"
                           style={{ 
                             writingMode: 'vertical-rl', 
                             transform: 'rotate(180deg)',
                             display: 'flex',
                             alignItems: 'center',
                             pointerEvents: 'none',
                             left: '-2px' // Valeur négative pour coller à la bordure
                           }}>
                        BàG
                      </div>
                    )}
                    <span className="ml-2">{format(day, 'd', { locale: fr })}</span>
                    <span className="text-gray-400 text-[10px] ml-1">
                      {format(day, 'EEEEEE', { locale: fr }).charAt(0).toUpperCase() + format(day, 'EEEEEE', { locale: fr }).slice(1).toLowerCase()}
                    </span>
                  </div>
                </td>
                {['M', 'AM', 'S'].map(period => {
                  const cellKey = `${dateStr}-${period}`;
                  const exchange = exchanges[cellKey];
                  const directExchange = directExchanges[cellKey];
                  const replacement = replacements[cellKey];
                  const receivedShift = receivedShifts[cellKey];
                  const desideratum = showDesiderata ? desiderata[cellKey] : undefined;
                  
                  // Récupérer l'assignment de base ou la garde reçue
                  let cellAssignment = assignments[cellKey];
                  
                  // Si la garde a été donnée via un échange simple (non permutation), ne rien afficher
                  if (receivedShift && receivedShift.originalUserId === userId && !receivedShift.isPermutation && !cellAssignment) {
                    return (
                      <td key={cellKey} className="border px-1 py-1 text-xs text-center"></td>
                    );
                  }
                  
                  // Si aucune garde assignée mais c'est une garde reçue, créer un assignment temporaire
                  if (!cellAssignment && receivedShift && (receivedShift.newUserId === userId || (receivedShift.isPermutation && receivedShift.originalUserId === userId))) {
                    cellAssignment = {
                      type: period as 'M' | 'AM' | 'S',
                      date: dateStr,
                      timeSlot: receivedShift.timeSlot,
                      shiftType: receivedShift.shiftType
                    };
                  }

                  return (
                    <PlanningGridCell
                      key={cellKey}
                      cellKey={cellKey}
                      assignment={cellAssignment}
                      exchange={exchange}
                      directExchange={directExchange}
                      replacement={replacement}
                      desideratum={desideratum}
                      receivedShift={receivedShift}
                      userId={userId}
                      isGrayedOut={grayedOut}
                      period={period as 'M' | 'AM' | 'S'}
                      bagPhaseConfig={bagPhaseConfig}
                      isAdminView={isAdminView}
                      onCellClick={onCellClick}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default MonthTable;
