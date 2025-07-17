import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { format, addDays, subDays, isSameDay, startOfWeek, endOfWeek, isToday as isDateToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ArrowDown, ArrowUpDown, ArrowLeftRight, Plus, Minus, Eye, UserCheck } from 'lucide-react';
import '../../../features/planning/components/PlanningTransition.css';
import '../../../styles/BadgeStyles.css';
import { isGrayedOut, formatWithCapitalizedMonth } from '../../../utils/dateUtils';
import type { ShiftAssignment, PeriodSelection } from '../types';
import { useDesiderataState } from "../../../features/planning/hooks/useDesiderataState";

interface PermanentPlanningPreviewProps {
  assignments: Record<string, ShiftAssignment>;
  selectedDate?: string;
  className?: string;
  showDesiderata?: boolean;
  onToggleDesiderata?: () => void;
  interestedPeriods?: Record<string, boolean>;
  conflictPeriods?: Record<string, boolean>;
  hidePrimaryDesiderata?: boolean;
  hideSecondaryDesiderata?: boolean;
}

const PermanentPlanningPreview: React.FC<PermanentPlanningPreviewProps> = ({
  assignments,
  selectedDate,
  className = '',
  showDesiderata = false,
  onToggleDesiderata,
  interestedPeriods = {},
  conflictPeriods = {},
  hidePrimaryDesiderata = false,
  hideSecondaryDesiderata = false,
}) => {
  // Access user's desiderata (includeArchived = true pour afficher tous les désidératas)
  const { selections, isLoading } = useDesiderataState(true);
  const initialDate = selectedDate ? new Date(selectedDate) : createParisDate();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [viewMode, setViewMode] = useState<'month' | '5days'>('month');
  
  // Ne pas passer automatiquement en mode 5 jours quand une date est sélectionnée
  // L'utilisateur doit le faire manuellement ou utiliser le bouton retour

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
  const dates = getDates();

  const navigatePrevious = () => {
    if (viewMode === '5days') {
      setCurrentDate(subDays(currentDate, 5));
      // Après changement de date, vérifier si la date sélectionnée est toujours visible
      setTimeout(() => {
        scrollToSelectedDate();
      }, 50);
    } else {
      // En mode mois, reculer d'un mois
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      setCurrentDate(newDate);
      
      // Si la date sélectionnée est dans ce nouveau mois, scroller vers elle
      if (selectedDate) {
        const selectedDateObj = new Date(selectedDate);
        if (selectedDateObj.getMonth() === newDate.getMonth() && 
            selectedDateObj.getFullYear() === newDate.getFullYear()) {
          setTimeout(scrollToSelectedDate, 50);
        }
      }
    }
  };

  const navigateNext = () => {
    if (viewMode === '5days') {
      setCurrentDate(addDays(currentDate, 5));
      // Après changement de date, vérifier si la date sélectionnée est toujours visible
      setTimeout(() => {
        scrollToSelectedDate();
      }, 50);
    } else {
      // En mode mois, avancer d'un mois
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      setCurrentDate(newDate);
      
      // Si la date sélectionnée est dans ce nouveau mois, scroller vers elle
      if (selectedDate) {
        const selectedDateObj = new Date(selectedDate);
        if (selectedDateObj.getMonth() === newDate.getMonth() && 
            selectedDateObj.getFullYear() === newDate.getFullYear()) {
          setTimeout(scrollToSelectedDate, 50);
        }
      }
    }
  };

  const toggleViewMode = () => {
    // Changer le mode de vue
    const newViewMode = viewMode === '5days' ? 'month' : '5days';
    setViewMode(newViewMode);
    
    // Assurer que la date sélectionnée est visible dans le nouveau mode
    if (selectedDate) {
      if (newViewMode === '5days') {
        // En passant au mode 5 jours, centrer sur la date sélectionnée
        setCurrentDate(new Date(selectedDate));
      } else {
        // En passant au mode mois, s'assurer que le mois affiché contient la date sélectionnée
        const selectedDateObj = new Date(selectedDate);
        setCurrentDate(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1));
      }
      
      // Scroller vers la date sélectionnée après changement de mode
      // Délai plus long pour laisser le temps au DOM de se mettre à jour complètement
      setTimeout(scrollToSelectedDate, 300);
    }
  };

  // Référence pour le scroll automatique vers la date sélectionnée
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const prevSelectedDateRef = useRef<string | undefined>(selectedDate);

  // Fonction pour scroller vers la date sélectionnée
  const scrollToSelectedDate = useCallback(() => {
    if (selectedDate && selectedRowRef.current && tableRef.current) {
      // Marquer le début de l'animation
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
      
      return () => clearTimeout(timer);
    }
  }, [selectedDate]);
  
  // Fonction pour s'assurer que le mois affiché contient la date sélectionnée
  const ensureSelectedDateVisible = useCallback(() => {
    if (selectedDate) {
      const selectedMonth = new Date(selectedDate).getMonth();
      const selectedYear = new Date(selectedDate).getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      // Si le mois affiché ne contient pas la date sélectionnée, changer le mois
      if (selectedMonth !== currentMonth || selectedYear !== currentYear) {
        // Ajuster le mois affiché pour inclure la date sélectionnée
        setCurrentDate(new Date(selectedYear, selectedMonth, 1));
        
        // Scroller vers la date sélectionnée après changement de mois
        setTimeout(scrollToSelectedDate, 100);
        return true;
      }
    }
    return false;
  }, [selectedDate, currentDate, scrollToSelectedDate]);
  
  // Effet pour animer le scroll vers la date sélectionnée et synchroniser le mois
  useEffect(() => {
    if (selectedDate) {
      // Ne pas animer si c'est la même date
      const isSameDate = selectedDate === prevSelectedDateRef.current;
      
      // Scroller vers la date sélectionnée si elle a changé
      if (!isSameDate) {
        // Vérifier si le mois affiché contient la date sélectionnée
        // et le changer si nécessaire
        const monthChanged = ensureSelectedDateVisible();
        
        // Si le mois n'a pas changé, scroller vers la date sélectionnée
        if (!monthChanged) {
          // Laisser le temps au DOM de se mettre à jour
          const timer = setTimeout(() => {
            scrollToSelectedDate();
          }, 100);
          
          return () => clearTimeout(timer);
        }
        
        // Mettre à jour la référence de la date précédente
        prevSelectedDateRef.current = selectedDate;
      }
    }
  }, [selectedDate, scrollToSelectedDate, ensureSelectedDateVisible]);

  // Effet pour scroller automatiquement vers la date sélectionnée
  useEffect(() => {
    if (selectedDate) {
      // Pour assurer le scroll sur les appareils mobiles, on attend que le DOM soit mis à jour
      const timer = setTimeout(() => {
        // Scroller vers la date sélectionnée après un court délai
        scrollToSelectedDate();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [selectedDate, scrollToSelectedDate]);
  
  // Synchroniser la date courante avec la date sélectionnée tout en respectant
  // les changements manuels de l'utilisateur
  
  // Gérer les changements de mode d'affichage
  useEffect(() => {
    // Ne réagir qu'aux changements de viewMode pour éviter les boucles
    // et permettre à l'utilisateur de naviguer manuellement
    
    // Quand le mode d'affichage change, adapter la vue
    if (selectedDate) {
      // Utiliser un timeout pour éviter les conflits avec d'autres effets
      const timer = setTimeout(() => {
        if (viewMode === '5days') {
          // En mode 5 jours, centrer sur la date sélectionnée
          setCurrentDate(new Date(selectedDate));
        } else {
          // En mode mois, s'assurer que le mois affiché contient la date sélectionnée
          const selectedDateObj = new Date(selectedDate);
          const currentMonthDisplayed = currentDate.getMonth();
          const currentYearDisplayed = currentDate.getFullYear();
          
          // Ne changer le mois que si nécessaire
          if (selectedDateObj.getMonth() !== currentMonthDisplayed || 
              selectedDateObj.getFullYear() !== currentYearDisplayed) {
            setCurrentDate(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1));
          }
        }
        
        // Scroller vers la date sélectionnée après un délai
        setTimeout(scrollToSelectedDate, 200);
      }, 50);
      
      return () => clearTimeout(timer);
    } else if (!selectedDate) {
      // Si aucune date n'est sélectionnée, afficher le mois courant
      setCurrentDate(createParisDate());
    }
  }, [viewMode, scrollToSelectedDate]);

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 w-full flex flex-col max-w-full ${className} sticky-container`}>
      <div className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
        <div className="flex items-center gap-1 flex-shrink">
          <button 
            onClick={navigatePrevious}
            className="p-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95 flex-shrink-0"
            title="Précédent"
          >
            <ChevronLeft className="h-2.5 w-2.5 text-gray-600" />
          </button>
          
          <h3 className="text-[10px] sm:text-xs font-semibold text-gray-700 planning-title truncate max-w-[60px] xs:max-w-none flex-shrink">
            {viewMode === 'month' 
              ? formatWithCapitalizedMonth(currentDate, 'MMM yyyy') 
              : formatParisDate(currentDate, 'dd/MM', { locale: fr })}
          </h3>
          
          <button 
            onClick={navigateNext}
            className="p-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95 flex-shrink-0"
            title="Suivant"
          >
            <ChevronRight className="h-2.5 w-2.5 text-gray-600" />
          </button>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          
          {/* Bouton de changement de vue */}
          {viewMode === '5days' ? (
            <button 
              onClick={toggleViewMode}
              className="p-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95"
              title="Agrandir (vue mensuelle)"
            >
              <Plus className="h-2.5 w-2.5 text-gray-600" />
            </button>
          ) : (
            <button 
              onClick={toggleViewMode}
              className="p-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-all duration-200 active:scale-95 text-[8px]"
              title="Réduire (vue 5 jours)"
            >
              <Minus className="h-2.5 w-2.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className={`p-1 relative overflow-auto flex-1 ${
        viewMode === 'month' ? 'max-h-[60vh] sm:max-h-[65vh] scroll-smooth scroll-pb-4' : ''
      }`}>
        {viewMode === 'month' && (
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/70 to-transparent pointer-events-none z-10"></div>
        )}
        <table ref={tableRef} className="w-full text-[8px] xs:text-[9px] sm:text-[10px] planning-transition table-fixed">
          <thead>
            <tr>
              <th className="py-0.5 sm:py-1 px-1 sm:px-1.5 text-left font-medium text-gray-600 bg-gray-50 rounded-tl-md w-[27%] xs:w-[30%] sm:w-[31%]">
                {viewMode === 'month' ? formatWithCapitalizedMonth(currentDate, 'MMM') : 'Date'}
              </th>
              <th className="py-0.5 sm:py-1 px-0.5 text-center font-medium text-[#4A95D6] bg-[#E6F0FA]/20 w-[24%] sm:w-[23%]">M</th>
              <th className="py-0.5 sm:py-1 px-0.5 text-center font-medium text-[#4F46E5] bg-[#EEF2FF]/20 w-[24%] sm:w-[23%]">AM</th>
              <th className="py-0.5 sm:py-1 px-0.5 text-center font-medium text-[#9333EA] bg-[#F3E8FF]/20 rounded-tr-md w-[25%] sm:w-[23%]">S</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const dateStr = formatParisDate(date, 'yyyy-MM-dd');
              // Vérifier si cette date correspond à la date sélectionnée
              const isSelected = selectedDate && formatParisDate(date, 'yyyy-MM-dd') === selectedDate;
              const isToday = isSameDay(createParisDate(), date);
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
                  <td className="py-0.5 px-0.5 xs:px-1 sm:py-1 sm:px-1.5">
                    <div className={`${isSelected ? 'bg-indigo-50 rounded px-0.5 xs:px-1 py-0.5 ring-1 ring-indigo-200' : ''}`}>
                      <div className="flex items-center gap-0.5">
                        <span className={`text-[9px] xs:text-[10px] sm:text-[11px] font-semibold ${isSelected ? 'text-indigo-700' : isToday ? 'text-yellow-700' : isWeekend ? 'text-red-600' : ''}`}>
                          {formatParisDate(date, 'd', { locale: fr })}
                        </span>
                        <span className={`text-[7px] xs:text-[8px] sm:text-[9px] text-gray-500 ${isSelected ? 'text-indigo-500' : ''}`}>
                          {formatParisDate(date, 'E', { locale: fr }).substring(0, 1)}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  {['M', 'AM', 'S'].map(period => {
                    const key = `${dateStr}-${period}`;
                    const assignment = assignments[key];
                    
                    // Get desiderata for this period if enabled
                    const desiderata = showDesiderata && !isLoading ? selections[key]?.type : null;
                    const hasDesiderata = desiderata === 'primary' || desiderata === 'secondary';
                    
                    // Check if we should hide positions on desiderata periods
                    const shouldHidePosition = 
                      (desiderata === 'primary' && hidePrimaryDesiderata) || 
                      (desiderata === 'secondary' && hideSecondaryDesiderata);
                    
                    // Check if user is interested in shifts during this period
                    const isInterested = interestedPeriods[key] && !shouldHidePosition;
                    const hasConflict = conflictPeriods[key] && !shouldHidePosition;
                    
                    // Customize cell background based on desiderata if showing
                    let desiderataStyle = '';
                    if (showDesiderata && hasDesiderata) {
                      desiderataStyle = desiderata === 'primary' 
                        ? 'bg-red-50/40 border-red-200/60' 
                        : 'bg-blue-50/40 border-blue-200/60';
                    }
                    
                    return (
                      <td key={period} className={`py-0.5 px-0 xs:px-0.5 text-center relative ${showDesiderata && hasDesiderata ? desiderataStyle : ''}`}>
                        {/* Desiderata indicator at top of cell */}
                        {showDesiderata && hasDesiderata && (
                          <div className={`absolute top-0 left-0 right-0 h-0.5 ${desiderata === 'primary' ? 'bg-red-300/70' : 'bg-blue-300/70'}`} />
                        )}
                        
                        {/* Interest indicator in the middle of the cell */}
                        {isInterested && !assignment && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {hasConflict ? (
                              <ArrowLeftRight className="h-3 w-3 text-red-600" />
                            ) : (
                              <UserCheck className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                        )}
                        
                        {/* Conflict indicator for interested positions with assignments */}
                        {isInterested && hasConflict && assignment && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full shadow-sm flex items-center justify-center z-10">
                            <ArrowLeftRight className="h-2 w-2 text-white" />
                          </div>
                        )}
                        
                        {assignment && (
                          <span className={`
                            inline-block text-[7px] xs:text-[8px] sm:text-[9px] font-medium px-0.5 xs:px-1 py-0.5 rounded shadow-sm w-full min-w-[18px] xs:min-w-[22px] sm:min-w-[24px]
                            ${period === 'M' ? 'badge-morning' :
                              period === 'AM' ? 'badge-afternoon' :
                              'badge-evening'}
                            ${isSelected ? 'shadow-md planning-transition' : ''}
                            ${showDesiderata && hasDesiderata ? 'opacity-90' : ''}
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="scroll-indicator flex items-center justify-center bg-indigo-100/70 shadow-md rounded-full h-8 w-8 animate-pulse">
              <ArrowDown className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default PermanentPlanningPreview;
