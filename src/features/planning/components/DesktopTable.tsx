import React from 'react';
import { format, isSameMonth, getDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import type { Selections } from '../types';
import PlanningCell from './PlanningCell';

interface DesktopTableProps {
  startDate: Date;
  endDate: Date;
  selections: Selections;
  onCellMouseDown: (key: string) => void;
  onCellMouseEnter: (key: string) => void;
  onComment: (key: string, comment: string) => void;
  onOpenModal: (key: string, position: { x: number; y: number }) => void;
  activeModal: { cellKey: string; position: { x: number; y: number } } | null;
  onCloseModal: () => void;
  readOnly?: boolean;
}

const DesktopTable: React.FC<DesktopTableProps> = ({
  startDate,
  endDate,
  selections,
  onCellMouseDown,
  onCellMouseEnter,
  onComment,
  onOpenModal,
  activeModal,
  onCloseModal,
  readOnly = false
}) => {
  const months = getMonthsInRange(startDate, endDate);

  const renderMonthTable = (month: Date) => {
    // Créer un tableau de tous les jours du mois
    const days = Array.from(
      { length: getDaysInMonth(month) },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    );

    // Filtrer les jours pour n'inclure que ceux dans la plage de dates
    const filteredDays = days.filter(date => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const compareStart = new Date(startDate);
      compareStart.setHours(0, 0, 0, 0);
      
      const compareEnd = new Date(endDate);
      compareEnd.setHours(0, 0, 0, 0);
      
      return startOfDay >= compareStart && startOfDay <= compareEnd;
    });

    return (
      <div key={month.getTime()} className="inline-block align-top mr-4 mb-4">
        <table className="border border-gray-200 bg-white">
          <thead>
            <tr>
              <th colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-700 border-b bg-gray-50">
                {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-20">Jour</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">M</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">AM</th>
              <th className="border px-2 py-1 text-sm font-medium text-gray-700 w-12">S</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const grayedOut = isGrayedOut(day);
              return (
                <tr key={dateStr}>
                  <td className={`border px-2 py-1 text-sm ${grayedOut ? 'text-gray-500 bg-gray-100' : ''}`}>
                    <div className="flex justify-start items-center">
                      <span>{format(day, 'd', { locale: fr })}</span>
                      <span className="text-gray-500 ml-1">
                        {format(day, 'EEEEEE', { locale: fr }).charAt(0).toUpperCase() + format(day, 'EEEEEE', { locale: fr }).slice(1).toLowerCase()}
                      </span>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const cellKey = `${dateStr}-${period}`;
                    return (
                      <PlanningCell
                        key={cellKey}
                        cellKey={cellKey}
                        selection={selections[cellKey] || { type: null }}
                        onMouseDown={onCellMouseDown}
                        onMouseEnter={onCellMouseEnter}
                        onComment={onComment}
                        onOpenModal={onOpenModal}
                        activeModal={activeModal}
                        onCloseModal={onCloseModal}
                        isGrayedOut={grayedOut}
                        readOnly={readOnly}
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
  };

  return (
    <div className="overflow-x-auto whitespace-nowrap">
      {months.map(renderMonthTable)}
    </div>
  );
};

export default DesktopTable;
