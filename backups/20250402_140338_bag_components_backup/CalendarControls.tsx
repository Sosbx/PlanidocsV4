import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatWithCapitalizedMonth } from '../../utils/dateUtils';

interface CalendarControlsProps {
  currentMonth: Date;
  goToPrevious: () => void;
  goToNext: () => void;
  isMobile: boolean;
  isSmallScreen: boolean;
  calendarViewMode: 'month';
  setCalendarViewMode: (mode: 'month') => void;
  setCurrentMonth: (date: Date) => void;
  getDaysToDisplay: () => Date[];
}

const CalendarControls: React.FC<CalendarControlsProps> = ({
  currentMonth,
  goToPrevious,
  goToNext,
  isMobile,
  setCurrentMonth
}) => {
  // Préparer le titre - toujours en mode mois
  const title = formatWithCapitalizedMonth(currentMonth, 'MMMM yyyy');

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex justify-between items-center">
        <button 
          onClick={goToPrevious}
          className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-indigo-600 bg-white rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shadow-sm touch-action-manipulation"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="flex flex-col items-center">
          <h3 className="text-base sm:text-lg font-bold text-indigo-700">
            {title}
          </h3>
          
          {/* Bouton pour aller à aujourd'hui */}
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded-full hover:bg-indigo-50 active:bg-indigo-100"
          >
            aujourd'hui
          </button>
        </div>
        
        <button 
          onClick={goToNext}
          className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-indigo-600 bg-white rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shadow-sm touch-action-manipulation"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      
      {/* Astuce de navigation par swipe - pour mobiles */}
      {isMobile && (
        <div className="flex items-center justify-center text-[10px] text-gray-500 italic">
          <span>Glissez vers la gauche/droite pour naviguer</span>
        </div>
      )}
    </div>
  );
};

export default CalendarControls;
