import React, { useState, useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  Dot
} from 'recharts';
import { TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO, getWeek } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import type { DesiderataStats } from '../../types';

interface ImprovedTrendsLineChartProps {
  stats: DesiderataStats[];
}

type ViewMode = 'weekly' | 'monthly';

interface WeekData {
  weekRange: string;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  matin: { avg: number; min: number; max: number; values: number[] };
  aprèsMidi: { avg: number; min: number; max: number; values: number[] };
  soir: { avg: number; min: number; max: number; values: number[] };
  global: { avg: number; min: number; max: number; values: number[] };
  dayCount: number;
  criticalDays: number;
}

const ImprovedTrendsLineChart: React.FC<ImprovedTrendsLineChartProps> = ({ stats }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [showMinMax, setShowMinMax] = useState(true);
  const [highlightCritical, setHighlightCritical] = useState(true);

  // Grouper les données par semaine avec plages de dates
  const weeklyData = useMemo(() => {
    const weeks = new Map<string, WeekData>();
    
    stats.forEach(day => {
      const date = parseISO(day.date);
      const weekStart = startOfWeek(date, { locale: frLocale });
      const weekEnd = endOfWeek(date, { locale: frLocale });
      const weekKey = formatParisDate(weekStart, 'yyyy-MM-dd');
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          weekRange: `${formatParisDate(weekStart, 'd')} - ${formatParisDate(weekEnd, 'd MMM', { locale: frLocale })}`,
          weekNumber: getWeek(date, { locale: frLocale }),
          startDate: weekStart,
          endDate: weekEnd,
          matin: { avg: 0, min: 100, max: 0, values: [] },
          aprèsMidi: { avg: 0, min: 100, max: 0, values: [] },
          soir: { avg: 0, min: 100, max: 0, values: [] },
          global: { avg: 0, min: 100, max: 0, values: [] },
          dayCount: 0,
          criticalDays: 0
        });
      }
      
      const week = weeks.get(weekKey)!;
      
      // Ajouter les valeurs
      week.matin.values.push(day.periods.M.percentage);
      week.aprèsMidi.values.push(day.periods.AM.percentage);
      week.soir.values.push(day.periods.S.percentage);
      week.global.values.push(day.overallPercentage);
      
      // Compter les jours critiques
      if (day.overallPercentage > 50) {
        week.criticalDays++;
      }
      
      week.dayCount++;
    });
    
    // Calculer les statistiques pour chaque semaine
    weeks.forEach(week => {
      ['matin', 'aprèsMidi', 'soir', 'global'].forEach(period => {
        const data = week[period as keyof WeekData] as any;
        if (data.values.length > 0) {
          data.avg = Math.round(data.values.reduce((sum: number, v: number) => sum + v, 0) / data.values.length);
          data.min = Math.min(...data.values);
          data.max = Math.max(...data.values);
        }
      });
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [stats]);

  // Données mensuelles
  const monthlyData = useMemo(() => {
    const months = new Map<string, any>();
    
    stats.forEach(day => {
      const monthKey = day.date.substring(0, 7);
      
      if (!months.has(monthKey)) {
        months.set(monthKey, {
          month: formatParisDate(parseISO(day.date), 'MMMM yyyy', { locale: frLocale }),
          matin: [],
          aprèsMidi: [],
          soir: [],
          global: [],
          criticalDays: 0
        });
      }
      
      const month = months.get(monthKey)!;
      month.matin.push(day.periods.M.percentage);
      month.aprèsMidi.push(day.periods.AM.percentage);
      month.soir.push(day.periods.S.percentage);
      month.global.push(day.overallPercentage);
      
      if (day.overallPercentage > 50) {
        month.criticalDays++;
      }
    });
    
    return Array.from(months.entries()).map(([key, data]) => ({
      month: data.month,
      matin: Math.round(data.matin.reduce((a: number, b: number) => a + b, 0) / data.matin.length),
      aprèsMidi: Math.round(data.aprèsMidi.reduce((a: number, b: number) => a + b, 0) / data.aprèsMidi.length),
      soir: Math.round(data.soir.reduce((a: number, b: number) => a + b, 0) / data.soir.length),
      global: Math.round(data.global.reduce((a: number, b: number) => a + b, 0) / data.global.length),
      criticalDays: data.criticalDays
    }));
  }, [stats]);

  const chartData = viewMode === 'weekly' ? weeklyData : monthlyData;

  // Moyenne globale
  const globalAverage = useMemo(() => {
    return Math.round(stats.reduce((sum, stat) => sum + stat.overallPercentage, 0) / stats.length);
  }, [stats]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = viewMode === 'weekly' ? weeklyData.find(w => w.weekRange === label) : null;
      
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-sm mb-2">{label}</p>
          
          {viewMode === 'weekly' && data && (
            <div className="mb-2 text-xs text-gray-600">
              <p>{data.dayCount} jours analysés</p>
              {data.criticalDays > 0 && (
                <p className="text-red-600 font-medium">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {data.criticalDays} jour{data.criticalDays > 1 ? 's' : ''} critique{data.criticalDays > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => {
              const weekData = viewMode === 'weekly' && data ? 
                data[entry.dataKey.replace('Avg', '') as keyof WeekData] as any : null;
              
              return (
                <div key={index} className="text-xs">
                  <p style={{ color: entry.color }}>
                    <span className="font-medium">{entry.name}:</span> {entry.value}%
                  </p>
                  {viewMode === 'weekly' && showMinMax && weekData && weekData.min !== undefined && (
                    <p className="text-gray-500 ml-2">
                      Min: {weekData.min}% | Max: {weekData.max}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (highlightCritical && payload.globalAvg > 50) {
      return (
        <circle 
          cx={cx} 
          cy={cy} 
          r={6} 
          fill="#ef4444" 
          stroke="#fff" 
          strokeWidth={2}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Tendances {viewMode === 'weekly' ? 'hebdomadaires' : 'mensuelles'} des indisponibilités
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Évolution sur {chartData.length} {viewMode === 'weekly' ? 'semaines' : 'mois'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'weekly' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Semaines
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'monthly' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mois
            </button>
          </div>
          
          {viewMode === 'weekly' && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showMinMax}
                onChange={(e) => setShowMinMax(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              Min/Max
            </label>
          )}
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={highlightCritical}
              onChange={(e) => setHighlightCritical(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600"
            />
            Semaines critiques
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart 
          data={chartData} 
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis 
            dataKey={viewMode === 'weekly' ? 'weekRange' : 'month'} 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11 }}
            interval={chartData.length > 20 ? 'preserveStartEnd' : 0}
          />
          <YAxis 
            label={{ value: 'Pourcentage (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Ligne de référence pour la moyenne globale */}
          <ReferenceLine 
            y={globalAverage} 
            stroke="#6b7280" 
            strokeDasharray="5 5" 
            label={{ value: `Moyenne: ${globalAverage}%`, position: 'right' }}
          />
          
          {/* Zone critique au-dessus de 50% */}
          <ReferenceLine 
            y={50} 
            stroke="#ef4444" 
            strokeDasharray="3 3" 
            opacity={0.5}
            label={{ value: 'Seuil critique', position: 'left' }}
          />
          
          {/* Zones d'écart-type pour la tendance globale (weekly uniquement) */}
          {viewMode === 'weekly' && showMinMax && (
            <Area
              type="monotone"
              dataKey="global.max"
              stackId="1"
              stroke="none"
              fill="#6366f1"
              fillOpacity={0.1}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey={viewMode === 'weekly' ? 'matin.avg' : 'matin'}
            stroke="#f59e0b" 
            name="Matin"
            strokeWidth={2}
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey={viewMode === 'weekly' ? 'aprèsMidi.avg' : 'aprèsMidi'}
            stroke="#0ea5e9" 
            name="Après-midi"
            strokeWidth={2}
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey={viewMode === 'weekly' ? 'soir.avg' : 'soir'}
            stroke="#8b5cf6" 
            name="Soir"
            strokeWidth={2}
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey={viewMode === 'weekly' ? 'global.avg' : 'global'}
            stroke="#6366f1" 
            name="Global"
            strokeWidth={3}
            dot={<CustomDot />}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Indicateurs de tendance */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-600" />
            <p className="text-sm text-gray-600">Tendance</p>
          </div>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {chartData.length > 1 && 
              ((chartData[chartData.length - 1] as any)[viewMode === 'weekly' ? 'global' : 'global'][viewMode === 'weekly' ? 'avg' : ''] >
               (chartData[0] as any)[viewMode === 'weekly' ? 'global' : 'global'][viewMode === 'weekly' ? 'avg' : ''] ? '↑' : '↓')
            } Évolution
          </p>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-600">Périodes critiques</p>
          </div>
          <p className="text-lg font-semibold text-red-900 mt-1">
            {chartData.filter((d: any) => 
              (d[viewMode === 'weekly' ? 'global' : 'global'][viewMode === 'weekly' ? 'avg' : ''] || d.global) > 50
            ).length}
          </p>
        </div>
        
        <div className="bg-yellow-50 p-3 rounded-lg">
          <p className="text-sm text-yellow-600">Pic matin</p>
          <p className="text-lg font-semibold text-yellow-900 mt-1">
            {Math.max(...chartData.map((d: any) => 
              d[viewMode === 'weekly' ? 'matin' : 'matin'][viewMode === 'weekly' ? 'avg' : ''] || d.matin
            ))}%
          </p>
        </div>
        
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-sm text-purple-600">Pic soir</p>
          <p className="text-lg font-semibold text-purple-900 mt-1">
            {Math.max(...chartData.map((d: any) => 
              d[viewMode === 'weekly' ? 'soir' : 'soir'][viewMode === 'weekly' ? 'avg' : ''] || d.soir
            ))}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImprovedTrendsLineChart;