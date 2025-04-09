import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, subDays, isSameDay, startOfWeek, endOfWeek, isToday as isDateToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ArrowDown, ArrowUpDown, ArrowLeftRight } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'month' | '5days'>('5days');
  
  // Toujours passer en mode 5 jours quand une date est sélectionnée
  useEffect(() => {
    if (selectedDate) {
      setViewMode('5days');
    }
  }, [selectedDate]);

  // Générer un tableau de dates pour la période
  const getDates = () => {
    if (viewMode === '5days') {
      // Mode 5 jours centré sur la date courante (date sélectionnée en 3ème position)
      const centerDate = selectedDate ? new Date(selectedDate) : currentDate;
      
      // Générer 5 jours avec 2 jours avant et 2 jours après
      return [
        subDays(centerDate, 2), // -2 jours
        subDays(centerDate, 1), // -1 jour
        centerDate,             // Date centrale (position 3)
        addDays(centerDate, 1), // +1 jour
        addDays(centerDate, 2)  // +2 jours
      ];
    } else {
      // Mode mois: afficher 31 jours
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const dates = [];
      for (let i = 0; i < daysInMonth; i++) {
        dates.push(addDays(start, i));
      }
      return dates;
    }
  };

  // Générer les dates et s'assurer que la date sélectionnée est centrée en mode 5 jours
  let dates = getDates();

  const navigatePrevious = () => {
    if (viewMode === '5days') {
      setCurrentDate(subDays(currentDate, 5));
    } else {
      // En mode mois, reculer d'un mois
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === '5days') {
      setCurrentDate(addDays(currentDate, 5));
    } else {
      // En mode mois, avancer d'un mois
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === '5days' ? 'month' : '5days');
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
  const dateLabelRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(true);
  const [visibleDateLabel, setVisibleDateLabel] = useState<string | null>(null);
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
      setVisibleDateLabel(selectedDate);
      
      // Animation de l'étiquette de date
      if (dateLabelRef.current) {
        dateLabelRef.current.classList.remove('date-indicator-update');
        void dateLabelRef.current.offsetWidth; // Force reflow
        dateLabelRef.current.classList.add('date-indicator-update');
      }
      
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
  
  // S'assurer que la date sélectionnée est toujours visible dans la vue
  useEffect(() => {
    // Forcer la régénération des dates quand le viewMode change
    // pour placer correctement la date sélectionnée au centre
    if (viewMode === '5days') {
      // Si une date est sélectionnée, l'utiliser comme centre
      if (selectedDate) {
        setCurrentDate(new Date(selectedDate));
      } else {
        // Sinon, revenir à la date d'aujourd'hui comme point central
        setCurrentDate(new Date());
      }
    }
  }, [viewMode, selectedDate]);

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 w-full flex flex-col ${className} ${isSyncActive ? 'sync-active scale-[1.02]' : ''} sticky-container`}>
      <div className="sync-indicator"></div>
      <div className="px-3 py-2 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
        <h3 className="text-sm font-semibold text-indigo-700 planning-title">
          {viewMode === 'month' 
            ? format(currentDate, 'MMMM yyyy', { locale: fr }) 
            : 'Semaine'}
        </h3>
        <div className="flex items-center gap-1">
          <div className="flex">
            <button 
              onClick={navigatePrevious}
              className="p-1 rounded-l border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button 
              onClick={toggleViewMode}
              className="p-1 border border-gray-300 border-l-0 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              <Calendar className="h-4 w-4 text-gray-600" />
            </button>
            <button 
              onClick={navigateNext}
              className="p-1 rounded-r border border-gray-300 border-l-0 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-1 relative overflow-auto flex-1">
        <table ref={tableRef} className="w-full text-[10px] sm:text-xs planning-transition">
          <thead>
            <tr>
              <th className="py-1.5 px-2 text-left font-medium text-gray-600 bg-gray-50 rounded-tl-md w-[31%]">
                {viewMode === 'month' ? format(currentDate, 'MMM', { locale: fr }) : 'Jour'}
              </th>
              <th className="py-1.5 px-1 text-center font-medium text-amber-600 bg-amber-50/50 w-[23%]">M</th>
              <th className="py-1.5 px-1 text-center font-medium text-sky-600 bg-sky-50/50 w-[23%]">AM</th>
              <th className="py-1.5 px-1 text-center font-medium text-violet-600 bg-violet-50/50 rounded-tr-md w-[23%]">S</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              // Vérifier si cette date correspond à la date sélectionnée
              const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === selectedDate;
              const isToday = isSameDay(new Date(), date);
              const isWeekend = isGrayedOut(date);

              return (
                <tr 
                  key={dateStr} 
                  ref={isSelected ? selectedRowRef : null}
                  className={`
                    border-b border-gray-100 last:border-0
                    ${isSelected ? 'bg-indigo-100/70' : ''}
                    ${isToday ? 'bg-yellow-50/50' : ''}
                    ${isWeekend ? 'bg-gray-50/60' : ''}
                    hover:bg-gray-50/80 transition-all duration-200
                  `}
                >
                  <td className="py-1 sm:py-2 px-1 sm:px-2">
                    <div className={`${isSelected ? 'bg-indigo-50 rounded px-1.5 py-0.5 ring-1 ring-indigo-200' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1">
                        <span className={`text-[12px] sm:text-xs font-semibold ${isSelected ? 'text-indigo-700' : isToday ? 'text-yellow-700' : isWeekend ? 'text-red-600' : ''}`}>
                          {format(date, 'd', { locale: fr })}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] text-gray-500 ${isSelected ? 'text-indigo-500' : ''}`}>
                          {format(date, 'EEE', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </td>
                  {['M', 'AM', 'S'].map(period => {
                    const key = `${dateStr}-${period}`;
                    const assignment = assignments[key];
                    return (
                      <td key={period} className="py-1 sm:py-2 px-0.5 sm:px-1 text-center">
                        {assignment && (
                          <span className={`
                            inline-block text-[9px] sm:text-xs font-medium px-1 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm w-full min-w-[30px]
                            ${period === 'M' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              period === 'AM' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                              'bg-violet-100 text-violet-800 border border-violet-300'}
                            ${isSelected ? 'shadow-md planning-transition' : ''}
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
      
      {/* Barre d'état minimaliste */}
      <div 
        ref={dateLabelRef}
        className="px-3 py-1.5 bg-white border-t border-gray-200 flex items-center justify-between text-xs"
      >
        <div className="flex items-center gap-1.5">
          {isSyncActive && selectedDate && (
            <>
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-gray-500">synchronisé</span>
            </>
          )}
        </div>
        
        <div className="text-right text-[10px] text-gray-500">
          {viewMode === 'month' 
            ? `${Object.keys(assignments).length} gardes` 
            : selectedDate 
              ? format(new Date(selectedDate), 'MMMM yyyy', { locale: fr })
              : ''}
        </div>
      </div>
    </div>
  );
};

export default PermanentPlanningPreview;
