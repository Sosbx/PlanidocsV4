import React, { useState, useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format, getDaysInMonth, isWeekend } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { getMonthsInRange, isGrayedOut } from '../../../../utils/dateUtils';
import { isHoliday, isBridgeDay } from '../../../../utils/holidayUtils';
import { getColorForPercentage, getColorForAvailability } from '../../utils/statsCalculations';
import type { DesiderataStats } from '../../types';

type DesiderataFilter = 'all' | 'primary' | 'secondary';

interface CalendarHeatmapProps {
  stats: DesiderataStats[];
  onDayClick?: (day: DesiderataStats) => void;
  showAvailability?: boolean;
}

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ stats, onDayClick, showAvailability = false }) => {
  const [filter, setFilter] = useState<DesiderataFilter>('all');

  // Créer une map pour accès rapide aux stats par date
  const statsMap = useMemo(() => {
    return stats.reduce((acc: Record<string, DesiderataStats>, day) => {
      acc[day.date] = day;
      return acc;
    }, {});
  }, [stats]);

  if (stats.length === 0) return null;

  // Obtenir la plage de dates
  const startDate = new Date(stats[0].date);
  const endDate = new Date(stats[stats.length - 1].date);
  const months = getMonthsInRange(startDate, endDate);

  // Générer tous les jours uniques (1-31)
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1);
  
  // Fonction pour obtenir l'abréviation du jour
  const getDayAbbr = (date: Date): string => {
    const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
    return days[date.getDay()];
  };

  // Créer le header des périodes pour chaque mois
  const periods = ['M', 'AM', 'S'];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-medium ${showAvailability ? 'text-green-700' : 'text-red-700'}`}>
          {showAvailability ? 'Matrice des disponibilités' : 'Matrice des indispo'}
        </h3>
        
        {!showAvailability && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm font-medium rounded-l-md border ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('primary')}
              className={`px-3 py-1 text-sm font-medium border-t border-b ${
                filter === 'primary'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Primaires
            </button>
            <button
              onClick={() => setFilter('secondary')}
              className={`px-3 py-1 text-sm font-medium rounded-r-md border ${
                filter === 'secondary'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Secondaires
            </button>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            {/* Ligne des mois */}
            <tr>
              <th className="sticky left-0 z-20 bg-white border border-gray-200 px-2 py-1"></th>
              {months.map((month, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <th className="bg-white border border-gray-200"></th>
                  )}
                <th
                  key={index}
                  className="text-xs font-medium text-gray-900 border border-gray-200 px-1 py-1"
                  colSpan={3}
                >
                  {formatParisDate(month, 'MMMM yyyy', { locale: frLocale })}
                </th>
                </React.Fragment>
              ))}
            </tr>
            {/* Ligne des périodes */}
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 border border-gray-200 px-0.5 py-0.5 text-[9px] font-medium text-gray-600 w-12 text-center">
                J
              </th>
              {months.map((month, monthIndex) => (
                <React.Fragment key={monthIndex}>
                  {monthIndex > 0 && (
                    <th className="bg-gray-50 border border-gray-200 px-0.5 py-0.5 text-[9px] font-medium text-gray-600 w-12 text-center">
                      J
                    </th>
                  )}
                  {periods.map(period => (
                    <th key={`${monthIndex}-${period}`} className="text-[10px] font-normal text-gray-600 bg-gray-50 border border-gray-200 px-1 py-0.5">
                      {period}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDays.map(dayNum => {
              // Vérifier si ce jour est grisé (weekend ou férié) pour n'importe quel mois
              const isAnyDayGrayed = months.some(month => {
                const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
                return dayNum <= getDaysInMonth(month) && isGrayedOut(date);
              });
              
              // Vérifier si c'est un weekend pour le mettre en évidence
              const isAnyDayWeekend = months.some(month => {
                const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
                return dayNum <= getDaysInMonth(month) && isWeekend(date);
              });
              
              // Vérifier si c'est un jour de pont pour n'importe quel mois
              const isAnyDayBridge = months.some(month => {
                const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
                return dayNum <= getDaysInMonth(month) && isBridgeDay(date);
              });

              return (
                <tr key={dayNum} className={isAnyDayBridge ? 'bg-red-50' : isAnyDayWeekend ? 'bg-blue-50' : isAnyDayGrayed ? 'bg-gray-50' : ''}>
                  <td className="sticky left-0 z-10 bg-white border border-gray-200 px-0.5 py-0.5 text-[9px] w-12 text-center">
                    {(() => {
                      // Prendre le premier mois valide pour déterminer le jour de la semaine
                      const validMonth = months.find(month => dayNum <= getDaysInMonth(month));
                      if (validMonth) {
                        const date = new Date(validMonth.getFullYear(), validMonth.getMonth(), dayNum);
                        const dayAbbr = getDayAbbr(date);
                        const weekend = isWeekend(date);
                        const holiday = isHoliday(date);
                        const bridge = isBridgeDay(date);
                        
                        return (
                          <span className={`${
                            weekend || holiday || bridge ? 'font-bold' : 'font-normal'
                          } ${
                            holiday || bridge ? 'text-red-600' : weekend ? 'text-blue-600' : 'text-gray-700'
                          }`}>
                            <div className="flex flex-col items-center leading-none">
                              <span>{dayNum}</span>
                              <span className="text-[7px]">{dayAbbr}</span>
                            </div>
                          </span>
                        );
                      }
                      return <span className="font-normal text-gray-700">{dayNum}</span>;
                    })()}
                  </td>
                  {months.map((month, monthIndex) => {
                    const daysInMonth = getDaysInMonth(month);
                    
                    return (
                      <React.Fragment key={monthIndex}>
                        {monthIndex > 0 && (
                          <td className="border border-gray-200 bg-gray-50 px-0.5 py-0.5 text-[9px] w-12 text-center">
                            {dayNum <= daysInMonth ? (() => {
                              const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
                              const dayAbbr = getDayAbbr(date);
                              const weekend = isWeekend(date);
                              const holiday = isHoliday(date);
                              const bridge = isBridgeDay(date);
                              
                              return (
                                <span className={`${
                                  weekend || holiday || bridge ? 'font-bold' : 'font-normal'
                                } ${
                                  holiday || bridge ? 'text-red-600' : weekend ? 'text-blue-600' : 'text-gray-600'
                                }`}>
                                  <div className="flex flex-col items-center leading-none">
                                    <span>{dayNum}</span>
                                    <span className="text-[7px]">{dayAbbr}</span>
                                  </div>
                                </span>
                              );
                            })() : ''}
                          </td>
                        )}
                        
                        {dayNum > daysInMonth ? (
                          <>
                            <td className="border border-gray-200 bg-gray-100"></td>
                            <td className="border border-gray-200 bg-gray-100"></td>
                            <td className="border border-gray-200 bg-gray-100"></td>
                          </>
                        ) : (() => {
                          const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
                          const dateStr = formatParisDate(date, 'yyyy-MM-dd');
                          const dayStats = statsMap[dateStr];
                          const isGrayed = isGrayedOut(date);

                          if (!dayStats) {
                            return periods.map(period => (
                              <td key={`${monthIndex}-${period}`} className={`border border-gray-200 ${isGrayed ? 'bg-gray-100' : ''}`}></td>
                            ));
                          }

                          return periods.map(period => {
                            const periodStats = dayStats.periods[period as 'M' | 'AM' | 'S'];
                            
                            // Calculer les valeurs selon le filtre
                            let displayValue = 0;
                            let displayCount = 0;
                            
                            if (showAvailability) {
                              // Mode disponibilité : inverser les pourcentages
                              displayValue = 100 - periodStats.percentage;
                              displayCount = periodStats.total - periodStats.unavailable;
                            } else {
                              // Mode indisponibilité avec filtres
                              switch (filter) {
                                case 'primary':
                                  displayCount = periodStats.primary;
                                  displayValue = periodStats.total > 0 ? Math.round((periodStats.primary / periodStats.total) * 100) : 0;
                                  break;
                                case 'secondary':
                                  displayCount = periodStats.secondary;
                                  displayValue = periodStats.total > 0 ? Math.round((periodStats.secondary / periodStats.total) * 100) : 0;
                                  break;
                                default:
                                  displayCount = periodStats.unavailable;
                                  displayValue = periodStats.percentage;
                              }
                            }
                            
                            const colorClass = showAvailability 
                              ? getColorForAvailability(displayValue)
                              : getColorForPercentage(displayValue);
                            
                            return (
                              <td key={`${monthIndex}-${period}`} className="border border-gray-200 p-0.5">
                                <div
                                  onClick={() => onDayClick?.(dayStats)}
                                  className={`h-8 flex flex-col items-center justify-center rounded cursor-pointer hover:ring-1 hover:ring-indigo-500 transition-all relative group ${colorClass}`}
                                >
                                  <span className="text-xs font-bold leading-none">
                                    {displayValue}%
                                  </span>
                                  <span className="text-[9px] leading-none opacity-75">
                                    {displayCount}/{periodStats.total}
                                  </span>
                                  
                                  {/* Tooltip au survol */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                      {formatParisDate(date, 'EEEE d MMMM', { locale: frLocale })} - {period === 'M' ? 'Matin' : period === 'AM' ? 'Après-midi' : 'Soir'}
                                      <br />
                                      {showAvailability ? (
                                        <>
                                          {displayValue}% disponibles ({displayCount}/{periodStats.total})
                                        </>
                                      ) : (
                                        <>
                                          Total: {periodStats.percentage}% ({periodStats.unavailable}/{periodStats.total})
                                          <br />
                                          Primaires: {periodStats.primary} • Secondaires: {periodStats.secondary}
                                        </>
                                      )}
                                      {dayStats.isWeekend && ' • Weekend'}
                                      {dayStats.isHoliday && ' • Jour férié'}
                                    </div>
                                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 absolute left-1/2 transform -translate-x-1/2 top-full"></div>
                                  </div>
                                </div>
                              </td>
                            );
                          });
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Légende */}
      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-center gap-4 text-xs">
          <span className="text-gray-600 font-medium">Légende:</span>
          {showAvailability ? (
            // Légende pour disponibilités (inversée)
            <>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-red-200 border border-red-300 rounded"></div>
                <span className="text-gray-600">&lt; 20%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-red-100 border border-red-200 rounded"></div>
                <span className="text-gray-600">20-40%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-orange-100 border border-orange-200 rounded"></div>
                <span className="text-gray-600">40-60%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span className="text-gray-600">60-80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-green-100 border border-green-200 rounded"></div>
                <span className="text-gray-600">80-100%</span>
              </div>
            </>
          ) : (
            // Légende pour indisponibilités
            <>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
                <span className="text-gray-600">0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-green-100 border border-green-200 rounded"></div>
                <span className="text-gray-600">&lt; 20%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span className="text-gray-600">20-40%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-orange-100 border border-orange-200 rounded"></div>
                <span className="text-gray-600">40-60%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-red-100 border border-red-200 rounded"></div>
                <span className="text-gray-600">60-80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-red-200 border border-red-300 rounded"></div>
                <span className="text-gray-600">&gt; 80%</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarHeatmap;