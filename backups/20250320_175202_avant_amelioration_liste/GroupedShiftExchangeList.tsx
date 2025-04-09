import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, UserCheck, UserX, AlertTriangle, ChevronDown, ChevronUp, ArrowLeftRight, Calendar, Eye } from 'lucide-react';
import './ShiftBadgeAnimation.css';
import { isGrayedOut } from '../../utils/dateUtils';
import { debounce } from '../../utils/debounce';
import type { ShiftExchange } from '../../types/planning';
import type { User } from '../../types/users';
import type { ShiftAssignment } from '../../types/planning';

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
  bagPhaseConfig: any;
  onToggleInterest: (exchange: ShiftExchange) => void;
  onSelectDate: (date: string) => void;
  selectedDate?: string; // Date actuellement sélectionnée
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
  userAssignments,
  conflictStates,
  receivedShifts,
  isInteractionDisabled,
  bagPhaseConfig,
  onToggleInterest,
  onSelectDate,
  selectedDate,
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [visibleDates, setVisibleDates] = useState<string[]>([]);
  const [primaryVisibleDate, setPrimaryVisibleDate] = useState<string | null>(null);
  const dateRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Regrouper les échanges par date - optimisé avec useMemo
  const groupedExchanges = React.useMemo(() => {
    const grouped: GroupedExchanges = {};
    
    exchanges.forEach(exchange => {
      if (!grouped[exchange.date]) {
        grouped[exchange.date] = {
          dateObj: new Date(exchange.date),
          exchanges: []
        };
      }
      grouped[exchange.date].exchanges.push(exchange);
    });
    
    return grouped;
  }, [exchanges]);
  
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

  const periodNames = {
    'M': 'Matin',
    'AM': 'Après-midi',
    'S': 'Soir'
  };

  return (
    <div className="space-y-5 relative pb-32 h-full" ref={containerRef}>
      {/* Container optimisé pour utiliser toute la hauteur disponible */}

      {sortedDates.map(date => {
        const { dateObj, exchanges: dateExchanges } = groupedExchanges[date];
        const isWeekendOrHoliday = isGrayedOut(dateObj);
        const isExpanded = expandedDates[date] !== false; // Par défaut, développé
        
        return (
          <div 
            key={date} 
            ref={el => dateRefs.current[date] = el}
            data-date={date}
            className={`bg-white rounded-xl shadow-sm overflow-hidden
              transform transition-all duration-300 ease-out
              ${isWeekendOrHoliday ? 'bg-red-50/30' : ''}
              ${selectedDate === date ? 'ring-2 ring-indigo-500 scale-[1.02] shadow-lg' : 'hover:shadow hover:scale-[1.005]'}
              ${visibleDates.includes(date) ? 'border-indigo-200' : ''}
              ${primaryVisibleDate === date ? 'border-l-4 border-l-indigo-500 bg-indigo-50/20' : ''}
            `}
          >
            {/* En-tête minimaliste de date */}
            <div 
              className={`px-4 py-3 flex justify-between items-center cursor-pointer
                ${isWeekendOrHoliday ? 'bg-red-50' : 'bg-indigo-50/30'}
                hover:bg-indigo-100/50 transition-all duration-200
              `}
              onClick={() => toggleDateExpansion(date)}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${isWeekendOrHoliday ? 'text-red-600 bg-red-100' : 'text-indigo-600 bg-indigo-100'}`}>
                    {format(dateObj, 'EEEE', { locale: fr }).substring(0, 3).toUpperCase()}
                  </span>
                  <span className={`text-base font-semibold ${isWeekendOrHoliday ? 'text-red-700' : 'text-gray-800'}`}>
                    {format(dateObj, 'd MMM', { locale: fr })}
                  </span>
                </div>
                <span className="ml-3 flex items-center justify-center h-6 w-6 bg-indigo-500 text-white rounded-full text-xs font-bold shadow-sm">
                  {dateExchanges.length}
                </span>
              </div>
              <button className="p-1.5 rounded-full bg-white/80 shadow-sm hover:bg-white hover:shadow transition-all">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-indigo-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-indigo-600" />
                )}
              </button>
            </div>
            
            {/* Liste des gardes pour cette date */}
            {isExpanded && (
              <div className="divide-y divide-gray-100/60">
                {dateExchanges.map(exchange => {
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
                  
                  // Pour afficher différemment les permutations
                  const isReceivedPermutation = isReceivedShift && receivedShift?.isPermutation;

                  return (
                    <div 
                      key={exchange.id} 
                      className={`p-2.5 sm:p-3 hover:bg-indigo-50/30 transition-colors cursor-pointer
                        transform transition-all duration-300 ease-out
                        ${isUnavailable ? 'bg-gray-100' : ''}
                        ${isReceivedShift ? 'hover:scale-[1.01]' : ''}
                        ${isInterested ? 'border-l-4 border-l-green-500 bg-green-50/30' : ''}
                        ${hasConflict ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : ''}
                        ${exchange.userId === user?.id ? 'border-l-4 border-l-indigo-500 bg-indigo-50/30' : ''}
                      `}
                      onClick={() => {
                        // Sélectionner la date de cette garde quand on clique sur la carte
                        onSelectDate(exchange.date);
                      }}
                    >
                      <div className="flex flex-row items-center justify-between gap-1">
                        {/* Période et type de garde */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={(e) => {
                              // Empêcher la propagation pour éviter de déclencher l'événement du parent
                              e.stopPropagation();
                              
                              if (!isInteractionDisabled && !isUnavailable && exchange.userId !== user?.id && !isReceivedShift) {
                                // Référence à l'élément pour l'animation
                                const badgeElement = document.getElementById(`shift-badge-${exchange.id}`);
                                if (badgeElement) {
                                  // Ajouter la classe d'animation appropriée
                                  if (isInterested) {
                                    badgeElement.classList.remove('shift-badge-interested');
                                    badgeElement.classList.add('shift-badge-ripple');
                                  } else {
                                    badgeElement.classList.add('shift-badge-ripple');
                                    // Ajouter la classe "intéressé" après un court délai
                                    setTimeout(() => {
                                      badgeElement.classList.remove('shift-badge-ripple');
                                      badgeElement.classList.add('shift-badge-interested');
                                    }, 800);
                                  }
                                }
                                
                                // Appeler la fonction de toggle
                                onToggleInterest(exchange);
                              }
                            }}
                            id={`shift-badge-${exchange.id}`}
                            disabled={isInteractionDisabled || exchange.userId === user?.id || isReceivedShift || isUnavailable}
                            className={`
                              min-w-[50px] px-2 py-2 sm:px-3 sm:py-2 rounded-md text-sm font-bold transition-all shadow-sm flex justify-center items-center
                              ${exchange.period === 'M'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 shift-badge-morning'
                                : exchange.period === 'AM'
                                ? 'bg-sky-100 text-sky-800 border border-sky-300 hover:bg-sky-200 shift-badge-afternoon'
                                : 'bg-violet-100 text-violet-800 border border-violet-300 hover:bg-violet-200 shift-badge-evening'
                              }
                              ${isInteractionDisabled || exchange.userId === user?.id || isReceivedShift || isUnavailable
                                ? 'opacity-70 cursor-not-allowed'
                                : 'cursor-pointer'
                              }
                              ${isInterested
                                ? 'shift-badge-interested ring-2 ring-green-500 ring-offset-1'
                                : ''
                              }
                              ${hasConflict
                                ? 'shift-badge-conflict ring-2 ring-amber-500 ring-offset-1'
                                : ''
                              }
                            `}
                          >
                            <div className="flex items-center">
                              <span className="font-bold">{exchange.shiftType}</span>
                              {interestedCount > 0 && (
                                <span className="ml-1 px-1 py-0.5 bg-white/70 rounded-sm text-[10px] font-semibold">
                                  {interestedCount}
                                </span>
                              )}
                            </div>
                          </button>
                          
                          {/* Version simplifiée des infos sur l'échange */}
                          <div className="flex">
                            <span className="text-xs text-gray-700 font-medium truncate max-w-[150px]">
                              {exchange.comment || (exchangeUser ? exchangeUser.lastName.toUpperCase() : '')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
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