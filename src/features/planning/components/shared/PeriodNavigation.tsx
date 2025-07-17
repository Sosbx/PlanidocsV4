import React from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
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
        return formatParisDate(startDate, 'MMMM yyyy', { locale: frLocale });
      case 'quadrimester':
        return `${formatParisDate(startDate, 'MMM', { locale: frLocale })} - ${formatParisDate(endDate, 'MMM yyyy', { locale: frLocale })}`;
      case 'semester':
        return `${formatParisDate(startDate, 'MMM', { locale: frLocale })} - ${formatParisDate(endDate, 'MMM yyyy', { locale: frLocale })}`;
      case 'year':
        return formatParisDate(startDate, 'yyyy');
      case 'custom':
        return `${formatParisDate(startDate, 'dd MMM', { locale: frLocale })} - ${formatParisDate(endDate, 'dd MMM yyyy', { locale: frLocale })}`;
      default:
        return `${formatParisDate(startDate, 'dd/MM/yyyy')} - ${formatParisDate(endDate, 'dd/MM/yyyy')}`;
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
