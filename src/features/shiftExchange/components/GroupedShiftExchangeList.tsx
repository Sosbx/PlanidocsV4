import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { isGrayedOut, formatWithCapitalizedMonth, getPeriodDisplayText } from '../../../utils/dateUtils';
import CompletedPhaseExchangeItem from './CompletedPhaseExchangeItem';
import type { BagPhaseConfig } from '../types';
import { debounce } from '../../../utils/debounce';
import type { ShiftExchange } from '../types';
import type { User } from '../../../features/users/types';
import type { ShiftAssignment } from '../types';
import { useDesiderataState } from '../../../features/planning/hooks/useDesiderataState';
import ShiftStatusBadge, { ShiftStatus } from '../../../components/ShiftStatusBadge';
import useResponsiveDisplay from '../../../hooks/useResponsiveDisplay';
import { ShiftPeriod } from '../types';
import { useReplacements } from '../hooks/useReplacements';
import { proposeToReplacements, cancelPropositionToReplacements } from '../../../lib/firebase/shifts';
import type { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';

interface GroupedShiftExchangeListProps {
  exchanges: ShiftExchange[];
  user: any; // Utilisateur connecté
  users: User[];
  userAssignments: Record<string, ShiftAssignment>;
  conflictStates: Record<string, boolean>;
  receivedShifts: Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>;
  isInteractionDisabled: boolean;
  bagPhaseConfig: BagPhaseConfig;
  onToggleInterest: (exchange: ShiftExchange) => Promise<void> | void;
  onSelectDate: (date: string) => void;
  selectedDate?: string; // Date actuellement sélectionnée
  filterPeriod?: 'all' | ShiftPeriod; // Filtrage par période
  showDesiderata?: boolean; // Afficher les désidératas
  hidePrimaryDesiderata?: boolean; // Masquer les désidératas primaires
  hideSecondaryDesiderata?: boolean; // Masquer les désidératas secondaires
}

interface GroupedExchanges {
  [date: string]: {
    dateObj: Date;
    exchanges: ShiftExchange[];
  };
}

const GroupedShiftExchangeList: React.FC<GroupedShiftExchangeListProps> = ({
  exchanges,
  user,
  users,
  conflictStates,
  receivedShifts,
  isInteractionDisabled,
  bagPhaseConfig,
  onToggleInterest,
  onSelectDate,
  selectedDate,
  filterPeriod: propFilterPeriod = 'all', // Valeur par défaut 'all'
  showDesiderata = false,
  hidePrimaryDesiderata = false,
  hideSecondaryDesiderata = false,
}) => {
  // Récupération de l'état responsive
  const { isMobile, isTablet } = useResponsiveDisplay();
  
  // Récupérer les IDs des échanges pour charger les remplacements
  const exchangeIds = React.useMemo(() => exchanges.map(e => e.id), [exchanges]);
  
  // Charger les remplacements associés aux échanges
  const { replacements } = useReplacements(exchangeIds);
  
  // Access desiderata state if needed
  const { /* selections, isLoading: isLoadingDesiderata */ } = useDesiderataState();
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [, setVisibleDates] = useState<string[]>([]);
  const [primaryVisibleDate, setPrimaryVisibleDate] = useState<string | null>(null);
  const dateRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  
  // États locaux pour gérer les remplacements
  const [proposingShift, setProposingShift] = useState<string | null>(null);
  const [removingShift, setRemovingShift] = useState<string | null>(null);
  
  // Fonction pour proposer aux remplaçants
  const handleProposeToReplacements = useCallback(async (exchange: ShiftExchange) => {
    try {
      setProposingShift(exchange.id);
      
      // Convertir le type ShiftExchange local vers le type PlanningShiftExchange
      const planningExchange: PlanningShiftExchange = {
        id: exchange.id,
        userId: exchange.userId,
        date: exchange.date,
        period: exchange.period,
        shiftType: exchange.shiftType,
        timeSlot: exchange.timeSlot,
        comment: exchange.comment,
        createdAt: exchange.createdAt,
        interestedUsers: exchange.interestedUsers,
        status: exchange.status,
        lastModified: exchange.lastModified,
        proposedToReplacements: exchange.proposedToReplacements,
        operationTypes: exchange.operationTypes || []
      };
      
      if (exchange.proposedToReplacements) {
        // Annuler la proposition
        await cancelPropositionToReplacements(planningExchange, true);
        console.log('Proposition annulée pour:', exchange.id);
      } else {
        // Proposer aux remplaçants
        await proposeToReplacements(planningExchange, [], true);
        console.log('Proposé aux remplaçants:', exchange.id);
      }
      
      // Les données seront automatiquement mises à jour via les listeners
    } catch (error) {
      console.error('Erreur lors de la proposition aux remplaçants:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      alert(errorMessage);
    } finally {
      setProposingShift(null);
    }
  }, []);
  
  const handleRemoveFromExchange = useCallback(async (exchangeId: string) => {
    try {
      setRemovingShift(exchangeId);
      // TODO: Implémenter le retrait de l'échange
      console.log('Retrait de l\'échange:', exchangeId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Fonctionnalité de retrait à implémenter');
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setRemovingShift(null);
    }
  }, []);

  // Récupérer les désidératas (incluant les archivés)
  const { selections, isLoading: isLoadingDesiderata } = useDesiderataState(true);
  
  // Regrouper les échanges par date - optimisé avec useMemo
  // Utiliser directement les exchanges qui sont déjà filtrés par useShiftExchangeData
  // Appliquer uniquement le filtrage des désidératas ici
  const groupedExchanges = React.useMemo(() => {
    const grouped: GroupedExchanges = {};
    
    exchanges.forEach(exchange => {
      // Vérifier si cette garde est sur un désidérata
      if (showDesiderata && !isLoadingDesiderata) {
        const desidKey = `${exchange.date}-${exchange.period}`;
        const desiderataType = selections[desidKey]?.type;
        
        // Masquer les gardes sur désidératas primaires si l'option est activée
        if (hidePrimaryDesiderata && desiderataType === 'primary') {
          return;
        }
        
        // Masquer les gardes sur désidératas secondaires si l'option est activée
        if (hideSecondaryDesiderata && desiderataType === 'secondary') {
          return;
        }
      }
      
      if (!grouped[exchange.date]) {
        grouped[exchange.date] = {
          dateObj: new Date(exchange.date),
          exchanges: []
        };
      }
      grouped[exchange.date].exchanges.push(exchange);
    });
    
    return grouped;
  }, [exchanges, showDesiderata, hidePrimaryDesiderata, hideSecondaryDesiderata, selections, isLoadingDesiderata]);
  
  // Trier les dates par ordre chronologique - mémorisé
  const sortedDates = React.useMemo(() => 
    Object.keys(groupedExchanges).sort((a, b) => a.localeCompare(b)),
    [groupedExchanges]);

  // Basculer l'état d'expansion d'une date
  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
    
    // Si on développe une date, la sélectionner pour le planning
    if (!expandedDates[date]) {
      onSelectDate(date);
    }
  };

  // Initialiser toutes les dates comme développées par défaut
  React.useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    sortedDates.forEach(date => {
      initialExpanded[date] = true;
    });
    setExpandedDates(initialExpanded);
  }, [sortedDates.length]);

  // Sélectionner la première date au chargement initial si aucune date n'est sélectionnée
  useEffect(() => {
    if (sortedDates.length > 0 && !selectedDate) {
      onSelectDate(sortedDates[0]);
    }
  }, [sortedDates, selectedDate, onSelectDate]);

  // Fonction pour déterminer quelle(s) date(s) est/sont visible(s) dans la viewport
  const updateVisibleDates = useCallback(
    debounce(() => {
      const dateElements = Object.entries(dateRefs.current);
      if (dateElements.length === 0) return;
      
      const visibleDatesArray: string[] = [];
      let bestVisibilityScore = 0;
      let mostVisibleDate: string | null = null;
      
      dateElements.forEach(([date, element]) => {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Une date est considérée visible si au moins une partie est dans la viewport
        const isVisible = rect.bottom > 0 && rect.top < windowHeight;
        
        if (isVisible) {
          visibleDatesArray.push(date);
          
          // Calculer la visibilité (pourcentage de l'élément visible dans la viewport)
          const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
          const percentVisible = visibleHeight / rect.height;
          
          // Facteur supplémentaire: privilégier les éléments centrés dans la viewport
          const distanceFromCenter = Math.abs((rect.top + rect.bottom) / 2 - windowHeight / 2);
          const centeringFactor = 1 - (distanceFromCenter / windowHeight);
          
          // Score combiné: visibilité + centrage
          const visibilityScore = percentVisible * 0.6 + centeringFactor * 0.4;
          
          if (visibilityScore > bestVisibilityScore) {
            bestVisibilityScore = visibilityScore;
            mostVisibleDate = date;
          }
        }
      });
      
      setVisibleDates(visibleDatesArray);
      
      // Mettre à jour la date principale visible et synchroniser le planning fixe
      if (mostVisibleDate && mostVisibleDate !== primaryVisibleDate) {
        setPrimaryVisibleDate(mostVisibleDate);
        onSelectDate(mostVisibleDate);
        
        // Ajout de l'animation pour l'indicateur
        if (indicatorRef.current) {
          indicatorRef.current.classList.remove('date-indicator-update');
          void indicatorRef.current.offsetWidth; // Force reflow
          indicatorRef.current.classList.add('date-indicator-update');
        }
      }
    }, 150),
    [primaryVisibleDate, onSelectDate]
  );
  
  // Ajouter l'écouteur de défilement optimisé
  useEffect(() => {
    // Récupérer directement le container de défilement
    const scrollContainer = document.getElementById('shift-exchange-container');
    
    // Utiliser le container spécifique pour la détection du défilement
    if (scrollContainer) {
      // N'ajouter qu'un seul écouteur de défilement sur le conteneur principal
      scrollContainer.addEventListener('scroll', updateVisibleDates);
      
      // Déclencher après le rendu initial pour initialiser l'état
      requestAnimationFrame(() => {
        updateVisibleDates();
      });
    }
    
    // Nettoyage
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateVisibleDates);
      }
    };
  }, [updateVisibleDates]);

  // Fonction pour filtrer les échanges par période
  const filterExchangesByPeriod = (exchanges: ShiftExchange[]) => {
    if (propFilterPeriod === 'all') return exchanges;
    
    // Pas besoin de mappage complexe car l'enum ShiftPeriod correspond déjà aux valeurs
    // utilisées dans le modèle de données (voir ShiftPeriod.MORNING = 'M', etc.)
    return exchanges.filter(exchange => exchange.period === propFilterPeriod);
  };
  
  // Variable pour le filtrage
  const filterPeriod = propFilterPeriod;

  return (
    <div className="space-y-4 relative pb-32 h-full w-full list-view" ref={containerRef}>
      {(() => {
        // Organiser les dates par mois pour un affichage plus clair
        const datesByMonth: Record<string, string[]> = {};
        
        // Grouper les dates par mois
        sortedDates.forEach(date => {
          const month = format(new Date(date), 'yyyy-MM');
          
          if (!datesByMonth[month]) {
            datesByMonth[month] = [];
          }
          datesByMonth[month].push(date);
        });
        
        // Générer le contenu avec des séparateurs de mois
        return Object.entries(datesByMonth).map(([month, dates]) => (
          <React.Fragment key={month}>
            {/* Séparateur de mois avec flèches de navigation */}
            <div id={`month-${month}`} className="flex items-center gap-2 my-4 first:mt-0">
              <div className="h-px bg-gray-200 flex-grow" />
              
              <div className="flex items-center gap-1">
                {/* Flèche pour aller au mois précédent */}
                <button 
                  onClick={() => {
                    // Trouver le mois précédent dans la liste triée
                    const sortedMonths = Object.keys(datesByMonth).sort();
                    const currentIndex = sortedMonths.indexOf(month);
                    if (currentIndex > 0) {
                      const prevMonth = sortedMonths[currentIndex - 1];
                      const monthElement = document.getElementById(`month-${prevMonth}`);
                      if (monthElement) {
                        monthElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Mois précédent"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                
                <span className="text-sm font-medium text-gray-700">
                  {formatWithCapitalizedMonth(new Date(month), 'MMMM yyyy')}
                </span>
                
                {/* Flèche pour aller au mois suivant */}
                <button 
                  onClick={() => {
                    // Trouver le mois suivant dans la liste triée
                    const sortedMonths = Object.keys(datesByMonth).sort();
                    const currentIndex = sortedMonths.indexOf(month);
                    if (currentIndex < sortedMonths.length - 1) {
                      const nextMonth = sortedMonths[currentIndex + 1];
                      const monthElement = document.getElementById(`month-${nextMonth}`);
                      if (monthElement) {
                        monthElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Mois suivant"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              
              <div className="h-px bg-gray-200 flex-grow" />
            </div>
            
            {/* Afficher les dates de ce mois */}
            {dates.map(date => {
              const { dateObj, exchanges: dateExchanges } = groupedExchanges[date];
              const filteredExchanges = filterExchangesByPeriod(dateExchanges);
              const isWeekendOrHoliday = isGrayedOut(dateObj);
              const isExpanded = expandedDates[date] !== false; // Par défaut, développé
              
              // Skip si aucun échange après filtrage
              if (filteredExchanges.length === 0 && filterPeriod !== 'all') return null;
              
              return (
                <div 
                  key={date} 
                  ref={el => dateRefs.current[date] = el}
                  data-date={date}
                  className={`bg-white rounded-xl overflow-hidden w-full max-w-full mx-auto
                transform transition-all duration-300 ease-out
                ${isWeekendOrHoliday ? 'bg-red-50/30' : ''}
                ${selectedDate === date 
                  ? 'ring-1 ring-indigo-400 shadow-md border border-indigo-100' 
                  : 'hover:shadow hover:scale-[1.005] border border-gray-100'}
                ${primaryVisibleDate === date ? 'border-l-2 border-l-indigo-400' : ''}
              `}
            >
              {/* En-tête ultra minimaliste de date pour mobile */}
              <div 
                className={`px-2 sm:px-4 py-1.5 sm:py-2.5 flex justify-between items-center cursor-pointer w-full
                  ${isWeekendOrHoliday 
                    ? 'bg-red-50' 
                    : selectedDate === date
                      ? 'bg-indigo-50'
                      : 'bg-gray-50/50'
                  }
                  hover:bg-indigo-100/50 transition-all duration-200
                `}
                onClick={() => toggleDateExpansion(date)}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0 max-w-full">
                    <span className={`text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded flex-shrink-0 ${isWeekendOrHoliday ? 'text-red-600 bg-red-100' : 'text-indigo-600 bg-indigo-100'}`}>
                      {format(dateObj, 'EEEE', { locale: fr }).substring(0, 1)}
                    </span>
                    <span className={`text-sm sm:text-base font-semibold flex-shrink-0 ${isWeekendOrHoliday ? 'text-red-700' : 'text-gray-800'}`}>
                      {format(dateObj, 'd', { locale: fr })}
                    </span>
                    <span className={`text-[10px] sm:text-sm truncate ${isWeekendOrHoliday ? 'text-red-500' : 'text-gray-500'}`}>
                      {formatWithCapitalizedMonth(dateObj, 'MMM')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  <button className="p-1 sm:p-1.5 rounded-full bg-white/80 shadow-sm hover:bg-white transition-all flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Liste des gardes pour cette date */}
              {isExpanded && filteredExchanges.length > 0 && (
                <div className="divide-y divide-gray-100/60 w-full">
                  {filteredExchanges
                    // Trier: d'abord les gardes de l'utilisateur, puis par période (M, AM, S)
                    .sort((a, b) => {
                      // D'abord les gardes de l'utilisateur
                      if (a.userId === user?.id && b.userId !== user?.id) return -1;
                      if (a.userId !== user?.id && b.userId === user?.id) return 1;
                      
                      // Ensuite par période (M, AM, S) dans cet ordre
                      const getOrdinalForPeriod = (period: ShiftPeriod | string) => {
                        if (period === ShiftPeriod.MORNING) return 0;
                        if (period === ShiftPeriod.AFTERNOON) return 1;
                        if (period === ShiftPeriod.EVENING) return 2;
                        return 3; // fallback pour toute autre valeur
                      };
                      return getOrdinalForPeriod(a.period) - getOrdinalForPeriod(b.period);
                    })
                    .map(exchange => {
                    const exchangeUser = users.find(u => u.id === exchange.userId);
                    const isInterested = exchange.interestedUsers?.includes(user?.id || '');
                    const hasConflict = isInterested && conflictStates[exchange.id];
                    const interestedCount = exchange.interestedUsers?.length || 0;
                    const isUnavailable = exchange.status === 'unavailable' && bagPhaseConfig.phase === 'completed';
                    
                    // Vérifier si la cellule représente une garde reçue via un échange
                    const key = `${exchange.date}-${exchange.period}`;
                    const receivedShift = receivedShifts[key];
                    
                    // Nouvelle condition pour les permutations
                    const isReceivedShift = receivedShift && (
                      receivedShift.newUserId === user?.id || 
                      (receivedShift.isPermutation && receivedShift.originalUserId === user?.id)
                    );
                    
                    // Vérifier si c'est une garde de l'utilisateur
                    const isUserShift = exchange.userId === user?.id;
                    
                    // Déterminer le statut du badge
                    let badgeStatus: ShiftStatus = 'normal';
                    if (hasConflict) {
                      badgeStatus = 'conflict';
                    } else if (isInterested) {
                      badgeStatus = 'interested';
                    } else if (exchange.proposedToReplacements) {
                      badgeStatus = 'replacement';
                    } else if (isUnavailable) {
                      badgeStatus = 'unavailable';
                    }

                    return (
                      <div 
                        key={exchange.id} 
                        onClick={() => {
                          // Sélectionner la date de cette garde quand on clique sur la carte
                          onSelectDate(exchange.date);
                        }}
                        className={`flex flex-row items-start gap-1 sm:gap-2 w-full max-w-full px-2 py-2 overflow-hidden ${selectedDate === exchange.date ? 'bg-indigo-50/20' : ''}`}
                      >
                        {/* Badge de garde en utilisant le nouveau composant ShiftStatusBadge */}
                        {(() => {
                          // Vérifier si cette garde est sur un désidérata
                          const desidKey = `${exchange.date}-${exchange.period}`;
                          const desiderataType = showDesiderata && !isLoadingDesiderata 
                            ? selections[desidKey]?.type 
                            : null;
                          
                          return (
                            <ShiftStatusBadge
                              id={`shift-badge-${exchange.id}`}
                              period={exchange.period as ShiftPeriod}
                              status={badgeStatus}
                              shiftType={exchange.shiftType}
                              size={isMobile ? 'sm' : isTablet ? 'md' : 'lg'}
                              isUserShift={isUserShift}
                              isPrimaryDesiderata={desiderataType === 'primary'}
                              isSecondaryDesiderata={desiderataType === 'secondary'}
                              disabled={isInteractionDisabled || exchange.userId === user?.id || isReceivedShift || isUnavailable}
                              onClick={(e) => {
                                // Empêcher la propagation pour éviter de déclencher l'événement du parent
                                e.stopPropagation();
                                
                                if (!isInteractionDisabled && !isUnavailable && exchange.userId !== user?.id && !isReceivedShift) {
                                  // Appeler la fonction de toggle
                                  onToggleInterest(exchange);
                                }
                              }}
                            />
                          );
                        })()}
                        
                        {/* Contenu principal de la garde */}
                        <div className="flex flex-col flex-grow min-w-0 max-w-[calc(100%-45px)] sm:max-w-[calc(100%-50px)]">
                          {/* En phase "completed", utiliser le composant dédié pour les gardes de l'utilisateur */}
                          {isUserShift && bagPhaseConfig.phase === 'completed' ? (
                            <CompletedPhaseExchangeItem
                              exchange={exchange}
                              exchangeUser={exchangeUser}
                              proposingShift={proposingShift}
                              removingShift={removingShift}
                              onProposeToReplacements={handleProposeToReplacements}
                              onRemoveFromExchange={handleRemoveFromExchange}
                              replacementInfo={replacements[exchange.id]}
                            />
                          ) : (
                            <>
                              {/* Affichage standard pour les autres phases */}
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] sm:text-sm font-medium text-gray-800 truncate max-w-[60%]">
                                  {exchangeUser ? exchangeUser.lastName : 'Médecin'}
                                </span>
                                <div className="flex gap-1 ml-1 flex-shrink-0">
                                  {interestedCount > 0 && bagPhaseConfig.phase !== 'completed' && (
                                    <span className="px-1 sm:px-2 rounded-sm bg-indigo-50 text-[9px] sm:text-xs text-indigo-700 font-medium">
                                      {interestedCount}
                                    </span>
                                  )}
                                  {isInterested && !hasConflict && bagPhaseConfig.phase !== 'completed' && (
                                    <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                  )}
                                  {hasConflict && bagPhaseConfig.phase !== 'completed' && (
                                    <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                                  )}
                                </div>
                              </div>
                              {/* Commentaire sur deux lignes */}
                              {exchange.comment && (
                                <div className="text-[9px] sm:text-xs text-gray-500 line-clamp-2 overflow-hidden w-full break-words">
                                  {exchange.comment}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Afficher un message si pas d'échanges après filtrage */}
              {isExpanded && filteredExchanges.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  Aucune garde {filterPeriod !== 'all' ? `(${getPeriodDisplayText(filterPeriod as ShiftPeriod).toLowerCase()})` : ''} disponible pour cette date
                </div>
              )}
            </div>
                );
              })}
            </React.Fragment>
          ))
        })()}
      
      {sortedDates.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500 text-center">
            Aucune garde n'est actuellement disponible à l'échange
          </p>
        </div>
      )}

      {/* Indicateur de fin minimaliste */}
      <div className="h-20 flex items-center justify-center">
        <div className="w-8 h-1 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  );
};

export default GroupedShiftExchangeList;
