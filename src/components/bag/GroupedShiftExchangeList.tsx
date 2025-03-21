import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, UserCheck, UserX, AlertTriangle, ChevronDown, ChevronUp, ArrowLeftRight, Calendar } from 'lucide-react';
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
  const dateRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleDates, setVisibleDates] = useState<Record<string, number>>({});
  const visibleDatesRef = useRef<Record<string, number>>({});
  const planningTitlePositionRef = useRef<number | null>(null);

  // Regrouper les échanges par date
  const groupExchangesByDate = (): GroupedExchanges => {
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
  };

  const groupedExchanges = groupExchangesByDate();
  
  // Trier les dates par ordre chronologique
  const sortedDates = Object.keys(groupedExchanges).sort((a, b) => a.localeCompare(b));

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

  // Fonction pour déterminer la date la plus proche du titre du planning latéral
  const updateDateBasedOnAlignment = useCallback(() => {
    if (!planningTitlePositionRef.current || !containerRef.current) return;
    
    const planningTitleY = planningTitlePositionRef.current;
    let closestDate = '';
    let minDistance = Number.MAX_VALUE;
    
    // Parcourir toutes les dates et trouver celle qui est la plus proche du titre
    Object.entries(dateRefs.current).forEach(([date, ref]) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const dateHeaderY = rect.top + (rect.height / 2); // Centre de l'en-tête de date
        const distance = Math.abs(dateHeaderY - planningTitleY);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestDate = date;
        }
      }
    });
    
    // Si on a trouvé une date proche, la sélectionner
    if (closestDate && minDistance < 100) { // Seuil de 100px pour considérer l'alignement
      onSelectDate(closestDate);
    }
  }, [onSelectDate]);
  
  // Version debounced de la fonction pour éviter les appels trop fréquents
  const debouncedUpdateDate = useCallback(
    debounce(updateDateBasedOnAlignment, 100),
    [updateDateBasedOnAlignment]
  );

  // Obtenir la position du titre du planning latéral
  useEffect(() => {
    const getPlanningTitlePosition = () => {
      const planningTitle = document.querySelector('.planning-title');
      if (planningTitle) {
        const rect = planningTitle.getBoundingClientRect();
        planningTitlePositionRef.current = rect.top + (rect.height / 2); // Centre du titre
      }
    };
    
    // Obtenir la position initiale
    getPlanningTitlePosition();
    
    // Mettre à jour la position lors du redimensionnement
    window.addEventListener('resize', getPlanningTitlePosition);
    
    return () => {
      window.removeEventListener('resize', getPlanningTitlePosition);
    };
  }, []);

  // Configurer l'écouteur de défilement pour détecter l'alignement
  useEffect(() => {
    const handleScroll = () => {
      // Mettre à jour la position du titre du planning
      const planningTitle = document.querySelector('.planning-title');
      if (planningTitle) {
        const rect = planningTitle.getBoundingClientRect();
        planningTitlePositionRef.current = rect.top + (rect.height / 2);
      }
      
      // Appeler la fonction debounced pour mettre à jour la date
      debouncedUpdateDate();
    };
    
    // Ajouter l'écouteur de défilement
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [debouncedUpdateDate]);

  // Sélectionner la première date au chargement initial si aucune date n'est sélectionnée
  useEffect(() => {
    if (sortedDates.length > 0 && !selectedDate) {
      onSelectDate(sortedDates[0]);
    }
  }, [sortedDates, selectedDate, onSelectDate]);

  const periodNames = {
    'M': 'Matin',
    'AM': 'Après-midi',
    'S': 'Soir'
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {/* Indicateur de date flottant */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 -mx-2 px-2 py-1.5 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-xs font-medium text-gray-700">
              {selectedDate ? format(new Date(selectedDate), 'EEEE d MMMM', { locale: fr }) : 'Sélectionnez une date'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500">
            {Object.keys(groupedExchanges).length} dates disponibles
          </span>
        </div>
      </div>

      {sortedDates.map(date => {
        const { dateObj, exchanges: dateExchanges } = groupedExchanges[date];
        const isWeekendOrHoliday = isGrayedOut(dateObj);
        const isExpanded = expandedDates[date] !== false; // Par défaut, développé
        
        return (
          <div 
            key={date} 
            ref={el => dateRefs.current[date] = el}
            data-date={date}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden
              transform transition-all duration-300 ease-out
              ${isWeekendOrHoliday ? 'bg-red-50/30' : ''}
              ${selectedDate === date ? 'ring-2 ring-indigo-300 scale-[1.01]' : 'hover:scale-[1.005]'}
            `}
          >
            {/* En-tête de date avec compteur et bouton d'expansion */}
            <div 
              className={`px-4 py-3 flex justify-between items-center cursor-pointer
                ${isWeekendOrHoliday ? 'bg-red-50/50' : 'bg-gray-50'}
                hover:bg-gray-100 transition-all duration-200
              `}
              onClick={() => toggleDateExpansion(date)}
            >
              <div className="flex items-center">
                <h3 className="text-sm font-bold text-gray-900">
                  {format(dateObj, 'EEEE d MMMM', { locale: fr }).charAt(0).toUpperCase() + 
                   format(dateObj, 'EEEE d MMMM', { locale: fr }).slice(1)}
                </h3>
                <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px]">
                  {dateExchanges.length}
                </span>
              </div>
              <button className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
            
            {/* Liste des gardes pour cette date */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
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
                      className={`p-4 hover:bg-gray-50/80 transition-colors
                        transform transition-all duration-200 ease-out
                        ${isUnavailable ? 'bg-gray-100' : ''}
                        ${isReceivedShift ? 'hover:scale-[1.01]' : ''}
                      `}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        {/* Période et type de garde */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
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
                              px-2 py-1 rounded text-[10px] font-medium transition-all
                              ${exchange.period === 'M'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 shift-badge-morning'
                                : exchange.period === 'AM'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 shift-badge-afternoon'
                                : 'bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100 shift-badge-evening'
                              }
                              ${isInteractionDisabled || exchange.userId === user?.id || isReceivedShift || isUnavailable
                                ? 'opacity-70 cursor-not-allowed'
                                : ''
                              }
                              ${isInterested
                                ? 'shift-badge-interested'
                                : ''
                              }
                              ${hasConflict
                                ? 'shift-badge-conflict ring-1 ring-red-400'
                                : ''
                              }
                            `}
                          >
                            <div className="flex items-center gap-1">
                              <span>{periodNames[exchange.period]}</span>
                              <span className="font-bold">{exchange.shiftType}</span>
                              {interestedCount > 0 && (
                                <span className="px-1 bg-white/50 rounded text-[8px]">
                                  {interestedCount}
                                </span>
                              )}
                            </div>
                          </button>
                          
                          {/* Nom de la personne qui propose (très réduit) */}
                          <span className="text-[8px] text-gray-500 font-medium">
                            {exchangeUser ? exchangeUser.lastName.toUpperCase() : 'INCONNU'}
                          </span>
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
    </div>
  );
};

export default GroupedShiftExchangeList;