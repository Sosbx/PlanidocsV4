import React from 'react';
import { format, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDaysArray, getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import type { Selections } from '../types';
import PlanningCell from './PlanningCell';

interface MobileTableProps {
  startDate: Date;
  endDate: Date;
  selections: Selections;
  onCellMouseDown: (key: string) => void;
  onCellMouseEnter: (key: string) => void;
  onComment: (key: string, comment: string) => void;
  onOpenModal: (key: string, position: { x: number; y: number }) => void;
  activeModal: { cellKey: string; position: { x: number; y: number } } | null;
  onCloseModal: () => void;
}

const MobileTable: React.FC<MobileTableProps> = ({
  startDate,
  endDate,
  selections,
  onCellMouseDown,
  onCellMouseEnter,
  onComment,
  onOpenModal,
  activeModal,
  onCloseModal
}) => {
  const days = getDaysArray(startDate, endDate);
  const months = getMonthsInRange(startDate, endDate);

  return (
    <div className="space-y-8">
      {months.map((month, monthIndex) => {
        const daysInMonth = days.filter(day => isSameMonth(day, month));
        
        return (
          <div key={monthIndex} className="bg-white rounded-lg shadow">
            <div className="bg-gray-50 px-4 py-2 rounded-t-lg border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {format(month, 'MMMM', { locale: fr }).charAt(0).toUpperCase() + format(month, 'MMMM', { locale: fr }).slice(1) + ' ' + format(month, 'yyyy')}
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-sm font-medium text-gray-700">Jour</th>
                    <th className="px-2 py-1 text-sm font-medium text-gray-700">M</th>
                    <th className="px-2 py-1 text-sm font-medium text-gray-700">AM</th>
                    <th className="px-2 py-1 text-sm font-medium text-gray-700">S</th>
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isGrayed = isGrayedOut(day);
                    return (
                      <tr key={dateStr} className={isGrayed ? 'bg-gray-50' : ''}>
                        <td className="border px-2 py-1 text-sm">
                          <div className="flex justify-start items-center">
                            <span>{day.getDate()}</span>
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
                              isGrayedOut={isGrayed}
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MobileTable;
