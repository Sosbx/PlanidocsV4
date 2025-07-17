import React, { useState, useEffect } from 'react';
import { format, isToday as isTodayFn } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { isGrayedOut } from '../../../utils/dateUtils';
import { formatParisDate, debugTimezone, toParisTime } from '../../../utils/timezoneUtils';
import { useDesiderataState } from '../../../features/planning/hooks/useDesiderataState';
import { UserPlus } from 'lucide-react';
import type { ShiftExchange } from '../types';
import type { User } from '../../../features/users/types';

interface ShiftExchangeCalendarViewProps {
  days: Date[];
  isMobile: boolean;
  filteredExchanges: ShiftExchange[];
  userAssignments: Record<string, any>;
  conflictStates: Record<string, boolean>;
  interestedPeriodsMap: Record<string, boolean>;
  conflictPeriodsMap: Record<string, boolean>;
  showDesiderata: boolean;
  hidePrimaryDesiderata?: boolean;
  hideSecondaryDesiderata?: boolean;
  user: any;
  users: User[];
  onToggleInterest: (exchange: ShiftExchange) => void;
  isInteractionDisabled: boolean;
  selectedDate?: string;
  onSelectDate: (date: string) => void;
  receivedShifts?: Record<string, any>;
  currentMonth: Date;
  calendarViewMode: 'month';
  filterPeriod?: 'all' | 'M' | 'AM' | 'S';
  bagPhaseConfig: { phase: 'submission' | 'distribution' | 'completed' };
}

/**
 * Composant d'affichage calendrier pour la bourse aux gardes
 * Affiche les gardes disponibles et les gardes de l'utilisateur dans une vue calendrier
 * 
 * @param days - Tableau des jours à afficher
 * @param isMobile - Indique si l'affichage est en mode mobile
 * @param filteredExchanges - Liste des échanges filtrés à afficher
 * @param userAssignments - Gardes assignées à l'utilisateur
 * @param conflictStates - État des conflits pour chaque échange
 * @param showDesiderata - Indique si les désidératas doivent être affichés
 * @param user - Utilisateur courant
 * @param users - Liste des utilisateurs
 * @param onToggleInterest - Fonction appelée lors du clic sur une garde pour manifester de l'intérêt
 * @param isInteractionDisabled - Indique si les interactions sont désactivées
 * @param selectedDate - Date sélectionnée
 * @param onSelectDate - Fonction appelée lors de la sélection d'une date
 * @param currentMonth - Mois courant affiché
 * @param bagPhaseConfig - Configuration de la phase de la bourse aux gardes
 */
const ShiftExchangeCalendarView: React.FC<ShiftExchangeCalendarViewProps> = ({
  days,
  isMobile,
  filteredExchanges,
  userAssignments,
  conflictStates,
  showDesiderata,
  hidePrimaryDesiderata = false,
  hideSecondaryDesiderata = false,
  user,
  users,
  onToggleInterest,
  isInteractionDisabled,
  selectedDate,
  onSelectDate,
  currentMonth,
  bagPhaseConfig,
  filterPeriod = 'all',
}) => {
  // État local pour gérer les propositions aux remplaçants
  const [proposingShift, setProposingShift] = useState<string | null>(null);
  
  // Fonction pour proposer une garde aux remplaçants
  const handleProposeToReplacements = async (exchange: ShiftExchange, e: React.MouseEvent) => {
    e.stopPropagation(); // Éviter de déclencher le handleSelectDate du parent
    
    try {
      setProposingShift(exchange.id);
      // TODO: Implémenter la proposition aux remplaçants
      // Pour l'instant, juste un placeholder
      console.log('Proposition aux remplaçants pour:', exchange);
      
      // Simuler un délai
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Fonctionnalité de proposition aux remplaçants à implémenter');
    } catch (error) {
      console.error('Erreur lors de la proposition aux remplaçants:', error);
      alert('Une erreur est survenue lors de la proposition aux remplaçants');
    } finally {
      setProposingShift(null);
    }
  };
  
  // Récupérer les données de désiderata pour l'utilisateur (incluant les archivés)
  const { selections, isLoading: isLoadingDesiderata } = useDesiderataState(true);
  
  // Debug - afficher les sélections au chargement du composant
  useEffect(() => {
    console.log("Désiderata chargées dans le calendrier:", { selections, isLoading: isLoadingDesiderata });
  }, [selections, isLoadingDesiderata]);
  
  // Créer un objet mappant les dates aux échanges pour un accès plus facile
  const exchangesByDate: Record<string, Record<string, ShiftExchange[]>> = {};
  
  // Utiliser directement les filteredExchanges qui sont déjà filtrés par useShiftExchangeData
  // Appliquer ici le filtrage des désidératas ET le filtrage par période
  const displayExchanges = filteredExchanges.filter(exchange => {
    // 1. Filtrage par période (M, AM, S)
    if (filterPeriod !== 'all' && exchange.period !== filterPeriod) {
      return false;
    }
    
    // 2. Vérifier si cette garde est sur un désidérata
    if (showDesiderata && !isLoadingDesiderata) {
      const desidKey = `${exchange.date}-${exchange.period}`;
      const desiderataType = selections[desidKey]?.type;
      
      // Masquer les gardes sur désidératas primaires si l'option est activée
      if (hidePrimaryDesiderata && desiderataType === 'primary') {
        return false;
      }
      
      // Masquer les gardes sur désidératas secondaires si l'option est activée
      if (hideSecondaryDesiderata && desiderataType === 'secondary') {
        return false;
      }
    }
    
    return true;
  });
  
  // Grouper les échanges par date et période
  displayExchanges.forEach(exchange => {
    const { date, period } = exchange;
    
    // Debug pour AVIT
    if (exchange.userId === 'naRhqjhzpWhcOMCZWCqftT8ArbH3') {
      console.log('[DEBUG AVIT Calendar] Exchange date:', date);
      debugTimezone(date, `[DEBUG AVIT Calendar] Date ${date}`);
      console.log('[DEBUG AVIT Calendar] Exchange data:', exchange);
    }
    
    if (!exchangesByDate[date]) {
      exchangesByDate[date] = { M: [], AM: [], S: [] };
    }
    exchangesByDate[date][period].push(exchange);
  });

  return (
    <div className="w-full calendar-view">
      {/* Entêtes des jours uniquement pour les écrans non-mobiles */}
      {!isMobile && (
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="text-center font-medium text-gray-600 py-2 text-sm">
              {day}
            </div>
          ))}
        </div>
      )}
      
      {/* Conteneur de grille avec nombre de colonnes adapté selon la taille de l'écran */}
      <div className={`grid ${
        isMobile 
          ? 'grid-cols-3 xs:grid-cols-4 gap-0.5' // 3 colonnes sur très petits écrans, 4 sur petits écrans
          : 'grid-cols-7 gap-1'                  // 7 colonnes sur écrans normaux
      }`}>
        {/* Les cellules vides sont supprimées car nous incluons maintenant les jours du mois précédent */}
        
        {/* Jours du mois actuel - rendu exact comme l'original */}
        {days.map(day => {
          try {
            const dateStr = formatParisDate(day, 'yyyy-MM-dd');
            const dayNum = day.getDate();
            
            // Vérifier si c'est un week-end ou un jour férié
            const isWeekend = isGrayedOut(day);
            
            // Vérifier si c'est aujourd'hui
            const isCurrentDay = isTodayFn(toParisTime(day));
            const isSelectedDay = selectedDate === dateStr;
            
            // Récupérer les gardes de l'utilisateur pour cette date
            const userShifts: Record<string, boolean> = {};
            ['M', 'AM', 'S'].forEach(period => {
              const key = `${dateStr}-${period}`;
              // Les assignments sont directement indexés par la clé date-période
              userShifts[period] = Boolean(userAssignments[key]);
            });
            
            // Récupérer les échanges disponibles pour cette date
            const dayExchanges = exchangesByDate[dateStr] || { M: [], AM: [], S: [] };
            
            return (
              <div 
                key={dateStr}
                className={`
                  relative overflow-visible
                  ${isMobile ? 'p-0.5 min-h-[52px]' : 'p-1.5 min-h-[100px]'}
                  rounded ${isMobile ? 'shadow-sm' : 'border'} transition-all duration-200
                  ${isCurrentDay ? 'border-indigo-400 border-2' : isMobile ? 'border-transparent' : 'border-gray-200'}
                  ${isWeekend ? 'bg-gray-100/80 shadow-inner' : 'bg-white'}
                  ${day.getMonth() !== currentMonth.getMonth() ? 'opacity-70 bg-gray-50/80' : ''}
                  ${isSelectedDay ? 'ring-2 ring-indigo-400 shadow-md' : ''}
                  hover:bg-gray-50/50 cursor-pointer
                `}
                style={{ position: 'relative', zIndex: 10 }}
                onClick={() => onSelectDate(dateStr)}
              >
                {/* En-tête de la cellule avec numéro du jour - diminué en importance */}
                <div className={`flex justify-between items-center relative z-10 ${isMobile ? 'mb-0' : 'mb-0.5'}`}>
                  {isWeekend && (
                    <span className="absolute top-0 left-0 w-full h-full border-t border-gray-100 rounded-t-md opacity-30 z-0"></span>
                  )}
                  
                  {isMobile ? (
                    <div className="flex items-center gap-0.5 px-1">
                      <span className="text-[8px] font-normal text-gray-500">
                        {dayNum}
                      </span>
                      <span className="text-[6px] text-gray-400">
                        {formatParisDate(day, 'EEE', { locale: frLocale }).substring(0, 3)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-1">
                      <span className="text-xs font-normal text-gray-500">
                        {dayNum}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatParisDate(day, 'EEE', { locale: frLocale })}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className={`${isMobile ? 'mt-1' : 'mt-0.5'} flex gap-[1px] justify-between px-0.5`}>
                  {/* Gardes par période - En colonnes - Toujours afficher les 3 colonnes même si vides */}
                  {['M', 'AM', 'S'].map(period => {
                    const hasUserShift = userShifts[period];
                    const dayPeriodExchanges = dayExchanges[period] || [];
                    const hasPeriodExchanges = dayPeriodExchanges.length > 0;
                    const key = `${dateStr}-${period}`;
                    
                    // Trouver l'échange de l'utilisateur pour cette période
                    const userExchange = dayPeriodExchanges.find(exchange => exchange.userId === user?.id);
                    
                    // Vérifier si un désidérata existe pour cette période
                    const desidKey = `${dateStr}-${period}`;
                    const desiderata = showDesiderata && !isLoadingDesiderata && bagPhaseConfig.phase !== 'completed' 
                      ? selections[desidKey]?.type 
                      : null;
                    
                    // Ajouter un log pour debug seulement si sélectionné
                    if (selectedDate === dateStr && desiderata) {
                      console.log(`Désiderata pour ${desidKey}:`, selections[desidKey], "type:", desiderata);
                    }
                    
                    return (
                      <div key={`period-${period}`} className={`flex flex-col ${isMobile ? 'gap-0.5 relative' : 'gap-0.5'} ${
                        period === 'M' ? 'items-start' : 
                        period === 'AM' ? 'items-center' : 'items-end'
                      }`}>
                        
                        <div className={`flex flex-col ${isMobile ? 'gap-0.5' : 'gap-0.5'} ${isMobile ? 'w-6' : 'w-8'} relative`}>
                          {/* Barre de désiderata spécifique à la période - maintenant à l'intérieur de la div de colonne */}
                          {desiderata && (
                            <div 
                              className={`absolute top-[-3px] left-0 right-0 desiderata-bar ${
                                desiderata === 'primary' ? 'desiderata-primary' : 
                                desiderata === 'secondary' ? 'desiderata-secondary' : ''
                              }`}
                              style={{ 
                                height: '3px', 
                                width: '100%', 
                                backgroundColor: desiderata === 'primary' ? 'rgba(239, 68, 68, 0.7)' : 'rgba(96, 165, 250, 0.7)',
                                borderRadius: '1px'
                              }}
                              title={desiderata === 'primary' 
                                ? `Désidérata primaire - ${period}` 
                                : desiderata === 'secondary' 
                                  ? `Désidérata secondaire - ${period}` 
                                  : ''}
                            />
                          )}
                          {/* Toujours réserver la première ligne pour la garde de l'utilisateur */}
                          {/* Garde de l'utilisateur - style ajusté pour plus de visibilité mais moins qu'un badge proposé */}
                          {hasUserShift ? (() => {
                            const assignment = userAssignments[key];
                            
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div 
                                  key={`my-${period}`} 
                                  className={`
                                    text-center mb-0.5
                                    ${isMobile 
                                      ? 'text-[9px] w-full px-0.5 py-0.5 font-semibold' 
                                      : 'text-[10px] w-full px-0.5 py-0.5 font-semibold'
                                    } 
                                    rounded-sm bg-gray-100/90 text-gray-800 border border-gray-300/50 border-dotted ring-1 ring-gray-200/30 shadow-sm opacity-90 font-semibold
                                  `}
                                  title="Ma garde"
                                >
                                  {assignment?.shiftType || period}
                                </div>
                                
                                {/* Bouton "Proposer aux remplaçants" pour les gardes de l'utilisateur en phase "completed" */}
                                {bagPhaseConfig.phase === 'completed' && userExchange && (
                                  <button
                                    onClick={(e) => handleProposeToReplacements(userExchange, e)}
                                    disabled={proposingShift === userExchange.id}
                                    className={`
                                      text-[7px] px-0.5 py-0.5 rounded-sm
                                      ${userExchange.proposedToReplacements 
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      }
                                      transition-colors flex items-center justify-center gap-0.5
                                      ${proposingShift === userExchange.id ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                  >
                                    <UserPlus className="h-2 w-2" />
                                    {proposingShift === userExchange.id 
                                      ? '...' 
                                      : userExchange.proposedToReplacements 
                                        ? 'Annuler' 
                                        : 'Remplaçant'
                                    }
                                  </button>
                                )}
                              </div>
                            );
                          })() : (
                            // Espace réservé vide quand l'utilisateur n'a pas de garde - hauteur réduite 
                            <div className="h-[18px] w-full mb-0.5"></div>
                          )}
                          
                          {/* Gardes disponibles - toujours en dessous de l'espace réservé à l'utilisateur */}
                          {hasPeriodExchanges && bagPhaseConfig.phase !== 'completed' && 
                            dayPeriodExchanges
                              .filter(exchange => exchange.userId !== user?.id)
                              .map(exchange => {
                                const isInterested = exchange.interestedUsers?.includes(user?.id || '');
                                const hasConflict = conflictStates[exchange.id];
                                
                                // Utiliser les classes CSS définies dans ShiftBadges.css
                                let badgeClass = '';
                                
                                if (period === 'M') {
                                  badgeClass = 'shift-badge-morning badge-morning';
                                } else if (period === 'AM') {
                                  badgeClass = 'shift-badge-afternoon badge-afternoon';
                                } else {
                                  badgeClass = 'shift-badge-evening badge-evening';
                                }
                                
                                // Indicateurs pour gardes intéressées - masqués en phase "Terminé"
                                let interestClass = '';
                                if (isInterested && bagPhaseConfig.phase !== 'completed') {
                                  if (hasConflict) {
                                    interestClass = 'shift-badge-conflict';
                                  } else {
                                    interestClass = 'shift-badge-interested';
                                  }
                                }
                                
                                return (
                                  <button
                                    key={exchange.id}
                                    onClick={(e) => {
                                      e.stopPropagation(); // Éviter de déclencher le handleSelectDate du parent
                                      if (!isInteractionDisabled) {
                                        onToggleInterest(exchange);
                                      }
                                    }}
                                    disabled={isInteractionDisabled}
                                    className={`
                                      relative truncate border transition-all font-bold touch-manipulation w-full
                                      ${isMobile
                                        ? 'text-[10px] h-[20px] px-0.5 py-0.5 font-bold' 
                                        : 'text-[12px] h-[22px] px-1 py-0.5 border-[0.5px]'
                                      }
                                      rounded-sm my-0.5 
                                      cursor-pointer hover:shadow-md active:translate-y-0.5
                                      ${badgeClass} ${interestClass} calendar-badge calendar-item
                                      ${isInteractionDisabled ? 'opacity-50' : ''}
                                      ${exchange.userId === user?.id 
                                        ? 'opacity-70 scale-95 border-dotted z-0 grayscale bg-gray-100/80 text-gray-900 border border-gray-300/40' 
                                        : 'shadow-sm z-10 border-[0.5px] border-opacity-30'
                                      }
                                      ${isInterested && isMobile ? 'scale-110 font-black' : ''}
                                      ${exchange.proposedToReplacements ? 'shift-badge-replacement' : ''}
                                    `}
                                    title={`${exchange.shiftType} - ${(() => {
                                      const exchangeUser = users.find(u => u.id === exchange.userId);
                                      return exchangeUser ? `${exchangeUser.lastName} ${exchangeUser.firstName}` : 'Utilisateur';
                                    })()}${hasConflict ? ' (Conflit potentiel)' : ''}`}
                                  >
                                    {exchange.shiftType}
                                  </button>
                                );
                              })
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          } catch (error) {
            console.error("Erreur lors du rendu d'une cellule de jour:", error);
            // Cellule de secours en cas d'erreur
            return (
              <div key={`error-${Math.random()}`} className={`${isMobile ? 'min-h-[50px]' : 'min-h-[100px]'} bg-red-50/20 border border-gray-200`}></div>
            );
          }
        })}
      </div>
    </div>
  );
};

export default ShiftExchangeCalendarView;
