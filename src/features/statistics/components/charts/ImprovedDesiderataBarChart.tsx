import React, { useState, useMemo } from 'react';
import { startOfMonthParis, endOfMonthParis, formatParisDate } from '@/utils/timezoneUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Calendar, Filter, Maximize2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import type { DesiderataStats, DoctorStats } from '../../types';

interface ImprovedDesiderataBarChartProps {
  stats: DesiderataStats[];
  doctorStats?: DoctorStats[];
  showPeriods?: boolean;
}

type PeriodFilter = 'last30' | 'all' | 'month';

const ImprovedDesiderataBarChart: React.FC<ImprovedDesiderataBarChartProps> = ({ 
  stats,
  doctorStats = [],
  showPeriods = true 
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('last30');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Obtenir les mois disponibles
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    stats.forEach(stat => {
      const monthKey = formatParisDate(new Date(stat.date), 'yyyy-MM');
      months.add(monthKey);
    });
    return Array.from(months).sort();
  }, [stats]);

  // Filtrer les données selon la période sélectionnée
  const filteredStats = useMemo(() => {
    switch (periodFilter) {
      case 'last30':
        return stats.slice(-30);
      case 'month':
        if (!selectedMonth) return stats.slice(-30);
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = startOfMonthParis(new Date(year, month - 1));
        const endDate = endOfMonthParis(new Date(year, month - 1));
        return stats.filter(stat => 
          isWithinInterval(new Date(stat.date), { start: startDate, end: endDate })
        );
      case 'all':
      default:
        return stats;
    }
  }, [stats, periodFilter, selectedMonth]);

  // Calculer la moyenne mobile sur 7 jours
  const dataWithMovingAverage = useMemo(() => {
    return filteredStats.map((day, index) => {
      const start = Math.max(0, index - 3);
      const end = Math.min(filteredStats.length, index + 4);
      const subset = filteredStats.slice(start, end);
      const movingAverage = subset.reduce((sum, d) => sum + d.overallPercentage, 0) / subset.length;

      return {
        date: formatParisDate(new Date(day.date), 'dd/MM', { locale: frLocale }),
        fullDate: day.date,
        dayOfWeek: formatParisDate(new Date(day.date), 'EEE', { locale: frLocale }),
        matin: day.periods.M.percentage,
        aprèsMidi: day.periods.AM.percentage,
        soir: day.periods.S.percentage,
        global: day.overallPercentage,
        movingAverage: Math.round(movingAverage),
        isWeekend: day.isWeekend,
        isHoliday: day.isHoliday,
        totalUnavailable: day.totalUnavailable
      };
    });
  }, [filteredStats]);

  // Calculer la moyenne globale
  const averagePercentage = useMemo(() => {
    if (filteredStats.length === 0) return 0;
    return Math.round(
      filteredStats.reduce((sum, stat) => sum + stat.overallPercentage, 0) / filteredStats.length
    );
  }, [filteredStats]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-sm">{data.dayOfWeek} {label}</p>
          {data.isWeekend && <p className="text-xs text-yellow-600">Weekend</p>}
          {data.isHoliday && <p className="text-xs text-red-600">Jour férié</p>}
          <div className="mt-2 space-y-1">
            {showPeriods && (
              <>
                <p className="text-xs">
                  <span className="text-gray-600">Matin:</span> 
                  <span className="font-semibold ml-1" style={{ color: '#f59e0b' }}>{data.matin}%</span>
                </p>
                <p className="text-xs">
                  <span className="text-gray-600">Après-midi:</span> 
                  <span className="font-semibold ml-1" style={{ color: '#0ea5e9' }}>{data.aprèsMidi}%</span>
                </p>
                <p className="text-xs">
                  <span className="text-gray-600">Soir:</span> 
                  <span className="font-semibold ml-1" style={{ color: '#8b5cf6' }}>{data.soir}%</span>
                </p>
              </>
            )}
            <p className="text-xs font-semibold border-t pt-1">
              <span className="text-gray-600">Global:</span> 
              <span className="ml-1">{data.global}%</span>
            </p>
            <p className="text-xs">
              <span className="text-gray-600">Médecins indispo:</span> 
              <span className="ml-1">{data.totalUnavailable}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculer le nombre de weekends complets avec indisponibilités
  const weekendStats = useMemo(() => {
    let weekendCount = 0;
    let i = 0;
    
    while (i < filteredStats.length) {
      const currentDay = new Date(filteredStats[i].date).getDay();
      
      // Si on trouve un samedi
      if (currentDay === 6 && i + 1 < filteredStats.length) {
        const nextDay = new Date(filteredStats[i + 1].date).getDay();
        
        // Vérifier que le jour suivant est bien un dimanche
        if (nextDay === 0) {
          // Vérifier si au moins un des deux jours a des indisponibilités
          if (filteredStats[i].totalUnavailable > 0 || filteredStats[i + 1].totalUnavailable > 0) {
            weekendCount++;
          }
          i += 2; // Passer au lundi suivant
          continue;
        }
      }
      i++;
    }
    
    // Calculer la moyenne de weekends par médecin
    const averageWeekendsPerDoctor = doctorStats.length > 0
      ? doctorStats.reduce((sum, doc) => sum + doc.weekendCount, 0) / doctorStats.length
      : 0;
    
    return {
      totalWeekends: weekendCount,
      averagePerDoctor: Math.round(averageWeekendsPerDoctor * 10) / 10
    };
  }, [filteredStats, doctorStats]);

  // Couleur des barres selon le type de jour
  const getBarColor = (entry: any, dataKey: string) => {
    if (entry.isHoliday) {
      return dataKey === 'matin' ? '#dc2626' : dataKey === 'aprèsMidi' ? '#ef4444' : '#f87171';
    }
    if (entry.isWeekend) {
      return dataKey === 'matin' ? '#d97706' : dataKey === 'aprèsMidi' ? '#f59e0b' : '#fbbf24';
    }
    return dataKey === 'matin' ? '#f59e0b' : dataKey === 'aprèsMidi' ? '#0ea5e9' : '#8b5cf6';
  };

  const chartHeight = isFullscreen ? 600 : 400;

  return (
    <div className={`bg-white rounded-lg shadow ${isFullscreen ? 'fixed inset-0 z-50 p-8' : 'p-6'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-lg font-medium text-gray-900">
          Distribution des indisponibilités par jour
        </h3>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
            <Filter className="h-4 w-4 text-gray-600" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="text-sm border-0 bg-transparent focus:ring-0"
            >
              <option value="last30">30 derniers jours</option>
              <option value="month">Mois spécifique</option>
              <option value="all">Toute la période</option>
            </select>
            
            {periodFilter === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm border-0 bg-transparent focus:ring-0 ml-2"
              >
                <option value="">Choisir un mois</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>
                    {formatParisDate(new Date(month + '-01'), 'MMMM yyyy', { locale: frLocale })}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Maximize2 className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">Période affichée</p>
          <p className="text-lg font-semibold text-gray-900">{filteredStats.length} jours</p>
        </div>
        <div className="bg-indigo-50 p-3 rounded-lg">
          <p className="text-sm text-indigo-600">Moyenne globale</p>
          <p className="text-lg font-semibold text-indigo-900">{averagePercentage}%</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <p className="text-sm text-yellow-600">Weekends indispo</p>
          <p className="text-lg font-semibold text-yellow-900">
            {weekendStats.totalWeekends}
          </p>
          <p className="text-xs text-yellow-700">Moy/médecin: {weekendStats.averagePerDoctor}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <p className="text-sm text-red-600">Jours fériés</p>
          <p className="text-lg font-semibold text-red-900">
            {filteredStats.filter(s => s.isHoliday).length}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart 
          data={dataWithMovingAverage} 
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11 }}
            interval={filteredStats.length > 60 ? 'preserveStartEnd' : 0}
          />
          <YAxis 
            label={{ value: 'Pourcentage (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Ligne de référence pour la moyenne */}
          <ReferenceLine 
            y={averagePercentage} 
            stroke="#6366f1" 
            strokeDasharray="5 5" 
            label={{ value: `Moyenne: ${averagePercentage}%`, position: 'right' }}
          />
          
          {showPeriods ? (
            <>
              <Bar dataKey="matin" name="Matin" stackId="a">
                {dataWithMovingAverage.map((entry, index) => (
                  <Cell key={`cell-matin-${index}`} fill={getBarColor(entry, 'matin')} />
                ))}
              </Bar>
              <Bar dataKey="aprèsMidi" name="Après-midi" stackId="a">
                {dataWithMovingAverage.map((entry, index) => (
                  <Cell key={`cell-am-${index}`} fill={getBarColor(entry, 'aprèsMidi')} />
                ))}
              </Bar>
              <Bar dataKey="soir" name="Soir" stackId="a">
                {dataWithMovingAverage.map((entry, index) => (
                  <Cell key={`cell-soir-${index}`} fill={getBarColor(entry, 'soir')} />
                ))}
              </Bar>
            </>
          ) : (
            <Bar dataKey="global" fill="#6366f1" name="Global">
              {dataWithMovingAverage.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isHoliday ? '#ef4444' : entry.isWeekend ? '#f59e0b' : '#6366f1'} 
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Légende des couleurs */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-indigo-500 rounded"></div>
          <span className="text-gray-600">Jour normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-gray-600">Weekend</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-600">Jour férié</span>
        </div>
      </div>

      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          <Calendar className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default ImprovedDesiderataBarChart;