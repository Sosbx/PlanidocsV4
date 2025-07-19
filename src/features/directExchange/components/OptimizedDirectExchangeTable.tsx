import React, { memo, useMemo } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format, isToday } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { isGrayedOut } from '../../../utils/dateUtils';
import { standardizePeriod } from '../../../utils/periodUtils';
import type { ShiftExchange } from '../../../types/exchange';
import type { OperationType } from '../types';
import type { DirectExchangeProposal } from '../../../lib/firebase/directExchange/types';
import type { ShiftAssignment as BaseShiftAssignment } from '../../../types/planning';
import type { User } from '../../../features/users/types';
import '../../../styles/BadgeStyles.css';

// Interface étendue pour ShiftAssignment avec les propriétés supplémentaires
interface ExtendedShiftAssignment extends BaseShiftAssignment {
  operationType?: OperationType | 'both';
  operationTypes?: OperationType[];
}

type ShiftAssignment = ExtendedShiftAssignment;

interface DirectExchangeTableProps {
  startDate: Date;
  endDate: Date;
  userAssignments: Record<string, ShiftAssignment>;
  directExchanges: ShiftExchange[];
  receivedProposals: ShiftExchange[];
  userProposals: DirectExchangeProposal[];
  user: User | null;
  users: User[];
  onUserShiftClick: (event: React.MouseEvent, assignment: ShiftAssignment, hasIncomingProposals?: boolean, hasUserProposal?: boolean) => void;
  onProposedShiftClick: (event: React.MouseEvent, exchange: ShiftExchange) => void;
}

