import React, { useState, useEffect, useRef } from 'react';
import { format, isWeekend, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
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

/**
 * Tableau d'échanges directs
 * Affiche les gardes de l'utilisateur et les gardes proposées par les autres médecins
 * dans un tableau avec des colonnes pour les jours, les gardes de l'utilisateur (M, AM, S)
 * et les gardes proposées (M, AM, S)
 */
const DirectExchangeTable: React.FC<DirectExchangeTableProps> = ({
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
  // Générer les dates entre startDate et endDate
  const [dates, setDates] = useState<Date[]>([]);
  // État pour forcer le rafraîchissement du composant
  const [refreshKey, setRefreshKey] = useState<number>(0);
  
  // Référence pour suivre les valeurs précédentes des props
  const prevPropsRef = useRef<{
    directExchanges: ShiftExchange[];
    receivedProposals: ShiftExchange[];
    userProposals: DirectExchangeProposal[];
  }>({
    directExchanges: [],
    receivedProposals: [],
    userProposals: []
  });

  // Générer les dates à afficher
  useEffect(() => {
    const dateArray: Date[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setDates(dateArray);
  }, [startDate, endDate]);

  // Effet pour mettre à jour les données précédentes et détecter les changements
  useEffect(() => {
    // Vérifier si les données ont changé
    const hasExchangesChanged = directExchanges.length !== prevPropsRef.current.directExchanges.length;
    const hasProposalsChanged = userProposals.length !== prevPropsRef.current.userProposals.length;
    const hasReceivedProposalsChanged = receivedProposals.length !== prevPropsRef.current.receivedProposals.length;
    
    // Si les données ont changé, forcer le rafraîchissement
    if (hasExchangesChanged || hasProposalsChanged || hasReceivedProposalsChanged) {
      // Incrémenter refreshKey pour forcer le re-rendu du composant
      setRefreshKey(prevKey => prevKey + 1);
      
      console.log('Données mises à jour, rafraîchissement forcé:', {
        directExchanges: directExchanges.length,
        userProposals: userProposals.length,
        receivedProposals: receivedProposals.length,
        refreshKey: refreshKey + 1
      });
    }
    
    // Mettre à jour les données précédentes
    prevPropsRef.current = {
      directExchanges,
      receivedProposals,
      userProposals
    };
  }, [directExchanges, userProposals, receivedProposals]);
  
  // Organiser les gardes de l'utilisateur par date et période
  const getUserAssignmentsByDateAndPeriod = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const result: Record<string, {
      assignment: ShiftAssignment | null;
      proposals: ShiftExchange[];
    }> = {
      'M': { assignment: null, proposals: [] },
      'AM': { assignment: null, proposals: [] },
      'S': { assignment: null, proposals: [] }
    };
    
    // Vérifier les gardes pour chaque période
    ['M', 'AM', 'S'].forEach(period => {
      const key = `${dateStr}-${period}`;
      
      // Récupérer les échanges directs pour cette date et période 
      const userExchange = directExchanges.find(
        ex => ex.userId === user?.id && 
             ex.date === dateStr && 
             standardizePeriod(ex.period) === period
      );
      
      // Vérifier d'abord dans userAssignments (garde principale)
      if (userAssignments && userAssignments[key]) {
        // Créer une copie de l'assignment pour pouvoir le modifier
        const assignment = { ...userAssignments[key] };
        
        // Si un échange existe pour cette garde, ajouter ses operationTypes
        if (userExchange) {
          assignment.operationTypes = userExchange.operationTypes || 
                                     (userExchange.operationType ? [userExchange.operationType] : []);
        }
        
        result[period].assignment = assignment;
      } 
      // Si la garde n'est pas dans userAssignments mais existe dans un échange
      else if (userExchange) {
        // Créer un assignment temporaire à partir de l'échange
        result[period].assignment = {
          date: userExchange.date,
          period: period as any,
          shiftType: userExchange.shiftType,
          timeSlot: userExchange.timeSlot,
          operationTypes: userExchange.operationTypes || []
        };
      }
      
      // Ajouter les propositions reçues pour cette garde
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
  };

  // Organiser les gardes proposées par date et période
  const getProposedExchangesByDateAndPeriod = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const result: Record<string, ShiftExchange[]> = {
      'M': [],
      'AM': [],
      'S': []
    };
    
    // Filtrer les échanges pour cette date et les organiser par période
    if (directExchanges && directExchanges.length > 0) {
      directExchanges.forEach(exchange => {
        // Ne pas afficher les gardes proposées uniquement aux remplaçants
        if (exchange.date === dateStr && 
            exchange.userId !== user?.id && 
            exchange.operationType !== 'replacement') {
          
          // Standardiser la période pour s'assurer qu'elle est reconnue correctement
          const standardizedPeriod = standardizePeriod(exchange.period);
          
          // Ajouter l'échange à la liste correspondante
          result[standardizedPeriod].push(exchange);
        }
      });
    }
    
    return result;
  };

  // Rendu d'un badge pour une garde de l'utilisateur
  const renderUserShiftBadge = (shiftData: { 
    assignment: ShiftAssignment | null; 
    proposals: ShiftExchange[] 
  }, date: Date) => {
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
               exchange.date === format(date, 'yyyy-MM-dd') && 
               exchangePeriod === assignmentPeriod;
      }
    );
    
    // Vérifier si cette garde a des propositions en attente (sur n'importe quel type d'échange)
    const hasIncomingProposals = userExchanges.some(exchange => exchange.hasProposals) || false;
    
    // Déterminer la période à utiliser (utiliser type si period n'est pas défini)
    const period = assignment.period || assignment.type;
    
    // Forcer l'utilisation des classes CSS correctes pour chaque période
    let periodClass = 'badge-evening'; // Valeur par défaut
    
    if (period === 'M') {
      periodClass = 'badge-morning';
    } else if (period === 'AM') {
      periodClass = 'badge-afternoon';
    } else if (period === 'S') {
      periodClass = 'badge-evening';
    }
    
    // Collecter tous les types d'opération de tous les échanges liés à cette garde
    let allOperationTypes: OperationType[] = [];
    
    // Ajouter les types d'opération de l'assignment si disponibles
    if (assignment.operationTypes && Array.isArray(assignment.operationTypes)) {
      allOperationTypes = [...assignment.operationTypes];
    }
    
    // Ajouter les types d'opération des échanges
    userExchanges.forEach(exchange => {
      // Utiliser operationTypes s'il existe
      if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
        exchange.operationTypes.forEach(type => {
          if (!allOperationTypes.includes(type)) {
            allOperationTypes.push(type);
          }
        });
      } 
      // Sinon, dériver de operationType
      else if (exchange.operationType) {
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
    
    // Déterminer le badge à afficher selon les types d'opération
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
    
    // Badge pour les gardes de l'utilisateur
    return (
      <div 
        className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${hasProposals ? 'ring-1 ring-yellow-400' : ''} ${hasIncomingProposals ? 'ring-1 ring-red-500' : ''}`}
        onClick={(e) => onUserShiftClick(e, assignment, hasIncomingProposals)}
      >
        <div className="text-xs font-medium">{assignment.shiftType}</div>
        
        {/* Badge pour les propositions reçues */}
        {hasProposals && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white shadow-sm"></div>
        )}
        
        {/* Badge pour les propositions entrantes */}
        {hasIncomingProposals && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm animate-pulse"></div>
        )}
        
        {/* Badge pour les types d'opération */}
        {badgeLabel && (
          <div className={`absolute -top-1 -left-1 w-4 h-4 ${badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}>
            <span className="text-[8px] font-bold">{badgeLabel}</span>
          </div>
        )}
      </div>
    );
  };

  // Rendu des badges pour les gardes proposées
  const renderProposedShiftBadges = (exchanges: ShiftExchange[], date: Date) => {
    if (exchanges.length === 0) return null;
    
    // Regrouper les échanges par utilisateur, date et période pour éviter les doublons
    const groupedExchanges: Record<string, ShiftExchange[]> = {};
    
    exchanges.forEach(exchange => {
      const key = `${exchange.userId}-${exchange.date}-${exchange.period}`;
      if (!groupedExchanges[key]) {
        groupedExchanges[key] = [];
      }
      groupedExchanges[key].push(exchange);
    });
    
    return (
      <div className="flex flex-col gap-1">
        {Object.values(groupedExchanges).map((exchangeGroup, groupIndex) => {
          // Prendre le premier échange du groupe comme référence
          const exchange = exchangeGroup[0];
          
          // Standardiser la période de l'échange
          const standardizedPeriod = standardizePeriod(exchange.period);
          
          // Vérifier si l'utilisateur a déjà fait une proposition pour cet échange
          const hasUserProposal = userProposals.some(p => p.targetExchangeId === exchange.id);
          
          // Forcer l'utilisation des classes CSS correctes pour chaque période
          let periodClass = 'badge-evening'; // Valeur par défaut
          
          if (standardizedPeriod === 'M') {
            periodClass = 'badge-morning';
          } else if (standardizedPeriod === 'AM') {
            periodClass = 'badge-afternoon';
          } else if (standardizedPeriod === 'S') {
            periodClass = 'badge-evening';
          }
          
          // Collecter tous les types d'opération de tous les échanges du groupe
          let allOperationTypes: OperationType[] = [];
          
          exchangeGroup.forEach(ex => {
            // Utiliser operationTypes s'il existe
            if (ex.operationTypes && Array.isArray(ex.operationTypes)) {
              ex.operationTypes.forEach(type => {
                if (!allOperationTypes.includes(type)) {
                  allOperationTypes.push(type);
                }
              });
            } 
            // Sinon, dériver de operationType
            else if (ex.operationType) {
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
          
          // Déterminer les types d'opération spécifiques
          const hasExchange = allOperationTypes.includes('exchange');
          const hasGive = allOperationTypes.includes('give');
          const hasReplacement = allOperationTypes.includes('replacement');
          
          // Déterminer le badge à afficher selon les types d'opération
          let badgeLabel = '';
          let badgeClass = '';
          
          // Déterminer les badges à afficher selon toutes les combinaisons possibles
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
          
          // Trouver l'utilisateur qui propose l'échange
          const proposingUser = users.find(u => u.id === exchange.userId);
          const userInitials = proposingUser ? 
            `${proposingUser.firstName?.charAt(0) || ''}${proposingUser.lastName?.charAt(0) || ''}` : 
            '??';
          
          return (
            <div 
              key={`${exchange.userId}-${exchange.date}-${exchange.period}-${groupIndex}`}
              className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-md transition-all duration-200 relative ${hasUserProposal ? 'ring-1 ring-blue-500' : ''}`}
              onClick={(e) => onProposedShiftClick(e, exchange)}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">{exchange.shiftType}</div>
                <div className="text-[10px] text-gray-500 bg-gray-100 rounded-full w-4 h-4 flex items-center justify-center" title={`${proposingUser?.firstName || ''} ${proposingUser?.lastName || ''}`}>
                  {userInitials}
                </div>
              </div>
              
              {/* Badge pour le type d'opération */}
              {badgeLabel && (
                <div className={`absolute -top-1 -right-1 w-4 h-4 ${badgeClass} rounded-full border border-white shadow-sm flex items-center justify-center`}>
                  <span className="text-[8px] font-bold">{badgeLabel}</span>
                </div>
              )}
              
              {/* Badge pour indiquer que l'utilisateur a déjà fait une proposition */}
              {hasUserProposal && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm"></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* Légende des badges */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
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
        <div className="flex items-center ml-4">
          <div className="w-3 h-3 bg-red-500 rounded-full border border-white mr-1"></div>
          <span>Propositions reçues</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full border border-white mr-1"></div>
          <span>Proposition envoyée</span>
        </div>
      </div>
      
      {/* Utiliser refreshKey comme clé pour forcer le re-rendu complet de la table */}
      <table key={refreshKey} className="min-w-full border-collapse shadow-sm">
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
            {/* Sous-en-têtes pour Mes Gardes */}
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-morning">M</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-afternoon">AM</th>
            <th className="border px-2 py-1 text-center text-xs font-medium text-gray-500 w-16 header-evening">S</th>
            {/* Sous-en-têtes pour Gardes Proposées */}
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
                {/* Colonne Jour - Version améliorée */}
                <td className={`border px-2 py-1.5 ${isWeekendOrHoliday ? 'text-red-600' : ''} ${isCurrentDay ? 'font-medium' : ''}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">
                      {format(date, 'EEE', { locale: fr }).charAt(0).toUpperCase() + format(date, 'EEE', { locale: fr }).slice(1)}
                    </span>
                    <span className={`text-[10px] ${isCurrentDay ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {format(date, 'd MMM', { locale: fr })}
                    </span>
                  </div>
                </td>
                
                {/* Colonnes Mes Gardes */}
                <td className="border px-1 py-1 text-center">
                  {renderUserShiftBadge(userShifts['M'], date)}
                </td>
                <td className="border px-1 py-1 text-center">
                  {renderUserShiftBadge(userShifts['AM'], date)}
                </td>
                <td className="border px-1 py-1 text-center">
                  {renderUserShiftBadge(userShifts['S'], date)}
                </td>
                
                {/* Colonnes Gardes Proposées */}
                <td className="border px-1 py-1 text-center">
                  {renderProposedShiftBadges(proposedShifts['M'], date)}
                </td>
                <td className="border px-1 py-1 text-center">
                  {renderProposedShiftBadges(proposedShifts['AM'], date)}
                </td>
                <td className="border px-1 py-1 text-center">
                  {renderProposedShiftBadges(proposedShifts['S'], date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DirectExchangeTable;
