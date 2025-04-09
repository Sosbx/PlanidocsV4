import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, UserCheck, UserX, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeftRight, Calendar, Eye } from 'lucide-react';
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

  // Ajoutons quelques états pour améliorer l'organisation et la navigation
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'M' | 'AM' | 'S'>('all');

  // Fonction utilitaire pour obtenir le numéro de semaine
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Grouper les dates par semaine
  const datesByWeek = React.useMemo(() => {
    const grouped: Record<number, string[]> = {};
    
    sortedDates.forEach(date => {
      const dateObj = new Date(date);
      const weekNum = getWeekNumber(dateObj);
      
      if (!grouped[weekNum]) {
        grouped[weekNum] = [];
      }
      
      grouped[weekNum].push(date);
    });
    
    return grouped;
  }, [sortedDates]);

  // Initialiser la semaine courante lors du chargement
  React.useEffect(() => {
    if (Object.keys(datesByWeek).length > 0 && !currentWeek) {
      const weeks = Object.keys(datesByWeek).map(Number);
      const today = new Date();
      const currentWeekNum = getWeekNumber(today);
      
      // Trouver la semaine la plus proche de la semaine actuelle
      const closestWeek = weeks.reduce((prev, curr) => 
        Math.abs(curr - currentWeekNum) < Math.abs(prev - currentWeekNum) ? curr : prev
      );
      
      setCurrentWeek(closestWeek);
    }
  }, [datesByWeek, currentWeek]);

  // Fonction pour filtrer les échanges par période
  const filterExchangesByPeriod = (exchanges: ShiftExchange[]) => {
    if (filterPeriod === 'all') return exchanges;
    return exchanges.filter(exchange => exchange.period === filterPeriod);
  };

  return (
    <div className="space-y-4 relative pb-32 h-full" ref={containerRef}>
      {/* Panneau de navigation minimaliste par mois */}
      <div className="bg-white rounded-lg shadow-sm p-2 mb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          {/* Navigation par mois */}
          <div className="flex items-center">
            {/* Afficher le nom du mois courant */}
            <span className="text-xs font-medium text-indigo-700 px-1">
              {currentWeek ? (() => {
                // Trouver une date de ce mois à partir du numéro de semaine
                // On prend la première date disponible dans cette semaine
                const weeks = Object.keys(datesByWeek).map(Number);
                if (weeks.includes(currentWeek)) {
                  const firstDateOfWeek = datesByWeek[currentWeek][0];
                  const date = new Date(firstDateOfWeek);
                  return format(date, 'MMMM yyyy', { locale: fr });
                }
                return 'Mois en cours';
              })() : 'Mois en cours'}
            </span>
            
            <div className="flex ml-1">
              {/* Navigation par mois, pas par semaine */}
              <button 
                onClick={() => {
                  // Trouver le mois précédent
                  if (currentWeek) {
                    const weeks = Object.keys(datesByWeek).map(Number).sort((a, b) => a - b);
                    const currentIndex = weeks.indexOf(currentWeek);
                    if (currentIndex > 0) {
                      // Trouver la première date de la semaine actuelle
                      const currentDateStr = datesByWeek[currentWeek][0];
                      const currentDate = new Date(currentDateStr);
                      
                      // Calculer le mois précédent
                      const prevMonth = new Date(currentDate);
                      prevMonth.setMonth(prevMonth.getMonth() - 1);
                      
                      // Trouver la semaine qui contient ce mois
                      const targetWeek = getWeekNumber(prevMonth);
                      
                      // Trouver la semaine la plus proche
                      const closestWeek = weeks.reduce((prev, curr) => 
                        Math.abs(curr - targetWeek) < Math.abs(prev - targetWeek) ? curr : prev
                      );
                      
                      setCurrentWeek(closestWeek);
                    }
                  }
                }}
                className="p-1 rounded-l border border-gray-200"
              >
                <ChevronLeft className="h-3 w-3 text-gray-600" />
              </button>
              
              <button 
                onClick={() => {
                  // Retourner au mois actuel
                  const today = new Date();
                  const currentWeekNum = getWeekNumber(today);
                  
                  // Trouver la semaine la plus proche
                  const weeks = Object.keys(datesByWeek).map(Number);
                  const closestWeek = weeks.reduce((prev, curr) => 
                    Math.abs(curr - currentWeekNum) < Math.abs(prev - currentWeekNum) ? curr : prev
                  );
                  
                  setCurrentWeek(closestWeek);
                }}
                className="p-1 border-t border-b border-gray-200"
              >
                <Calendar className="h-3 w-3 text-indigo-600" />
              </button>
              
              <button 
                onClick={() => {
                  // Trouver le mois suivant
                  if (currentWeek) {
                    const weeks = Object.keys(datesByWeek).map(Number).sort((a, b) => a - b);
                    const currentIndex = weeks.indexOf(currentWeek);
                    if (currentIndex < weeks.length - 1) {
                      // Trouver la première date de la semaine actuelle
                      const currentDateStr = datesByWeek[currentWeek][0];
                      const currentDate = new Date(currentDateStr);
                      
                      // Calculer le mois suivant
                      const nextMonth = new Date(currentDate);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      
                      // Trouver la semaine qui contient ce mois
                      const targetWeek = getWeekNumber(nextMonth);
                      
                      // Trouver la semaine la plus proche
                      const closestWeek = weeks.reduce((prev, curr) => 
                        Math.abs(curr - targetWeek) < Math.abs(prev - targetWeek) ? curr : prev
                      );
                      
                      setCurrentWeek(closestWeek);
                    }
                  }
                }}
                className="p-1 rounded-r border border-gray-200 border-l-0"
              >
                <ChevronRight className="h-3 w-3 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cartes de date et d'échanges */}
      {sortedDates
        .filter(date => {
          // Filtrer par semaine si une semaine est sélectionnée
          if (!currentWeek) return true;
          const dateWeek = getWeekNumber(new Date(date));
          return dateWeek === currentWeek;
        })
        .map(date => {
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
              className={`bg-white rounded-xl shadow-sm overflow-hidden
                transform transition-all duration-300 ease-out
                ${isWeekendOrHoliday ? 'bg-red-50/30' : ''}
                ${selectedDate === date ? 'ring-2 ring-indigo-500 scale-[1.02] shadow-lg' : 'hover:shadow hover:scale-[1.005]'}
                ${visibleDates.includes(date) ? 'border-indigo-200' : ''}
                ${primaryVisibleDate === date ? 'border-l-4 border-l-indigo-500 bg-indigo-50/20' : ''}
              `}
            >
              {/* En-tête ultra minimaliste de date pour mobile */}
              <div 
                className={`px-2 py-1.5 flex justify-between items-center cursor-pointer
                  ${isWeekendOrHoliday ? 'bg-red-50' : 'bg-indigo-50/30'}
                  hover:bg-indigo-100/50 transition-all duration-200
                `}
                onClick={() => toggleDateExpansion(date)}
              >
                <div className="flex items-center">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isWeekendOrHoliday ? 'text-red-600 bg-red-100' : 'text-indigo-600 bg-indigo-100'}`}>
                      {format(dateObj, 'EEEE', { locale: fr }).substring(0, 1)}
                    </span>
                    <span className={`text-sm font-semibold ${isWeekendOrHoliday ? 'text-red-700' : 'text-gray-800'}`}>
                      {format(dateObj, 'd', { locale: fr })}
                    </span>
                    <span className={`text-[10px] ${isWeekendOrHoliday ? 'text-red-500' : 'text-gray-500'}`}>
                      {format(dateObj, 'MMM', { locale: fr })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-all">
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 text-indigo-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-indigo-600" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Liste des gardes pour cette date */}
              {isExpanded && filteredExchanges.length > 0 && (
                <div className="divide-y divide-gray-100/60">
                  {filteredExchanges.map(exchange => {
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
                        className={`p-1.5 hover:bg-indigo-50/30 transition-colors cursor-pointer shift-card
                          transform transition-all duration-300 ease-out
                          ${isUnavailable ? 'bg-gray-100' : ''}
                          ${isReceivedShift ? 'hover:scale-[1.01]' : ''}
                          ${isInterested ? 'bg-green-50/20 shift-item-interested' : ''}
                          ${hasConflict ? 'bg-red-50/20 shift-item-conflict' : ''}
                          ${exchange.userId === user?.id ? 'bg-gray-50 opacity-75 shift-card-user' : ''}
                        `}
                        onClick={() => {
                          // Sélectionner la date de cette garde quand on clique sur la carte
                          onSelectDate(exchange.date);
                        }}
                      >
                        <div className="flex flex-row items-start gap-1.5">
                          {/* Badge de garde compact mais assez grand pour le tactile */}
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
                              min-w-[40px] h-[40px] flex-shrink-0 rounded-md text-sm font-bold transition-all shadow-sm flex justify-center items-center
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
                              ${isInterested && !hasConflict
                                ? 'shift-badge-interested ring-2 ring-green-500 ring-offset-1'
                                : ''
                              }
                              ${hasConflict
                                ? 'shift-badge-conflict ring-2 ring-red-500 ring-offset-1'
                                : ''
                              }
                            `}
                          >
                            <span className="font-bold">{exchange.shiftType}</span>
                          </button>
                          
                          {/* Informations sur l'échange et le médecin */}
                          <div className="flex flex-col flex-grow min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-gray-800 truncate">
                                {exchangeUser ? exchangeUser.lastName : 'Médecin'}
                              </span>
                              <div className="flex gap-1 ml-1">
                                {interestedCount > 0 && (
                                  <span className="px-1 rounded-sm bg-indigo-50 text-[9px] text-indigo-700 font-medium">
                                    {interestedCount}
                                  </span>
                                )}
                                {isInterested && !hasConflict && (
                                  <UserCheck className="h-3 w-3 text-green-600" />
                                )}
                                {hasConflict && (
                                  <ArrowLeftRight className="h-3 w-3 text-red-600" />
                                )}
                              </div>
                            </div>
                            {/* Commentaire en petit */}
                            {exchange.comment && (
                              <span className="text-[9px] text-gray-500 truncate">
                                {exchange.comment}
                              </span>
                            )}
                            {/* Période en texte (uniquement sur desktop) */}
                            <span className="text-[9px] text-gray-500">
                              {periodNames[exchange.period as keyof typeof periodNames]}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Afficher un message si pas d'échanges après filtrage */}
              {isExpanded && filteredExchanges.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  Aucune garde {filterPeriod === 'M' ? 'du matin' : filterPeriod === 'AM' ? 'de l\'après-midi' : filterPeriod === 'S' ? 'du soir' : ''} disponible pour cette date
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