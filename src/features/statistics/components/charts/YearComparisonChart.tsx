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
  ResponsiveContainer
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfWeek, parseISO } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import type { DesiderataStats } from '../../types';

interface YearComparisonChartProps {
  currentYearStats: DesiderataStats[];
  previousYearStats?: DesiderataStats[];
}

type ViewType = 'weekly' | 'monthly';

interface ComparisonData {
  period: string;
  currentYear: number;
  previousYear?: number;
  difference?: number;
}

const YearComparisonChart: React.FC<YearComparisonChartProps> = ({
  currentYearStats,
  previousYearStats
}) => {
  const [viewType, setViewType] = useState<ViewType>('weekly');

  const chartData = useMemo(() => {
    // Si pas de données de l'année précédente, retourner un tableau vide
    if (!previousYearStats || previousYearStats.length === 0) {
      return [];
    }
    const data: ComparisonData[] = [];

    if (viewType === 'weekly') {
      // Grouper par semaine
      const weeks = new Map<string, { current: number[], previous: number[] }>();
      
      // Traiter les stats de l'année courante
      currentYearStats.forEach(stat => {
        const date = parseISO(stat.date);
        const weekStart = startOfWeek(date, { locale: frLocale });
        const weekKey = formatParisDate(weekStart, 'yyyy-MM-dd');
        
        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, { current: [], previous: [] });
        }
        weeks.get(weekKey)!.current.push(stat.overallPercentage);
      });

      // Traiter les stats de l'année précédente
      previousYearStats.forEach(stat => {
        const date = parseISO(stat.date);
        const weekStart = startOfWeek(date, { locale: frLocale });
        // Ajuster l'année pour aligner les semaines
        const adjustedDate = new Date(weekStart);
        adjustedDate.setFullYear(new Date(currentYearStats[0].date).getFullYear());
        const weekKey = formatParisDate(adjustedDate, 'yyyy-MM-dd');
        
        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, { current: [], previous: [] });
        }
        weeks.get(weekKey)!.previous.push(stat.overallPercentage);
      });

      // Calculer les moyennes
      weeks.forEach((values, weekKey) => {
        const currentAvg = values.current.length > 0 
          ? Math.round(values.current.reduce((a, b) => a + b, 0) / values.current.length)
          : 0;
        const previousAvg = values.previous.length > 0
          ? Math.round(values.previous.reduce((a, b) => a + b, 0) / values.previous.length)
          : undefined;

        data.push({
          period: formatParisDate(parseISO(weekKey), 'dd MMM', { locale: frLocale }),
          currentYear: currentAvg,
          previousYear: previousAvg,
          difference: previousAvg !== undefined ? currentAvg - previousAvg : undefined
        });
      });
    } else {
      // Grouper par mois
      const months = new Map<string, { current: number[], previous: number[] }>();
      
      currentYearStats.forEach(stat => {
        const monthKey = stat.date.substring(0, 7);
        if (!months.has(monthKey)) {
          months.set(monthKey, { current: [], previous: [] });
        }
        months.get(monthKey)!.current.push(stat.overallPercentage);
      });

      previousYearStats.forEach(stat => {
        const date = parseISO(stat.date);
        const adjustedDate = new Date(date);
        adjustedDate.setFullYear(new Date(currentYearStats[0].date).getFullYear());
        const monthKey = formatParisDate(adjustedDate, 'yyyy-MM');
        
        if (!months.has(monthKey)) {
          months.set(monthKey, { current: [], previous: [] });
        }
        months.get(monthKey)!.previous.push(stat.overallPercentage);
      });

      months.forEach((values, monthKey) => {
        const currentAvg = values.current.length > 0 
          ? Math.round(values.current.reduce((a, b) => a + b, 0) / values.current.length)
          : 0;
        const previousAvg = values.previous.length > 0
          ? Math.round(values.previous.reduce((a, b) => a + b, 0) / values.previous.length)
          : undefined;

        data.push({
          period: formatParisDate(parseISO(monthKey + '-01'), 'MMM yyyy', { locale: frLocale }),
          currentYear: currentAvg,
          previousYear: previousAvg,
          difference: previousAvg !== undefined ? currentAvg - previousAvg : undefined
        });
      });
    }

    return data.sort((a, b) => a.period.localeCompare(b.period));
  }, [currentYearStats, previousYearStats, viewType]);

  // Calculer les statistiques globales
  const globalStats = useMemo(() => {
    if (!previousYearStats || previousYearStats.length === 0) {
      return { currentAvg: 0, previousAvg: 0, difference: 0, percentChange: 0 };
    }
    const currentAvg = Math.round(
      currentYearStats.reduce((sum, stat) => sum + stat.overallPercentage, 0) / currentYearStats.length
    );
    const previousAvg = Math.round(
      previousYearStats.reduce((sum, stat) => sum + stat.overallPercentage, 0) / previousYearStats.length
    );
    const difference = currentAvg - previousAvg;
    const percentChange = previousAvg !== 0 ? Math.round((difference / previousAvg) * 100) : 0;

    return { currentAvg, previousAvg, difference, percentChange };
  }, [currentYearStats, previousYearStats]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const current = payload.find((p) => p.dataKey === 'currentYear');
      const previous = payload.find((p) => p.dataKey === 'previousYear');
      
      return (
        <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
          <p className="font-medium text-sm mb-2">{label}</p>
          <div className="space-y-1">
            {current && (
              <p className="text-xs">
                <span className="inline-block w-24">Année en cours:</span>
                <span className="font-semibold text-indigo-600">{current.value}%</span>
              </p>
            )}
            {previous && (
              <p className="text-xs">
                <span className="inline-block w-24">Année précédente:</span>
                <span className="font-semibold text-gray-600">{previous.value}%</span>
              </p>
            )}
            {current && previous && (
              <p className="text-xs border-t pt-1">
                <span className="inline-block w-24">Différence:</span>
                <span className={`font-semibold ${current.value > previous.value ? 'text-red-600' : 'text-green-600'}`}>
                  {current.value > previous.value ? '+' : ''}{current.value - previous.value}%
                </span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Si pas de données de l'année précédente, afficher un message
  if (!previousYearStats || previousYearStats.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Comparaison avec l'année précédente
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>Aucune donnée de l'année précédente disponible</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Comparaison avec l'année précédente
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewType('weekly')}
              className={`px-3 py-1 text-sm rounded ${
                viewType === 'weekly' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewType('monthly')}
              className={`px-3 py-1 text-sm rounded ${
                viewType === 'monthly' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mois
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-50 p-4 rounded-lg">
          <p className="text-sm text-indigo-600 font-medium">Moyenne année en cours</p>
          <p className="text-2xl font-bold text-indigo-900">{globalStats.currentAvg}%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">Moyenne année précédente</p>
          <p className="text-2xl font-bold text-gray-900">{globalStats.previousAvg}%</p>
        </div>
        <div className={`p-4 rounded-lg ${globalStats.difference > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className={`text-sm font-medium ${globalStats.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
            Variation
          </p>
          <div className="flex items-center gap-2">
            {globalStats.difference > 0 ? (
              <TrendingUp className="h-6 w-6 text-red-600" />
            ) : (
              <TrendingDown className="h-6 w-6 text-green-600" />
            )}
            <p className={`text-2xl font-bold ${globalStats.difference > 0 ? 'text-red-900' : 'text-green-900'}`}>
              {globalStats.difference > 0 ? '+' : ''}{globalStats.percentChange}%
            </p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: 12 }}
            angle={viewType === 'weekly' ? -45 : 0}
            textAnchor={viewType === 'weekly' ? 'end' : 'middle'}
            height={viewType === 'weekly' ? 60 : 40}
          />
          <YAxis 
            label={{ value: 'Indisponibilité (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="currentYear" 
            stroke="#6366f1" 
            strokeWidth={2}
            name="Année en cours"
            dot={{ fill: '#6366f1', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="previousYear" 
            stroke="#9ca3af" 
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Année précédente"
            dot={{ fill: '#9ca3af', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YearComparisonChart;