// Composant pour une cellule de garde utilisateur - mémorisé
const UserShiftCell = memo<{
  date: Date;
  period: string;
  userAssignments: Record<string, ShiftAssignment>;
  directExchanges: ShiftExchange[];
  receivedProposals: ShiftExchange[];
  user: User | null;
  onUserShiftClick: DirectExchangeTableProps['onUserShiftClick'];
}>(({ date, period, userAssignments, directExchanges, receivedProposals, user, onUserShiftClick }) => {
  const dateStr = formatParisDate(date, 'yyyy-MM-dd');
  const key = `${dateStr}-${period}`;
  
  // Récupérer les données de la garde
  const shiftData = useMemo(() => {
    const userExchange = directExchanges.find(
      ex => ex.userId === user?.id && 
           ex.date === dateStr && 
           standardizePeriod(ex.period) === period
    );
    
    let assignment = userAssignments[key] ? { ...userAssignments[key] } : null;
    
    if (assignment && userExchange) {
      assignment.operationTypes = userExchange.operationTypes || 
                                 (userExchange.operationType ? [userExchange.operationType] : []);
    } else if (!assignment && userExchange) {
      assignment = {
        date: userExchange.date,
        period: period as any,
        shiftType: userExchange.shiftType,
        timeSlot: userExchange.timeSlot,
        operationTypes: userExchange.operationTypes || []
      };
    }
    
    const proposals = assignment ? receivedProposals.filter(
      p => p.date === dateStr && standardizePeriod(p.period) === period
    ) : [];
    
    return { assignment, proposals };
  }, [dateStr, period, userAssignments, directExchanges, receivedProposals, user]);
  
  if (!shiftData.assignment) return null;
  
  // Déterminer les badges et styles
  const badgeInfo = useMemo(() => {
    const userExchanges = directExchanges.filter(
      exchange => exchange.userId === user?.id && 
                 exchange.date === dateStr && 
                 standardizePeriod(exchange.period) === standardizePeriod(shiftData.assignment!.period || shiftData.assignment!.type)
    );
    
    const hasIncomingProposals = userExchanges.some(exchange => exchange.hasProposals);
    
    let allOperationTypes: OperationType[] = [];
    if (shiftData.assignment?.operationTypes) {
      allOperationTypes = [...shiftData.assignment.operationTypes];
    }
    
    userExchanges.forEach(exchange => {
      if (exchange.operationTypes) {
        exchange.operationTypes.forEach((type: OperationType) => {
          if (!allOperationTypes.includes(type)) {
            allOperationTypes.push(type);
          }
        });
      } else if (exchange.operationType) {
        if (exchange.operationType === 'both') {
          if (!allOperationTypes.includes('exchange')) allOperationTypes.push('exchange');
          if (!allOperationTypes.includes('give')) allOperationTypes.push('give');
        } else if (!allOperationTypes.includes(exchange.operationType)) {
          allOperationTypes.push(exchange.operationType);
        }
      }
    });
    
    const hasExchange = allOperationTypes.includes('exchange');
    const hasGive = allOperationTypes.includes('give');
    const hasReplacement = allOperationTypes.includes('replacement');
    
    let badgeLabel = '';
    let badgeClass = '';
    
    if (hasExchange && hasGive && hasReplacement) {
      badgeLabel = 'CER';
      badgeClass = 'bg-amber-100 text-amber-700';
    } else if (hasExchange && hasGive) {
      badgeLabel = 'CE';
      badgeClass = 'bg-orange-100 text-orange-700';
    } else if (hasExchange && hasReplacement) {
      badgeLabel = 'ER';
      badgeClass = 'bg-lime-100 text-lime-700';
    } else if (hasGive && hasReplacement) {
      badgeLabel = 'CR';
      badgeClass = 'bg-amber-100 text-amber-700';
    } else if (hasExchange) {
      badgeLabel = 'E';
      badgeClass = 'bg-green-100 text-green-700';
    } else if (hasGive) {
      badgeLabel = 'C';
      badgeClass = 'bg-yellow-100 text-yellow-700';
    } else if (hasReplacement) {
      badgeLabel = 'R';
      badgeClass = 'bg-amber-100 text-amber-700';
    }
    
    return { hasIncomingProposals, badgeLabel, badgeClass };
  }, [shiftData.assignment, directExchanges, user, dateStr]);
  
  const periodClass = period === 'M' ? 'badge-morning' : 
                     period === 'AM' ? 'badge-afternoon' : 
                     'badge-evening';
  
  return (
    <div 
      className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${shiftData.proposals.length > 0 ? 'ring-1 ring-yellow-400' : ''} ${badgeInfo.hasIncomingProposals ? 'ring-1 ring-red-500' : ''}`}
      onClick={(e) => onUserShiftClick(e, shiftData.assignment!, badgeInfo.hasIncomingProposals)}
    >
      <div className="text-xs font-medium">{shiftData.assignment.shiftType}</div>
      
      {shiftData.proposals.length > 0 && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white shadow-sm" />
      )}
      
      {badgeInfo.hasIncomingProposals && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm animate-pulse" />
      )}
      
      {badgeInfo.badgeLabel && (
        <div className={`absolute -top-1 -left-1 w-4 h-4 ${badgeInfo.badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}>
          <span className="text-[8px] font-bold">{badgeInfo.badgeLabel}</span>
        </div>
      )}
    </div>
  );
});

UserShiftCell.displayName = 'UserShiftCell';

// Composant pour une cellule de garde proposée - mémorisé
const ProposedShiftCell = memo<{
  date: Date;
  period: string;
  directExchanges: ShiftExchange[];
  userProposals: DirectExchangeProposal[];
  user: User | null;
  users: User[];
  onProposedShiftClick: DirectExchangeTableProps['onProposedShiftClick'];
}>(({ date, period, directExchanges, userProposals, user, users, onProposedShiftClick }) => {
  const dateStr = formatParisDate(date, 'yyyy-MM-dd');
  
  const exchanges = useMemo(() => {
    const filtered = directExchanges.filter(exchange => {
      if (!user) return false;
      
      const isReplacementOnly = exchange.operationTypes?.length === 1 && 
                              exchange.operationTypes[0] === 'replacement';
      const isUserReplacement = user.roles?.isReplacement === true;
      
      return exchange.date === dateStr && 
             exchange.userId !== user.id && 
             standardizePeriod(exchange.period) === period &&
             exchange.operationType !== 'replacement' &&
             (!isReplacementOnly || (isReplacementOnly && isUserReplacement));
    });
    
    // Grouper par utilisateur
    const grouped: Record<string, ShiftExchange[]> = {};
    filtered.forEach(exchange => {
      const key = `${exchange.userId}-${exchange.date}-${exchange.period}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(exchange);
    });
    
    return Object.values(grouped);
  }, [directExchanges, user, dateStr, period]);
  
  if (exchanges.length === 0) return null;
  
  return (
    <div className="flex flex-col gap-1">
      {exchanges.map((exchangeGroup, groupIndex) => {
        const exchange = exchangeGroup[0];
        const hasUserProposal = userProposals.some(p => p.targetExchangeId === exchange.id);
        
        const badgeInfo = useMemo(() => {
          const allOperationTypes: OperationType[] = [];
          
          exchangeGroup.forEach(ex => {
            if (ex.operationTypes) {
              ex.operationTypes.forEach((type: OperationType) => {
                if (!allOperationTypes.includes(type)) {
                  allOperationTypes.push(type);
                }
              });
            } else if (ex.operationType) {
              if (ex.operationType === 'both') {
                if (!allOperationTypes.includes('exchange')) allOperationTypes.push('exchange');
                if (!allOperationTypes.includes('give')) allOperationTypes.push('give');
              } else if (!allOperationTypes.includes(ex.operationType)) {
                allOperationTypes.push(ex.operationType);
              }
            }
          });
          
          const hasExchange = allOperationTypes.includes('exchange');
          const hasGive = allOperationTypes.includes('give');
          const hasReplacement = allOperationTypes.includes('replacement');
          
          let badgeLabel = '';
          let badgeClass = '';
          
          if (hasExchange && hasGive && hasReplacement) {
            badgeLabel = 'CER';
            badgeClass = 'bg-amber-100 text-amber-700';
          } else if (hasExchange && hasGive) {
            badgeLabel = 'CE';
            badgeClass = 'bg-orange-100 text-orange-700';
          } else if (hasExchange && hasReplacement) {
            badgeLabel = 'ER';
            badgeClass = 'bg-lime-100 text-lime-700';
          } else if (hasGive && hasReplacement) {
            badgeLabel = 'CR';
            badgeClass = 'bg-amber-100 text-amber-700';
          } else if (hasExchange) {
            badgeLabel = 'E';
            badgeClass = 'bg-green-100 text-green-700';
          } else if (hasGive) {
            badgeLabel = 'C';
            badgeClass = 'bg-yellow-100 text-yellow-700';
          } else if (hasReplacement) {
            badgeLabel = 'R';
            badgeClass = 'bg-amber-100 text-amber-700';
          }
          
          return { badgeLabel, badgeClass };
        }, [exchangeGroup]);
        
        const standardizedPeriod = standardizePeriod(exchange.period);
        const periodClass = standardizedPeriod === 'M' ? 'badge-morning' : 
                           standardizedPeriod === 'AM' ? 'badge-afternoon' : 
                           'badge-evening';
        
        return (
          <div 
            key={`${exchange.userId}-${exchange.date}-${exchange.period}-${groupIndex}`}
            className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${hasUserProposal ? 'ring-1 ring-blue-500' : ''}`}
            onClick={(e) => onProposedShiftClick(e, exchange)}
          >
            <div className="flex items-center justify-center">
              <div className="text-xs font-medium">{exchange.shiftType}</div>
            </div>
            
            {badgeInfo.badgeLabel && (
              <div className={`absolute -top-1 -right-1 w-4 h-4 ${badgeInfo.badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}>
                <span className="text-[8px] font-bold">{badgeInfo.badgeLabel}</span>
              </div>
            )}
            
            {hasUserProposal && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm" />
            )}
          </div>
        );
      })}
    </div>
  );
});

ProposedShiftCell.displayName = 'ProposedShiftCell';

// Composant principal optimisé
const OptimizedDirectExchangeTable: React.FC<DirectExchangeTableProps> = memo(({
  startDate,
  endDate,
  userAssignments,
  directExchanges,
  receivedProposals,
  userProposals,
  user,
  users,
  onUserShiftClick,
  onProposedShiftClick
}) => {
  // Générer les dates
  const dates = useMemo(() => {
    const dateArray: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dateArray;
  }, [startDate, endDate]);
  
  const [isLegendExpanded, setIsLegendExpanded] = React.useState(true);
  
  return (
    <div className="overflow-x-auto">
      {/* Légende */}
      <div className="mb-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
        <div 
          className="flex items-center font-medium text-gray-700 cursor-pointer hover:text-gray-900 transition-colors"
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
        >
          <svg className="mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isLegendExpanded ? (
              <polyline points="6 9 12 15 18 9"></polyline>
            ) : (
              <polyline points="9 18 15 12 9 6"></polyline>
            )}
          </svg>
          Légende
        </div>
        
        {isLegendExpanded && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
            {/* Contenu de la légende */}
          </div>
        )}
      </div>
      
      {/* Table */}
      <table className="min-w-full border-collapse shadow-sm">
        <thead>
          <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <th className="border px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Jour
            </th>
            <th className="border px-2 py-1.5 text-center text-xs font-medium text-gray-600 uppercase tracking-wider" colSpan={3}>
              Mes Gardes
            </th>
            <th className="border px-2 py-1.5 text-center text-xs font-medium text-gray-600 uppercase tracking-wider" colSpan={3}>
              Gardes Proposées
            </th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left text-xs font-medium text-gray-500"></th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-morning">M</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-afternoon">AM</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-evening">S</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-morning">M</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-afternoon">AM</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-evening">S</th>
          </tr>
        </thead>
        <tbody>
          {dates.map(date => {
            const isWeekendOrHoliday = isGrayedOut(date);
            const isCurrentDay = isToday(date);
            
            return (
              <tr 
                key={date.toISOString()} 
                className={`
                  ${isWeekendOrHoliday ? 'bg-red-50/30' : ''}
                  ${isCurrentDay ? 'bg-blue-50/30' : ''}
                  hover:bg-gray-50/50 transition-colors
                `}
              >
                <td className={`border px-2 py-1.5 ${isWeekendOrHoliday ? 'text-red-600' : ''} ${isCurrentDay ? 'font-medium' : ''}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">
                      {formatParisDate(date, 'EEE', { locale: frLocale }).charAt(0).toUpperCase() + formatParisDate(date, 'EEE', { locale: frLocale }).slice(1)}
                    </span>
                    <span className={`text-[10px] ${isCurrentDay ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {formatParisDate(date, 'd MMM', { locale: frLocale })}
                    </span>
                  </div>
                </td>
                
                {['M', 'AM', 'S'].map(period => (
                  <td key={`user-${period}`} className="border px-1 py-1 text-center">
                    <UserShiftCell
                      date={date}
                      period={period}
                      userAssignments={userAssignments}
                      directExchanges={directExchanges}
                      receivedProposals={receivedProposals}
                      user={user}
                      onUserShiftClick={onUserShiftClick}
                    />
                  </td>
                ))}
                
                {['M', 'AM', 'S'].map(period => (
                  <td key={`proposed-${period}`} className="border px-1 py-1 text-center">
                    <ProposedShiftCell
                      date={date}
                      period={period}
                      directExchanges={directExchanges}
                      userProposals={userProposals}
                      user={user}
                      users={users}
                      onProposedShiftClick={onProposedShiftClick}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

OptimizedDirectExchangeTable.displayName = 'OptimizedDirectExchangeTable';

export default OptimizedDirectExchangeTable;