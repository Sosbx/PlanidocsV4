import React, { useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format, isWithinInterval } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { GraduationCap } from 'lucide-react';
import { 
  getOverlappingPeriods,
  HOLIDAY_COLORS,
  type SchoolPeriod
} from '../../utils/schoolPeriods';
import { usePlanningConfig } from '../../../../context/planning/PlanningContext';
import type { DesiderataStats } from '../../types';

interface HolidayPeriodStats {
  period: SchoolPeriod;
  averagePercentage: number;
  totalDays: number;
  dates: string[];
}

interface SchoolPeriodDesiderataChartProps {
  stats: DesiderataStats[];
}

export const SchoolPeriodDesiderataChart: React.FC<SchoolPeriodDesiderataChartProps> = ({ stats }) => {
  const { config } = usePlanningConfig();

  const holidayPeriodStats = useMemo(() => {
    if (!config.isConfigured || !stats || stats.length === 0) return [];

    const startDate = config.startDate;
    const endDate = config.endDate;
    
    // Obtenir toutes les périodes de vacances qui chevauchent avec la période de planning
    const overlappingPeriods = getOverlappingPeriods(startDate, endDate)
      .filter(period => period.type === 'holiday');
    
    // Calculer les statistiques pour chaque période de vacances
    const holidayStats: HolidayPeriodStats[] = [];
    
    overlappingPeriods.forEach(period => {
      // Calculer l'intersection entre la période de vacances et la période de planning
      const periodStart = period.start > startDate ? period.start : startDate;
      const periodEnd = period.end < endDate ? period.end : endDate;
      
      // Collecter toutes les dates et pourcentages de cette période
      const periodDates: string[] = [];
      let totalPercentage = 0;
      let dayCount = 0;
      
      stats.forEach(stat => {
        const statDate = new Date(stat.date);
        if (isWithinInterval(statDate, { start: periodStart, end: periodEnd })) {
          periodDates.push(stat.date);
          totalPercentage += stat.overallPercentage;
          dayCount++;
        }
      });
      
      if (dayCount > 0) {
        holidayStats.push({
          period,
          averagePercentage: Math.round((totalPercentage / dayCount) * 10) / 10,
          totalDays: dayCount,
          dates: periodDates
        });
      }
    });
    
    return holidayStats.sort((a, b) => b.averagePercentage - a.averagePercentage);
  }, [config, stats]);

  if (!config.isConfigured || holidayPeriodStats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <GraduationCap className="h-5 w-5" />
          <p>Aucune période de vacances scolaires dans la période de planning</p>
        </div>
      </div>
    );
  }

  // Calculer la moyenne globale pour comparaison
  const overallAverage = stats.length > 0 
    ? Math.round((stats.reduce((sum, s) => sum + s.overallPercentage, 0) / stats.length) * 10) / 10
    : 0;

  // Fonction pour obtenir l'icône de la période
  const getPeriodIcon = (periodType: string) => {
    switch (periodType) {
      case 'toussaint': return '🎃';
      case 'noel': return '🎄';
      case 'hiver': return '⛷️';
      case 'printemps': return '🌸';
      case 'ete': return '☀️';
      default: return '📅';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-indigo-600" />
          Taux d'indisponibilité pendant les vacances scolaires
        </h3>
        <span className="text-sm text-gray-500">
          Zone A - Académie de Bordeaux
        </span>
      </div>
      
      {/* Moyenne globale de référence */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Moyenne globale sur la période</span>
          <span className="text-lg font-semibold text-gray-900">{overallAverage}%</span>
        </div>
      </div>
      
      {/* Liste des périodes de vacances */}
      <div className="space-y-3">
        {holidayPeriodStats.map((stat, index) => {
          const isAboveAverage = stat.averagePercentage > overallAverage;
          const percentDiff = Math.abs(stat.averagePercentage - overallAverage);
          
          return (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
              style={{ borderColor: stat.period.color }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getPeriodIcon(stat.period.type)}</span>
                  <div>
                    <h5 className="font-medium text-gray-900">{stat.period.name}</h5>
                    <p className="text-sm text-gray-500">
                      {formatParisDate(stat.period.start, 'dd MMM', { locale: frLocale })} - {formatParisDate(stat.period.end, 'dd MMM yyyy', { locale: frLocale })}
                      <span className="text-gray-400 ml-2">({stat.totalDays} jours)</span>
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: stat.period.color }}>
                      {stat.averagePercentage}%
                    </span>
                    {isAboveAverage ? (
                      <span className="text-xs text-red-600 font-medium">
                        +{percentDiff.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">
                        -{percentDiff.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">de médecins indisponibles</p>
                </div>
              </div>
              
              {/* Barre de progression visuelle */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(stat.averagePercentage, 100)}%`,
                      backgroundColor: stat.period.color
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Légende */}
      <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center">
        Les pourcentages représentent la moyenne des médecins indisponibles pendant chaque période de vacances
      </div>
    </div>
  );
};