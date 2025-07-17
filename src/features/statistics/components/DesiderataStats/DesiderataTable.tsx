import React from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { Calendar, Sun, Briefcase, Link } from 'lucide-react';
import { getColorForPercentage } from '../../utils/statsCalculations';
import type { DesiderataStats } from '../../types';

interface DesiderataTableProps {
  stats: DesiderataStats[];
  loading?: boolean;
}

const DesiderataTable: React.FC<DesiderataTableProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-2"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded mb-1"></div>
        ))}
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucune donnée disponible pour la période sélectionnée
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Matin
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Après-midi
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Soir
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Global
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {stats.map((day) => (
            <tr key={day.date} className={day.isWeekend || day.isHoliday ? 'bg-gray-50' : ''}>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatParisDate(new Date(day.date), 'dd MMMM', { locale: frLocale })}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {day.dayOfWeek}
                      {day.isWeekend && <Sun className="h-3 w-3 text-yellow-500" />}
                      {day.isHoliday && <Calendar className="h-3 w-3 text-red-500" />}
                      {day.isBridgeDay && <Link className="h-3 w-3 text-orange-500" />}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getColorForPercentage(day.periods.M.percentage)
                }`}>
                  {day.periods.M.percentage}%
                  <span className="ml-1 text-xs opacity-75">
                    ({day.periods.M.unavailable}/{day.periods.M.total})
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getColorForPercentage(day.periods.AM.percentage)
                }`}>
                  {day.periods.AM.percentage}%
                  <span className="ml-1 text-xs opacity-75">
                    ({day.periods.AM.unavailable}/{day.periods.AM.total})
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getColorForPercentage(day.periods.S.percentage)
                }`}>
                  {day.periods.S.percentage}%
                  <span className="ml-1 text-xs opacity-75">
                    ({day.periods.S.unavailable}/{day.periods.S.total})
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  getColorForPercentage(day.overallPercentage)
                }`}>
                  {day.overallPercentage}%
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DesiderataTable;