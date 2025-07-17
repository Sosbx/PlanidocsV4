import React from 'react';
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
import type { DesiderataStats } from '../../types';

interface TrendsLineChartProps {
  stats: DesiderataStats[];
}

const TrendsLineChart: React.FC<TrendsLineChartProps> = ({ stats }) => {
  interface WeekData {
    week: string;
    matin: number;
    aprèsMidi: number;
    soir: number;
    global: number;
    count: number;
  }

  // Grouper par semaine pour avoir une vue plus claire des tendances
  const weeklyData = stats.reduce((acc: WeekData[], day, index) => {
    const weekIndex = Math.floor(index / 7);
    if (!acc[weekIndex]) {
      acc[weekIndex] = {
        week: `Sem ${weekIndex + 1}`,
        matin: 0,
        aprèsMidi: 0,
        soir: 0,
        global: 0,
        count: 0
      };
    }
    
    acc[weekIndex].matin += day.periods.M.percentage;
    acc[weekIndex].aprèsMidi += day.periods.AM.percentage;
    acc[weekIndex].soir += day.periods.S.percentage;
    acc[weekIndex].global += day.overallPercentage;
    acc[weekIndex].count += 1;
    
    return acc;
  }, []);

  // Calculer les moyennes hebdomadaires
  const chartData = weeklyData.map(week => ({
    week: week.week,
    matin: Math.round(week.matin / week.count),
    aprèsMidi: Math.round(week.aprèsMidi / week.count),
    soir: Math.round(week.soir / week.count),
    global: Math.round(week.global / week.count)
  }));

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Tendances hebdomadaires des indisponibilités
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis label={{ value: 'Pourcentage (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="matin" 
            stroke="#f59e0b" 
            name="Matin"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="aprèsMidi" 
            stroke="#0ea5e9" 
            name="Après-midi"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="soir" 
            stroke="#8b5cf6" 
            name="Soir"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="global" 
            stroke="#6366f1" 
            name="Global"
            strokeWidth={3}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendsLineChart;