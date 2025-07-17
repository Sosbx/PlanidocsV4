import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { DesiderataStats } from '../../types';

interface DesiderataBarChartProps {
  stats: DesiderataStats[];
  showPeriods?: boolean;
}

const DesiderataBarChart: React.FC<DesiderataBarChartProps> = ({ 
  stats, 
  showPeriods = true 
}) => {
  // Préparer les données pour le graphique
  const chartData = stats.map(day => ({
    date: new Date(day.date).toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit' 
    }),
    matin: day.periods.M.percentage,
    aprèsMidi: day.periods.AM.percentage,
    soir: day.periods.S.percentage,
    global: day.overallPercentage,
    isWeekend: day.isWeekend,
    isHoliday: day.isHoliday
  }));

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ 
      payload: {
        isWeekend: boolean;
        isHoliday: boolean;
        date: string;
        matin: number;
        aprèsMidi: number;
        soir: number;
        global: number;
      }; 
      color: string; 
      name: string; 
      value: number 
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
          <p className="font-medium text-sm">{label}</p>
          {data.isWeekend && <p className="text-xs text-yellow-600">Weekend</p>}
          {data.isHoliday && <p className="text-xs text-red-600">Jour férié</p>}
          <div className="mt-2 space-y-1">
            {payload.map((entry, index) => (
              <p key={index} className="text-xs" style={{ color: entry.color }}>
                {entry.name}: {entry.value}%
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Distribution des indisponibilités par jour
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Pourcentage (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {showPeriods ? (
            <>
              <Bar dataKey="matin" fill="#f59e0b" name="Matin" />
              <Bar dataKey="aprèsMidi" fill="#0ea5e9" name="Après-midi" />
              <Bar dataKey="soir" fill="#8b5cf6" name="Soir" />
            </>
          ) : (
            <Bar dataKey="global" fill="#6366f1" name="Global" />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DesiderataBarChart;