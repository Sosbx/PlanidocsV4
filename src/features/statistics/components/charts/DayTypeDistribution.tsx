import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Calendar, Clock, Sun } from 'lucide-react';
import type { DesiderataStats } from '../../types';

interface DayTypeDistributionProps {
  stats: DesiderataStats[];
}

const COLORS = {
  weekday: '#6366f1',
  weekend: '#f59e0b',
  holiday: '#ef4444',
  morning: '#3b82f6',
  afternoon: '#10b981',
  evening: '#8b5cf6'
};

const DayTypeDistribution: React.FC<DayTypeDistributionProps> = ({ stats }) => {
  // Calculer les distributions
  const distributions = useMemo(() => {
    let weekdayCount = 0;
    let weekendCount = 0;
    let holidayCount = 0;
    let morningTotal = 0;
    let afternoonTotal = 0;
    let eveningTotal = 0;
    let totalDesiderata = 0;

    stats.forEach(day => {
      const dayTotal = day.periods.M.unavailable + day.periods.AM.unavailable + day.periods.S.unavailable;
      
      if (day.isHoliday) {
        holidayCount += dayTotal;
      } else if (day.isWeekend) {
        weekendCount += dayTotal;
      } else {
        weekdayCount += dayTotal;
      }

      morningTotal += day.periods.M.unavailable;
      afternoonTotal += day.periods.AM.unavailable;
      eveningTotal += day.periods.S.unavailable;
      totalDesiderata += dayTotal;
    });

    return {
      dayType: [
        { name: 'Jours ouvrés', value: weekdayCount, percentage: Math.round((weekdayCount / totalDesiderata) * 100) },
        { name: 'Weekends', value: weekendCount, percentage: Math.round((weekendCount / totalDesiderata) * 100) },
        { name: 'Jours fériés', value: holidayCount, percentage: Math.round((holidayCount / totalDesiderata) * 100) }
      ],
      period: [
        { name: 'Matin', value: morningTotal, percentage: Math.round((morningTotal / totalDesiderata) * 100) },
        { name: 'Après-midi', value: afternoonTotal, percentage: Math.round((afternoonTotal / totalDesiderata) * 100) },
        { name: 'Soir', value: eveningTotal, percentage: Math.round((eveningTotal / totalDesiderata) * 100) }
      ],
      totalDesiderata
    };
  }, [stats]);

  const renderCustomLabel = (entry: { percentage: number }) => {
    return `${entry.percentage}%`;
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percentage: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-xs mt-1">
            <span className="text-gray-600">Nombre:</span> 
            <span className="font-semibold ml-1">{data.value}</span>
          </p>
          <p className="text-xs">
            <span className="text-gray-600">Pourcentage:</span> 
            <span className="font-semibold ml-1">{data.payload.percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-6">
        Distribution des desiderata
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribution par type de jour */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-700">Par type de jour</h4>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={distributions.dayType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributions.dayType.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? COLORS.weekday : index === 1 ? COLORS.weekend : COLORS.holiday} 
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution par période */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-700">Par période de la journée</h4>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={distributions.period}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributions.period.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? COLORS.morning : index === 1 ? COLORS.afternoon : COLORS.evening} 
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <Sun className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Weekends</p>
            <p className="text-xl font-semibold text-gray-900">
              {distributions.dayType.find(d => d.name === 'Weekends')?.percentage || 0}%
            </p>
          </div>
          <div>
            <Calendar className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Jours fériés</p>
            <p className="text-xl font-semibold text-gray-900">
              {distributions.dayType.find(d => d.name === 'Jours fériés')?.percentage || 0}%
            </p>
          </div>
          <div>
            <Clock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Soirs</p>
            <p className="text-xl font-semibold text-gray-900">
              {distributions.period.find(d => d.name === 'Soir')?.percentage || 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayTypeDistribution;