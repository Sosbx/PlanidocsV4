import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
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
import { ShiftPeriod } from '../../shiftExchange/types';
import '../../../styles/BadgeStyles.css';

// Interface étendue pour ShiftAssignment avec les propriétés supplémentaires
interface ExtendedShiftAssignment extends BaseShiftAssignment {
  operationType?: OperationType | 'both';
  operationTypes?: OperationType[]; // Source unique de vérité pour les types d'opérations
}

// Utiliser ExtendedShiftAssignment au lieu de ShiftAssignment
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
  onAcceptProposal?: (proposal: ShiftExchange) => Promise<void>;
  onRejectProposal?: (proposal: ShiftExchange) => Promise<void>;
}

// Composant mémoïsé pour le badge de garde utilisateur
const UserShiftBadge = memo<{
  shiftData: { assignment: ShiftAssignment | null; proposals: ShiftExchange[] };
  date: Date;
  user: User | null;
  directExchanges: ShiftExchange[];
  onUserShiftClick: DirectExchangeTableProps['onUserShiftClick'];
}>(({ shiftData, date, user, directExchanges, onUserShiftClick }) => {
  if (!shiftData.assignment) return null;
  
  const assignment = shiftData.assignment;
  const hasProposals = shiftData.proposals.length > 0;
  
  // Standardiser la période de l'assignment
  const assignmentPeriod = standardizePeriod(assignment.period || assignment.type);
  
  // Trouver tous les documents d'échange où cette garde est proposée
  const userExchanges = directExchanges.filter(
    exchange => {
      const exchangePeriod = standardizePeriod(exchange.period);
      return exchange.userId === user?.id && 
             exchange.date === formatParisDate(date, 'yyyy-MM-dd') && 
             exchangePeriod === assignmentPeriod;
    }
  );
  
  // Vérifier si cette garde a des propositions en attente
  const hasIncomingProposals = userExchanges.some(exchange => exchange.hasProposals) || false;
  
  // Déterminer la période à utiliser
  const period = assignment.period || assignment.type;
  
  // Forcer l'utilisation des classes CSS correctes pour chaque période
  let periodClass = 'badge-evening';
  
  if (period === 'M') {
    periodClass = 'badge-morning';
  } else if (period === 'AM') {
    periodClass = 'badge-afternoon';
  } else if (period === 'S') {
    periodClass = 'badge-evening';
  }
  
  // Collecter tous les types d'opération
  let allOperationTypes: OperationType[] = [];
  
  if (assignment.operationTypes && Array.isArray(assignment.operationTypes)) {
    allOperationTypes = [...assignment.operationTypes];
  }
  
  userExchanges.forEach(exchange => {
    if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
      exchange.operationTypes.forEach(type => {
        if (!allOperationTypes.includes(type)) {
          allOperationTypes.push(type);
        }
      });
    } else if (exchange.operationType) {
      if (exchange.operationType === 'both') {
        if (!allOperationTypes.includes('exchange')) {
          allOperationTypes.push('exchange');
        }
        if (!allOperationTypes.includes('give')) {
          allOperationTypes.push('give');
        }
      } else if (!allOperationTypes.includes(exchange.operationType)) {
        allOperationTypes.push(exchange.operationType);
      }
    }
  });
  
  // Déterminer les types d'opération spécifiques
  const hasExchange = allOperationTypes.includes('exchange');
  const hasGive = allOperationTypes.includes('give');
  const hasReplacement = allOperationTypes.includes('replacement');
  
  // Déterminer le badge à afficher
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
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    onUserShiftClick(e, assignment, hasIncomingProposals);
  }, [onUserShiftClick, assignment, hasIncomingProposals]);
  
  return (
    <div 
      className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${hasProposals ? 'ring-1 ring-yellow-400' : ''} ${hasIncomingProposals ? 'ring-1 ring-red-500' : ''}`}
      onClick={handleClick}
    >
      <div className="text-xs font-medium">{assignment.shiftType}</div>
      
      {hasProposals && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white shadow-sm" 
          title="Vous avez reçu des propositions pour cette garde"
        />
      )}
      
      {hasIncomingProposals && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm animate-pulse" 
          title="Vous avez des propositions en attente de validation pour cette garde"
        />
      )}
      
      {badgeLabel && (
        <div 
          className={`absolute -top-1 -left-1 w-4 h-4 ${badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}
          title={
            badgeLabel === 'CER' ? 'Cession, Échange et Remplacement' :
            badgeLabel === 'CE' ? 'Cession et Échange' :
            badgeLabel === 'ER' ? 'Échange et Remplacement' :
            badgeLabel === 'CR' ? 'Cession et Remplacement' :
            badgeLabel === 'E' ? 'Échange' :
            badgeLabel === 'C' ? 'Cession' :
            badgeLabel === 'R' ? 'Remplacement' : ''
          }
        >
          <span className="text-[8px] font-bold">{badgeLabel}</span>
        </div>
      )}
    </div>
  );
});

UserShiftBadge.displayName = 'UserShiftBadge';

// Composant mémoïsé pour les badges de gardes proposées
const ProposedShiftBadges = memo<{
  exchanges: ShiftExchange[];
  date: Date;
  user: User | null;
  users: User[];
  userProposals: DirectExchangeProposal[];
  onProposedShiftClick: DirectExchangeTableProps['onProposedShiftClick'];
}>(({ exchanges, date, user, users, userProposals, onProposedShiftClick }) => {
  if (exchanges.length === 0) return null;
  
  // Filtrer les échanges
  const filteredExchanges = exchanges.filter(exchange => {
    if (!user) return false;
    
    const isReplacementOnly = exchange.operationTypes && 
                            exchange.operationTypes.length === 1 && 
                            exchange.operationTypes[0] === 'replacement';
    
    const isUserReplacement = user.roles?.isReplacement === true;
    
    return (
      exchange.userId !== user.id &&
      (!isReplacementOnly || (isReplacementOnly && isUserReplacement))
    );
  });
  
  if (filteredExchanges.length === 0) return null;
  
  // Regrouper les échanges
  const groupedExchanges: Record<string, ShiftExchange[]> = {};
  
  filteredExchanges.forEach(exchange => {
    const key = `${exchange.userId}-${exchange.date}-${exchange.period}`;
    if (!groupedExchanges[key]) {
      groupedExchanges[key] = [];
    }
    groupedExchanges[key].push(exchange);
  });
  
  return (
    <div className="flex flex-col gap-1">
      {Object.values(groupedExchanges).map((exchangeGroup, groupIndex) => {
        const exchange = exchangeGroup[0];
        const standardizedPeriod = standardizePeriod(exchange.period);
        const hasUserProposal = userProposals.some(p => p.targetExchangeId === exchange.id);
        
        let periodClass = 'badge-evening';
        
        if (standardizedPeriod === 'M') {
          periodClass = 'badge-morning';
        } else if (standardizedPeriod === 'AM') {
          periodClass = 'badge-afternoon';
        } else if (standardizedPeriod === 'S') {
          periodClass = 'badge-evening';
        }
        
        // Collecter tous les types d'opération
        const allOperationTypes: OperationType[] = [];
        
        exchangeGroup.forEach(ex => {
          if (ex.operationTypes && Array.isArray(ex.operationTypes)) {
            ex.operationTypes.forEach(type => {
              if (!allOperationTypes.includes(type)) {
                allOperationTypes.push(type);
              }
            });
          } else if (ex.operationType) {
            if (ex.operationType === 'both') {
              if (!allOperationTypes.includes('exchange')) {
                allOperationTypes.push('exchange');
              }
              if (!allOperationTypes.includes('give')) {
                allOperationTypes.push('give');
              }
            } else if (!allOperationTypes.includes(ex.operationType)) {
              allOperationTypes.push(ex.operationType);
            }
          }
        });
        
        // Déterminer le badge
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
        
        const proposingUser = users.find(u => u.id === exchange.userId);
        const userInitials = proposingUser ? 
          `${proposingUser.firstName?.charAt(0) || ''}${proposingUser.lastName?.charAt(0) || ''}` : 
          '??';
        
        const handleClick = useCallback((e: React.MouseEvent) => {
          onProposedShiftClick(e, exchange);
        }, [exchange]);
        
        return (
          <div 
            key={`${exchange.userId}-${exchange.date}-${exchange.period}-${groupIndex}`}
            className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${hasUserProposal ? 'ring-1 ring-blue-500' : ''}`}
            onClick={handleClick}
          >
            <div className="flex items-center justify-center">
              <div className="text-xs font-medium">{exchange.shiftType}</div>
            </div>
            
            {badgeLabel && (
              <div 
                className={`absolute -top-1 -right-1 w-4 h-4 ${badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}
                title={
                  badgeLabel === 'CER' ? 'Toutes les options' :
                  badgeLabel === 'CE' ? 'Échange et Cession' :
                  badgeLabel === 'ER' ? 'Échange et Remplacement' :
                  badgeLabel === 'CR' ? 'Cession et Remplacement' :
                  badgeLabel === 'E' ? 'Échange' :
                  badgeLabel === 'C' ? 'Cession' :
                  badgeLabel === 'R' ? 'Remplacement' : ''
                }
              >
                <span className="text-[8px] font-bold">{badgeLabel}</span>
              </div>
            )}
            
            {hasUserProposal && (
              <div 
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm"
                title="Vous avez déjà fait une proposition pour cette garde"
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

ProposedShiftBadges.displayName = 'ProposedShiftBadges';

/**
 * Tableau d'échanges directs optimisé avec React.memo
 */
const DirectExchangeTable: React.FC<DirectExchangeTableProps> = memo(({
  startDate,
  endDate,
  userAssignments,
  directExchanges,
  receivedProposals,
  userProposals,
  user,
  users,
  onUserShiftClick,
  onProposedShiftClick,
  onAcceptProposal,
  onRejectProposal
}) => {
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  
  // Générer les dates avec useMemo
  const dates = useMemo(() => {
    const dateArray: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dateArray;
  }, [startDate, endDate]);

  // Fonction mémorisée pour organiser les gardes de l'utilisateur
  const getUserAssignmentsByDateAndPeriod = useCallback((date: Date) => {
    const dateStr = formatParisDate(date, 'yyyy-MM-dd');
    const result: Record<string, {
      assignment: ShiftAssignment | null;
      proposals: ShiftExchange[];
    }> = {
      'M': { assignment: null, proposals: [] },
      'AM': { assignment: null, proposals: [] },
      'S': { assignment: null, proposals: [] }
    };
    
    ['M', 'AM', 'S'].forEach(period => {
      const key = `${dateStr}-${period}`;
      
      const userExchange = directExchanges.find(
        ex => ex.userId === user?.id && 
             ex.date === dateStr && 
             standardizePeriod(ex.period) === period
      );
      
      if (userAssignments && userAssignments[key]) {
        const assignment = { ...userAssignments[key] };
        
        if (userExchange) {
          assignment.operationTypes = userExchange.operationTypes || 
                                     (userExchange.operationType ? [userExchange.operationType] : []);
        }
        
        result[period].assignment = assignment;
      } else if (userExchange) {
        result[period].assignment = {
          date: userExchange.date,
          period: period as any,
          shiftType: userExchange.shiftType,
          timeSlot: userExchange.timeSlot,
          operationTypes: userExchange.operationTypes || []
        };
      }
      
      if (result[period].assignment) {
        const proposalsForThisShift = receivedProposals.filter(
          p => {
            const proposalPeriod = standardizePeriod(p.period);
            return p.date === dateStr && proposalPeriod === period;
          }
        );
        
        result[period].proposals = proposalsForThisShift;
      }
    });
    
    return result;
  }, [userAssignments, directExchanges, receivedProposals, user]);

  // Fonction mémorisée pour organiser les gardes proposées
  const getProposedExchangesByDateAndPeriod = useCallback((date: Date) => {
    const dateStr = formatParisDate(date, 'yyyy-MM-dd');
    const result: Record<string, ShiftExchange[]> = {
      'M': [],
      'AM': [],
      'S': []
    };
    
    if (directExchanges && directExchanges.length > 0) {
      directExchanges.forEach(exchange => {
        if (exchange.date === dateStr && 
            exchange.userId !== user?.id && 
            exchange.operationType !== 'replacement') {
          
          const standardizedPeriod = standardizePeriod(exchange.period);
          result[standardizedPeriod].push(exchange);
        }
      });
    }
    
    return result;
  }, [directExchanges, user]);

  return (
    <div className="overflow-x-auto">
      {/* Légende des badges */}
      <div className="mb-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
        <div 
          className="flex items-center font-medium text-gray-700 cursor-pointer hover:text-gray-900 transition-colors"
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          title={isLegendExpanded ? "Réduire la légende" : "Afficher la légende"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mr-1"
          >
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
            <div className="flex flex-col">
              <span className="font-medium text-gray-700 mb-1">Types d'opérations</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-100 text-yellow-700 rounded-full border border-white flex items-center justify-center mr-1">
                    <span className="text-[8px] font-bold">C</span>
                  </div>
                  <span>Cession</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 text-green-700 rounded-full border border-white flex items-center justify-center mr-1">
                    <span className="text-[8px] font-bold">E</span>
                  </div>
                  <span>Échange</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-amber-100 text-amber-700 rounded-full border border-white flex items-center justify-center mr-1">
                    <span className="text-[8px] font-bold">R</span>
                  </div>
                  <span>Remplacement</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
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
            const userShifts = getUserAssignmentsByDateAndPeriod(date);
            const proposedShifts = getProposedExchangesByDateAndPeriod(date);
            
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
                
                <td className="border px-1 py-1 text-center">
                  <UserShiftBadge 
                    shiftData={userShifts['M']} 
                    date={date}
                    user={user}
                    directExchanges={directExchanges}
                    onUserShiftClick={onUserShiftClick}
                  />
                </td>
                <td className="border px-1 py-1 text-center">
                  <UserShiftBadge 
                    shiftData={userShifts['AM']} 
                    date={date}
                    user={user}
                    directExchanges={directExchanges}
                    onUserShiftClick={onUserShiftClick}
                  />
                </td>
                <td className="border px-1 py-1 text-center">
                  <UserShiftBadge 
                    shiftData={userShifts['S']} 
                    date={date}
                    user={user}
                    directExchanges={directExchanges}
                    onUserShiftClick={onUserShiftClick}
                  />
                </td>
                
                <td className="border px-1 py-1 text-center">
                  <ProposedShiftBadges 
                    exchanges={proposedShifts['M']} 
                    date={date}
                    user={user}
                    users={users}
                    userProposals={userProposals}
                    onProposedShiftClick={onProposedShiftClick}
                  />
                </td>
                <td className="border px-1 py-1 text-center">
                  <ProposedShiftBadges 
                    exchanges={proposedShifts['AM']} 
                    date={date}
                    user={user}
                    users={users}
                    userProposals={userProposals}
                    onProposedShiftClick={onProposedShiftClick}
                  />
                </td>
                <td className="border px-1 py-1 text-center">
                  <ProposedShiftBadges 
                    exchanges={proposedShifts['S']} 
                    date={date}
                    user={user}
                    users={users}
                    userProposals={userProposals}
                    onProposedShiftClick={onProposedShiftClick}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}, (prevProps, nextProps) => {
  // Fonction de comparaison personnalisée pour React.memo
  // Retourne true si les props sont égales (pas de re-render), false sinon
  
  // Comparaison des dates
  if (prevProps.startDate.getTime() !== nextProps.startDate.getTime() ||
      prevProps.endDate.getTime() !== nextProps.endDate.getTime()) {
    return false;
  }
  
  // Comparaison de l'utilisateur
  if (prevProps.user?.id !== nextProps.user?.id) {
    return false;
  }
  
  // Comparaison des longueurs des tableaux (optimisation rapide)
  if (prevProps.directExchanges.length !== nextProps.directExchanges.length ||
      prevProps.receivedProposals.length !== nextProps.receivedProposals.length ||
      prevProps.userProposals.length !== nextProps.userProposals.length ||
      prevProps.users.length !== nextProps.users.length) {
    return false;
  }
  
  // Comparaison des clés de userAssignments
  const prevKeys = Object.keys(prevProps.userAssignments).sort();
  const nextKeys = Object.keys(nextProps.userAssignments).sort();
  if (prevKeys.length !== nextKeys.length || 
      !prevKeys.every((key, i) => key === nextKeys[i])) {
    return false;
  }
  
  // Si toutes les comparaisons passent, les props sont égales
  return true;
});

DirectExchangeTable.displayName = 'DirectExchangeTable';

export default DirectExchangeTable;