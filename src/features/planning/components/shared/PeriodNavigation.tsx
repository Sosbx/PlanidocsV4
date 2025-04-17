import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { ViewType, DateRange } from '../../types/viewTypes';

interface PeriodNavigationProps {
  viewType: ViewType;
  dateRange: DateRange;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
}

/**
 * Composant pour la navigation entre les périodes
 */
const PeriodNavigation: React.FC<PeriodNavigationProps> = ({
  viewType,
  dateRange,
  onPrevious,
  onNext,
  onReset
}) => {
  // Formater la période en fonction du type de vue
  const formatPeriod = () => {
    const { startDate, endDate } = dateRange;
    
    switch (viewType) {
      case 'month':
        return format(startDate, 'MMMM yyyy', { locale: fr });
      case 'quadrimester':
        return `${format(startDate, 'MMM', { locale: fr })} - ${format(endDate, 'MMM yyyy', { locale: fr })}`;
      case 'semester':
        return `${format(startDate, 'MMM', { locale: fr })} - ${format(endDate, 'MMM yyyy', { locale: fr })}`;
      case 'year':
        return format(startDate, 'yyyy');
      case 'custom':
        return `${format(startDate, 'dd MMM', { locale: fr })} - ${format(endDate, 'dd MMM yyyy', { locale: fr })}`;
      default:
        return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
    }
  };

  return (
    <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
      <button
        onClick={onPrevious}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Période précédente"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600" />
      </button>
      
      <div className="flex items-center">
        <span className="text-sm font-medium text-gray-700">{formatPeriod()}</span>
        <button
          onClick={onReset}
          className="ml-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          title="Aujourd'hui"
        >
          <Calendar className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      
      <button
        onClick={onNext}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Période suivante"
      >
        <ChevronRight className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  );
};

export default PeriodNavigation;
