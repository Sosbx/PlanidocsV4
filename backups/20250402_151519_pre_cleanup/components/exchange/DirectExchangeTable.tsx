import React, { useState, useEffect, useRef } from 'react';
import { format, isWeekend, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isGrayedOut } from '../../utils/dateUtils';
import { ShiftExchange, OperationType, ShiftPeriod } from '../../types/exchange';
import { DirectExchangeProposal } from '../../lib/firebase/directExchange/types';
import { ShiftAssignment as BaseShiftAssignment } from '../../types/planning';
import { standardizePeriod } from '../../utils/periodUtils';

// Interface étendue pour ShiftAssignment avec les propriétés supplémentaires
interface ExtendedShiftAssignment extends BaseShiftAssignment {
  operationType?: OperationType | 'both';
  existingOperationTypes?: OperationType[];
}

// Utiliser ExtendedShiftAssignment au lieu de ShiftAssignment
type ShiftAssignment = ExtendedShiftAssignment;
import { User } from '../../types/users';
import '../../styles/BadgeStyles.css';

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
  // État pour suivre les propositions en cours de traitement
  const [processingProposals, setProcessingProposals] = useState<Record<string, boolean>>({});
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

  // Données de test pour le débogage
  const [testUserAssignments, setTestUserAssignments] = useState<Record<string, ShiftAssignment>>({});
  const [testDirectExchanges, setTestDirectExchanges] = useState<ShiftExchange[]>([]);
  
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
        refreshKey: refreshKey + 1,
        hasExchangesChanged,
        hasProposalsChanged,
        hasReceivedProposalsChanged
      });
    }
    
    // Mettre à jour les données précédentes
    prevPropsRef.current = {
      directExchanges,
      receivedProposals,
      userProposals
    };
  }, [directExchanges, userProposals, receivedProposals]);

  // Initialiser les données de test
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Créer des données de test pour les gardes de l'utilisateur
    const userAssignmentsData = {
      [`${format(today, 'yyyy-MM-dd')}-M`]: {
        date: format(today, 'yyyy-MM-dd'),
        period: 'M' as const,
        shiftType: 'Urgences',
        timeSlot: '8h-12h',
        type: 'M' as const
      } as ShiftAssignment,
      [`${format(tomorrow, 'yyyy-MM-dd')}-AM`]: {
        date: format(tomorrow, 'yyyy-MM-dd'),
        period: 'AM' as const,
        shiftType: 'Consultation',
        timeSlot: '14h-18h',
        type: 'AM' as const
      } as ShiftAssignment
    };
    
    // Créer des données de test pour les gardes proposées
    const directExchangesData = [
      {
        id: '1',
        userId: 'other-user-1',
        date: format(today, 'yyyy-MM-dd'),
        period: ShiftPeriod.EVENING,
        shiftType: 'Urgences',
        timeSlot: '20h-00h',
        comment: 'Échange proposé',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'pending' as const,
        operationType: 'exchange' as OperationType,
        interestedUsers: [],
        exchangeType: 'direct' as const
      },
      {
        id: '2',
        userId: 'other-user-2',
        date: format(tomorrow, 'yyyy-MM-dd'),
        period: ShiftPeriod.MORNING,
        shiftType: 'Consultation',
        timeSlot: '8h-12h',
        comment: 'Échange proposé',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'pending' as const,
        operationType: 'give' as OperationType,
        interestedUsers: [],
        exchangeType: 'direct' as const
      }
    ] as ShiftExchange[];
    
    setTestUserAssignments(userAssignmentsData);
    setTestDirectExchanges(directExchangesData);
    
    console.log('Données de test initialisées:', {
      userAssignmentsData,
      directExchangesData
    });
  }, []);
  
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
    
    // Utiliser les données réelles si disponibles, sinon utiliser les données de test
    const assignments = Object.keys(userAssignments).length > 0 ? userAssignments : testUserAssignments;
    
    // Vérifier les gardes pour chaque période
    ['M', 'AM', 'S'].forEach(period => {
      const key = `${dateStr}-${period}`;
      if (assignments && assignments[key]) {
        result[period].assignment = assignments[key];
        
        // Ajouter les propositions reçues pour cette garde
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
    
    // Utiliser les données réelles si disponibles, sinon utiliser les données de test
    const exchanges = directExchanges.length > 0 ? directExchanges : testDirectExchanges;
    
    // Filtrer les échanges pour cette date et les organiser par période
    if (exchanges && exchanges.length > 0) {
      exchanges.forEach(exchange => {
        // Ne pas afficher les gardes proposées uniquement aux remplaçants
        if (exchange.date === dateStr && 
            exchange.userId !== user?.id && 
            exchange.operationType !== 'replacement') {
          
          // Standardiser la période pour s'assurer qu'elle est reconnue correctement
          const standardizedPeriod = standardizePeriod(exchange.period);
          
          // Ajouter l'échange à la liste correspondante
          result[standardizedPeriod].push(exchange);
          
          // Journaliser pour le débogage
          console.log(`Échange ${exchange.id} avec période ${exchange.period} standardisée en ${standardizedPeriod}`);
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
    
    console.log('Rendu badge utilisateur:', {
      date: format(date, 'yyyy-MM-dd'),
      period: period,
      assignment: assignment,
      userExchanges: userExchanges
    });
    
    // Forcer l'utilisation des classes CSS correctes pour chaque période
    let periodClass = 'badge-evening'; // Valeur par défaut
    
    if (period === 'M') {
      periodClass = 'badge-morning';
    } else if (period === 'AM') {
      periodClass = 'badge-afternoon';
    } else if (period === 'S') {
      periodClass = 'badge-evening';
    }
    
    // Déterminer les types d'opération pour cette garde (collecter tous les types)
    const operationTypes: OperationType[] = userExchanges.map(exchange => exchange.operationType);
    
    // Afficher les types d'opération détectés pour le débogage
    console.log(`Garde ${assignment.date}-${assignment.period}: Types d'opération:`, {
      operationTypes,
      assignmentOperationType: assignment.operationType,
      existingOperationTypes: assignment.existingOperationTypes,
      userExchanges: userExchanges.length
    });
    
    // Déterminer le badge à afficher selon les types d'opération
    let badgeLabel = '';
    let badgeClass = '';
    
    // Vérifier si le type est 'both' dans l'opération principale ou dans userExchanges
    const hasBoth = assignment.operationType === 'both' || operationTypes.includes('both');
    
    // Vérifier si des types d'opération sont dans existingOperationTypes
    const hasExistingOperationTypes = assignment.existingOperationTypes && 
                                     Array.isArray(assignment.existingOperationTypes) && 
                                     assignment.existingOperationTypes.length > 0;
    
    const hasExchangeExisting = hasExistingOperationTypes && 
                                assignment.existingOperationTypes?.includes('exchange');
    
    const hasGiveExisting = hasExistingOperationTypes && 
                            assignment.existingOperationTypes?.includes('give');
    
    const hasReplacementExisting = hasExistingOperationTypes && 
                                  assignment.existingOperationTypes?.includes('replacement');
    
    // Vérifier si les types sont directement dans operationTypes OU via both/existingOperationTypes
    const hasExchange = operationTypes.includes('exchange') || hasExchangeExisting || hasBoth;
    const hasGive = operationTypes.includes('give') || hasGiveExisting || hasBoth;
    const hasReplacement = operationTypes.includes('replacement') || hasReplacementExisting;
    
    // Vérifier également les userExchanges directement (au cas où operationTypes ne capture pas tout)
    const userExchangeHasExchange = userExchanges.some(ex => 
      ex.operationType === 'exchange' || ex.operationType === 'both' || 
      (ex.existingOperationTypes && ex.existingOperationTypes.includes('exchange'))
    );
    const userExchangeHasGive = userExchanges.some(ex => 
      ex.operationType === 'give' || ex.operationType === 'both' || 
      (ex.existingOperationTypes && ex.existingOperationTypes.includes('give'))
    );
    const userExchangeHasReplacement = userExchanges.some(ex => 
      ex.operationType === 'replacement' || 
      (ex.existingOperationTypes && ex.existingOperationTypes.includes('replacement'))
    );
    
    // Combiner tous les indicateurs
    const finalHasExchange = hasExchange || userExchangeHasExchange;
    const finalHasGive = hasGive || userExchangeHasGive;
    const finalHasReplacement = hasReplacement || userExchangeHasReplacement;
    
    if (finalHasExchange && finalHasGive && finalHasReplacement) {
      badgeLabel = 'CER';
      badgeClass = 'bg-amber-100 text-amber-700';
    } else if (finalHasExchange && finalHasGive) {
      badgeLabel = 'CE';
      badgeClass = 'bg-orange-100 text-orange-700';
    } else if (finalHasExchange && finalHasReplacement) {
      badgeLabel = 'ER';
      badgeClass = 'bg-lime-100 text-lime-700';
    } else if (finalHasGive && finalHasReplacement) {
      badgeLabel = 'CR';
      badgeClass = 'bg-amber-100 text-amber-700';
    } else if (finalHasExchange) {
      badgeLabel = 'E';
      badgeClass = 'bg-green-100 text-green-700';
    } else if (finalHasGive) {
      badgeLabel = 'C';
      badgeClass = 'bg-yellow-100 text-yellow-700';
    } else if (finalHasReplacement) {
      badgeLabel = 'R';
      badgeClass = 'bg-amber-100 text-amber-700';
    }
    
    // Badge minimaliste pour les gardes de l'utilisateur
    return (
      <div 
        className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-sm transition-shadow relative ${hasProposals ? 'ring-1 ring-yellow-400' : ''} ${hasIncomingProposals ? 'ring-1 ring-red-500' : ''}`}
        onClick={(e) => onUserShiftClick(e, assignment, hasIncomingProposals)}
      >
        <div className="text-xs font-medium">{assignment.shiftType}</div>
        
        {/* Badge pour les propositions reçues */}
        {hasProposals && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></div>
        )}
        
        {/* Badge pour les propositions entrantes */}
        {hasIncomingProposals && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
        )}
        
        {/* Badge pour les types d'opération */}
        {badgeLabel && (
          <div className={`absolute -top-1 -left-1 w-4 h-4 ${badgeClass} rounded-full border border-white flex items-center justify-center`}>
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
      <div className="flex flex-col gap-0.5">
        {Object.values(groupedExchanges).map((exchangeGroup, groupIndex) => {
          // Prendre le premier échange du groupe comme référence
          const exchange = exchangeGroup[0];
          
          // Standardiser la période de l'échange
          const standardizedPeriod = standardizePeriod(exchange.period);
          
          // Vérifier si l'utilisateur a déjà fait une proposition pour cet échange
          const hasUserProposal = userProposals.some(p => p.targetExchangeId === exchange.id);
          
          console.log('Rendu badge proposé (groupe):', {
            date: exchange.date,
            originalPeriod: exchange.period,
            standardizedPeriod: standardizedPeriod,
            exchange: exchange,
            groupSize: exchangeGroup.length,
            operationTypes: exchangeGroup.map(ex => ex.operationType),
            hasUserProposal
          });
          
          // Forcer l'utilisation des classes CSS correctes pour chaque période
          let periodClass = 'badge-evening'; // Valeur par défaut
          
          if (standardizedPeriod === 'M') {
            periodClass = 'badge-morning';
          } else if (standardizedPeriod === 'AM') {
            periodClass = 'badge-afternoon';
          } else if (standardizedPeriod === 'S') {
            periodClass = 'badge-evening';
          }
          
          // Déterminer les types d'opération disponibles pour ce groupe
          console.log(`Groupe de gardes proposées (${exchangeGroup.length}):`, 
            exchangeGroup.map(ex => ({ 
              id: ex.id, 
              type: ex.operationType, 
              existing: ex.existingOperationTypes 
            }))
          );
          
          // Vérifier si un échange a le type 'both' ou vérifier les types individuels
          const hasBoth = exchangeGroup.some(ex => ex.operationType === 'both');
          const hasExchange = hasBoth || exchangeGroup.some(ex => ex.operationType === 'exchange');
          const hasGive = hasBoth || exchangeGroup.some(ex => ex.operationType === 'give');
          const hasReplacement = exchangeGroup.some(ex => ex.operationType === 'replacement');
          
          // Vérifier également les existingOperationTypes pour prendre en compte notre nouvelle approche
          const hasExchangeInExisting = exchangeGroup.some(ex => 
            ex.existingOperationTypes && ex.existingOperationTypes.includes('exchange')
          );
          const hasGiveInExisting = exchangeGroup.some(ex => 
            ex.existingOperationTypes && ex.existingOperationTypes.includes('give')
          );
          const hasReplacementInExisting = exchangeGroup.some(ex => 
            ex.existingOperationTypes && ex.existingOperationTypes.includes('replacement')
          );
          
          // Combiner les indicateurs
          const finalHasExchange = hasExchange || hasExchangeInExisting;
          const finalHasGive = hasGive || hasGiveInExisting;
          const finalHasReplacement = hasReplacement || hasReplacementInExisting;
          
          // Déterminer le badge à afficher selon les types d'opération
          let badgeLabel = '';
          let badgeClass = '';
          
          // Déterminer les badges à afficher selon toutes les combinaisons possibles
          if (finalHasExchange && finalHasGive && finalHasReplacement) {
            badgeLabel = 'CER';
            badgeClass = 'bg-amber-100 text-amber-700';
          } else if (finalHasExchange && finalHasGive) {
            badgeLabel = 'CE';
            badgeClass = 'bg-orange-100 text-orange-700';
          } else if (finalHasExchange && finalHasReplacement) {
            badgeLabel = 'ER';
            badgeClass = 'bg-lime-100 text-lime-700';
          } else if (finalHasGive && finalHasReplacement) {
            badgeLabel = 'CR';
            badgeClass = 'bg-amber-100 text-amber-700';
          } else if (finalHasExchange) {
            badgeLabel = 'E';
            badgeClass = 'bg-green-100 text-green-700';
          } else if (finalHasGive) {
            badgeLabel = 'C';
            badgeClass = 'bg-yellow-100 text-yellow-700';
          } else if (finalHasReplacement) {
            badgeLabel = 'R';
            badgeClass = 'bg-amber-100 text-amber-700';
          }
          
          return (
            <div 
              key={`${exchange.userId}-${exchange.date}-${exchange.period}-${groupIndex}`}
              className={`px-1.5 py-1 ${periodClass} rounded cursor-pointer hover:shadow-sm transition-shadow relative ${hasUserProposal ? 'ring-1 ring-blue-500' : ''}`}
              onClick={(e) => onProposedShiftClick(e, exchange)}
            >
              <div className="text-xs font-medium">{exchange.shiftType}</div>
              
              {/* Badge pour le type d'opération */}
              {badgeLabel && (
                <div className={`absolute -top-1 -right-1 w-4 h-4 ${badgeClass} rounded-full border border-white flex items-center justify-center`}>
                  <span className="text-[8px] font-bold">{badgeLabel}</span>
                </div>
              )}
              
              {/* Badge pour indiquer que l'utilisateur a déjà fait une proposition */}
              {hasUserProposal && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white"></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* Message de débogage */}
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-2 mb-4 rounded">
        <p className="text-sm font-medium">Mode débogage activé</p>
        <p className="text-xs">
          Données de test chargées : {Object.keys(testUserAssignments).length} gardes utilisateur, {testDirectExchanges.length} gardes proposées
        </p>
        <p className="text-xs">
          Données réelles : {Object.keys(userAssignments).length} gardes utilisateur, {directExchanges.length} gardes proposées, {userProposals.length} propositions utilisateur
        </p>
        <p className="text-xs">
          Clé de rafraîchissement : {refreshKey} (change à chaque mise à jour des données)
        </p>
      </div>
      
      {/* Utiliser refreshKey comme clé pour forcer le re-rendu complet de la table */}
      <table key={refreshKey} className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-1.5 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Jour
            </th>
            <th className="border px-1.5 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" colSpan={3}>
              Mes Gardes
            </th>
            <th className="border px-1.5 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" colSpan={3}>
              Gardes Proposées
            </th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border px-1.5 py-0.5 text-left text-xs font-medium text-gray-500"></th>
            {/* Sous-en-têtes pour Mes Gardes */}
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">M</th>
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">AM</th>
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">S</th>
            {/* Sous-en-têtes pour Gardes Proposées */}
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">M</th>
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">AM</th>
            <th className="border px-1.5 py-0.5 text-center text-xs font-medium text-gray-500 w-14">S</th>
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
                {/* Colonne Jour - Version compacte */}
                <td className={`border px-1.5 py-1 ${isWeekendOrHoliday ? 'text-red-600' : ''}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">
                      {format(date, 'EEE', { locale: fr }).charAt(0).toUpperCase() + format(date, 'EEE', { locale: fr }).slice(1)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {format(date, 'd MMM', { locale: fr })}
                    </span>
                  </div>
                </td>
                
                {/* Colonnes Mes Gardes */}
                <td className="border px-0.5 py-0.5 text-center">
                  {renderUserShiftBadge(userShifts['M'], date)}
                </td>
                <td className="border px-0.5 py-0.5 text-center">
                  {renderUserShiftBadge(userShifts['AM'], date)}
                </td>
                <td className="border px-0.5 py-0.5 text-center">
                  {renderUserShiftBadge(userShifts['S'], date)}
                </td>
                
                {/* Colonnes Gardes Proposées */}
                <td className="border px-0.5 py-0.5 text-center">
                  {renderProposedShiftBadges(proposedShifts['M'], date)}
                </td>
                <td className="border px-0.5 py-0.5 text-center">
                  {renderProposedShiftBadges(proposedShifts['AM'], date)}
                </td>
                <td className="border px-0.5 py-0.5 text-center">
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
