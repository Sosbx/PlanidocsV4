import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, subDays, isSameDay, startOfWeek, endOfWeek, isToday as isDateToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ArrowDown } from 'lucide-react';
import './PlanningTransition.css';
import { isGrayedOut } from '../../utils/dateUtils';
import type { ShiftAssignment } from '../../types/planning';

interface PermanentPlanningPreviewProps {
  assignments: Record<string, ShiftAssignment>;
  selectedDate?: string;
  className?: string;
}

const PermanentPlanningPreview: React.FC<PermanentPlanningPreviewProps> = ({
  assignments,
  selectedDate,
  className = '',
}) => {
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [viewMode, setViewMode] = useState<'week' | '5days'>('5days');

  // Générer un tableau de dates pour la période
  const getDates = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Commence le lundi
      const end = endOfWeek(currentDate, { weekStartsOn: 1 }); // Finit le dimanche
      
      const dates = [];
      let date = start;
      while (date <= end) {
        dates.push(date);
        date = addDays(date, 1);
      }
      return dates;
    } else {
      // Mode 5 jours centré sur la date courante
      const start = subDays(currentDate, 2);
      const end = addDays(currentDate, 2);
      
      const dates = [];
      let date = start;
      while (date <= end) {
        dates.push(date);
        date = addDays(date, 1);
      }
      return dates;
    }
  };

  const dates = getDates();

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subDays(currentDate, 7));
    } else {
      setCurrentDate(subDays(currentDate, 5));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 5));
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'week' ? '5days' : 'week');
  };

  // Si une date est sélectionnée dans la liste des gardes, mettre à jour la date courante
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // Référence pour le scroll automatique vers la date sélectionnée
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(true);
  const prevSelectedDateRef = useRef<string | undefined>(selectedDate);

  // Effet pour animer le scroll vers la date sélectionnée
  useEffect(() => {
    if (selectedDate && selectedRowRef.current && tableRef.current) {
      // Ne pas animer si c'est la même date
      const isSameDate = selectedDate === prevSelectedDateRef.current;
      
      // Marquer le début de l'animation seulement si la date a changé
      if (!isSameDate) {
        setIsScrolling(true);
        
        // Scroll vers la ligne sélectionnée avec une animation fluide
        selectedRowRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Ajouter une classe d'animation temporaire
        selectedRowRef.current.classList.add('planning-cell-highlight');
        
        // Nettoyer après l'animation
        const timer = setTimeout(() => {
          setIsScrolling(false);
          if (selectedRowRef.current) {
            selectedRowRef.current.classList.remove('planning-cell-highlight');
          }
        }, 1000);
        
        // Mettre à jour la référence de la date précédente
        prevSelectedDateRef.current = selectedDate;
        
        return () => clearTimeout(timer);
      }
    }
  }, [selectedDate]);

  // Effet pour activer/désactiver l'indicateur de synchronisation
  useEffect(() => {
    if (selectedDate) {
      // Activer l'indicateur de synchronisation
      setIsSyncActive(true);
      
      // Désactiver après un délai
      const timer = setTimeout(() => {
        setIsSyncActive(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [selectedDate]);
  
  // Effet pour mettre à jour la date courante quand la date sélectionnée change
  useEffect(() => {
    if (selectedDate) {
      // Mettre à jour la date courante pour centrer la vue sur la date sélectionnée
      setCurrentDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 w-full flex flex-col ${className} ${isSyncActive ? 'sync-active scale-[1.01]' : ''} sticky-container`}>
      <div className="sync-indicator"></div>
      <div className="px-2 py-1.5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-gray-100">
        <h3 className="text-xs font-medium text-gray-700 planning-title">Planning</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleViewMode}
            className="text-[10px] px-1 py-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            {viewMode === 'week' ? '5 jours' : 'Semaine'}
          </button>
          <div className="flex">
            <button 
              onClick={navigatePrevious}
              className="p-0.5 rounded-l border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              <ChevronLeft className="h-3 w-3 text-gray-600" />
            </button>
            <button 
              onClick={navigateNext}
              className="p-0.5 rounded-r border border-gray-300 border-l-0 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              <ChevronRight className="h-3 w-3 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-1 relative overflow-auto flex-1">
        <table ref={tableRef} className="w-full text-sm planning-transition">
          <thead>
            <tr>
              <th className="py-1 px-0.5 text-left font-medium text-gray-500 bg-gray-50 rounded-tl-md w-10">
                Date
              </th>
              <th className="py-1 px-0.5 text-center font-medium text-gray-500 bg-gray-50 w-6">M</th>
              <th className="py-1 px-0.5 text-center font-medium text-gray-500 bg-gray-50 w-6">AM</th>
              <th className="py-1 px-0.5 text-center font-medium text-gray-500 bg-gray-50 rounded-tr-md w-6">S</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const isSelected = selectedDate && isSameDay(new Date(selectedDate), date);
              const isToday = isSameDay(new Date(), date);
              const isWeekend = isGrayedOut(date);

              return (
                <tr 
                  key={dateStr} 
                  ref={isSelected ? selectedRowRef : null}
                  className={`
                    border-b border-gray-100 last:border-0
                    ${isSelected ? 'bg-indigo-50 planning-row-selected' : ''}
                    ${isToday ? 'bg-yellow-50/50' : ''}
                    ${isWeekend ? 'bg-gray-50/60' : ''}
                    hover:bg-gray-50/80 transition-all duration-200
                    ${isSelected ? 'planning-fade-in transform scale-[1.02]' : ''}
                  `}
                >
                  <td className="py-1.5 px-1">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-700' : isToday ? 'text-yellow-700' : ''}`}>
                        {format(date, 'd')}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {format(date, 'EEE', { locale: fr })}
                      </span>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const key = `${dateStr}-${period}`;
                    const assignment = assignments[key];
                    return (
                      <td key={period} className="py-1 px-0.5 text-center">
                        {assignment && (
                          <span className={`
                            inline-block text-[8px] font-medium px-1 py-0.5 rounded
                            ${period === 'M' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              period === 'AM' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                              'bg-violet-50 text-violet-700 border border-violet-200'}
                            ${isSelected ? 'shadow-sm planning-transition' : ''}
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
        {isScrolling && (
          <div className="scroll-indicator">
            <ArrowDown />
          </div>
        )}
      </div>
      
      {/* Indicateur de synchronisation avec la date visible */}
      <div className="px-2 py-1 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500">
        <div className="flex items-center">
          <Calendar className="h-3 w-3 mr-1 text-indigo-500" />
          {selectedDate ? (
            <span>
              Synchronisé avec <span className="font-medium text-indigo-600">{format(new Date(selectedDate), 'd MMMM', { locale: fr })}</span>
            </span>
          ) : (
            <span>Faites défiler pour synchroniser</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermanentPlanningPreview;
