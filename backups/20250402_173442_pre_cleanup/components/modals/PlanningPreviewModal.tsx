import React from 'react';
import { X } from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isGrayedOut } from '../../utils/dateUtils';
import '../../styles/BadgeStyles.css';
import type { ShiftAssignment } from '../../types/planning';

interface PlanningPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  assignments: Record<string, ShiftAssignment>;
  position: { x: number; y: number };
}

const PlanningPreviewModal: React.FC<PlanningPreviewModalProps> = ({
  isOpen,
  onClose,
  date,
  assignments,
  position,
}) => {
  if (!isOpen) return null;

  const selectedDate = new Date(date);
  const startDate = subDays(selectedDate, 2);
  const endDate = addDays(selectedDate, 2);

  // Générer un tableau de dates pour la période (5 jours)
  const dates = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  // Calcul de la position optimale
  const calculatePosition = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = 280; // Largeur réduite
    const modalHeight = 180; // Hauteur réduite
    
    let x = position.x;
    let y = position.y;
    
    // Ajustement horizontal
    if (x + modalWidth > viewportWidth) {
      x = viewportWidth - modalWidth - 10;
    }
    if (x < 10) {
      x = 10;
    }
    
    // Ajustement vertical
    if (y + modalHeight > viewportHeight) {
      y = viewportHeight - modalHeight - 10;
    }
    if (y < 10) {
      y = 10;
    }
    
    return { left: x, top: y };
  };

  return (
    <>
      <div className="fixed inset-0" onClick={onClose} />
      <div 
        className="fixed z-50 bg-white rounded shadow-lg border border-gray-200"
        style={calculatePosition()}
      >
        <div className="p-2">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-medium text-gray-700">
              {format(selectedDate, 'EEEE d MMM', { locale: fr })}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>

          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="w-12 py-1 px-1 text-left font-medium text-gray-500 bg-gray-50">
                  Date
                </th>
                <th className="w-8 py-1 px-1 text-center font-medium text-[#4A95D6] bg-[#E6F0FA]/20">M</th>
                <th className="w-8 py-1 px-1 text-center font-medium text-[#4F46E5] bg-[#EEF2FF]/20">AM</th>
                <th className="w-8 py-1 px-1 text-center font-medium text-[#9333EA] bg-[#F3E8FF]/20">S</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = isSameDay(selectedDate, date);
                const isWeekend = isGrayedOut(date);

                return (
                  <tr key={dateStr} className={`
                    border-b border-gray-100 last:border-0
                    ${isSelected ? 'bg-indigo-100 font-medium' : ''}
                    ${isWeekend ? 'bg-gray-50/50' : ''}
                  `}>
                    <td className="py-1 px-1">
                      <div className="flex items-baseline gap-1">
                        <span className={`${isSelected ? 'text-indigo-700' : ''}`}>{format(date, 'd')}</span>
                        <span className="text-[10px] text-gray-500">{format(date, 'E', { locale: fr })}</span>
                      </div>
                    </td>
                    {['M', 'AM', 'S'].map(period => {
                      const key = `${dateStr}-${period}`;
                      const assignment = assignments[key];
                      return (
                        <td key={period} className="py-1 px-1 text-center">
                          {assignment && (
                            <span className={`
                              inline-block text-[10px] font-medium px-1 rounded
                              ${period === 'M' ? 'badge-morning' :
                                period === 'AM' ? 'badge-afternoon' :
                                'badge-evening'}
                              ${isSelected ? 'shadow-sm' : ''}
                            `}>
                              {assignment.shiftType}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default PlanningPreviewModal;