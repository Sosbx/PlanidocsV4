import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import type { DoctorStats } from '../../types';

interface DistributionPieChartProps {
  doctorStats: DoctorStats[];
  type: 'period' | 'type' | 'weekend';
}

const COLORS = {
  period: ['#f59e0b', '#0ea5e9', '#8b5cf6'],
  type: ['#ef4444', '#3b82f6'],
  weekend: ['#10b981', '#f59e0b', '#ef4444']
};

const DistributionPieChart: React.FC<DistributionPieChartProps> = ({ 
  doctorStats, 
  type 
}) => {
  // Calculer les données selon le type
  const getData = () => {
    if (type === 'period') {
      const totals = doctorStats.reduce((acc, doctor) => {
        // Estimation basée sur la répartition moyenne
        const total = doctor.totalDesiderata;
        return {
          matin: acc.matin + Math.round(total * 0.33),
          aprèsMidi: acc.aprèsMidi + Math.round(total * 0.33),
          soir: acc.soir + Math.round(total * 0.34)
        };
      }, { matin: 0, aprèsMidi: 0, soir: 0 });

      return [
        { name: 'Matin', value: totals.matin },
        { name: 'Après-midi', value: totals.aprèsMidi },
        { name: 'Soir', value: totals.soir }
      ];
    }

    if (type === 'type') {
      const totals = doctorStats.reduce((acc, doctor) => ({
        primary: acc.primary + doctor.primaryCount,
        secondary: acc.secondary + doctor.secondaryCount
      }), { primary: 0, secondary: 0 });

      return [
        { name: 'Primaires', value: totals.primary },
        { name: 'Secondaires', value: totals.secondary }
      ];
    }

    if (type === 'weekend') {
      const totals = doctorStats.reduce((acc, doctor) => {
        const weekdays = doctor.totalDesiderata - doctor.weekendCount - doctor.holidayCount;
        return {
          weekdays: acc.weekdays + weekdays,
          weekends: acc.weekends + doctor.weekendCount,
          holidays: acc.holidays + doctor.holidayCount
        };
      }, { weekdays: 0, weekends: 0, holidays: 0 });

      return [
        { name: 'Semaine', value: totals.weekdays },
        { name: 'Weekend', value: totals.weekends },
        { name: 'Jours fériés', value: totals.holidays }
      ];
    }

    return [];
  };

  const data = getData();
  const colors = COLORS[type];
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  interface LabelProps {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: LabelProps) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-sm font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getTitle = () => {
    switch (type) {
      case 'period':
        return 'Répartition par période';
      case 'type':
        return 'Types de desiderata';
      case 'weekend':
        return 'Répartition semaine/weekend';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{getTitle()}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [
              `${value} (${((value / total) * 100).toFixed(1)}%)`,
              'Total'
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionPieChart;