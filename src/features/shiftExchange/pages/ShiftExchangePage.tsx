import React, { useState, useCallback, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../../features/auth/hooks';
import { useUsers } from '../../../features/auth/hooks';
import { useBagPhase } from '../../../context/shiftExchange';
import { useShiftExchangeData } from '../hooks/useShiftExchangeData';
import { useShiftInteraction, useCalendarNavigation } from '../hooks';
import { ShiftPeriod } from '../types';
import { useBottomNavPadding } from '../../../hooks/useBottomNavPadding';

// Composants
import Toast from '../../../components/common/Toast';
import ConflictModal from '../../../components/modals/ConflictModal';
import CommentModalView from '../../../components/modals/CommentModalView';
import PlanningPreviewModal from '../../../components/modals/PlanningPreviewModal';
import ExchangePageTemplate from '../../../features/shared/exchange/components/ExchangePageTemplate';
import { 
  BagPhaseIndicator,
  PhaseInfoBanner,
  ShiftExchangeCalendarView
} from '../components';
import PermanentPlanningPreview from '../../../features/planning/components/PermanentPlanningPreview';

/**
 * Version refactorisée de ShiftExchangePage utilisant les hooks composables
 * et les composants partagés pour réduire la duplication et la complexité
 */
const ShiftExchangePage: React.FC = () => {
  // Hooks d'authentification et contexte
  const { user } = useAuth();
  const { users } = useUsers();
  const bottomNavPadding = useBottomNavPadding();
  const { config: bagPhaseConfig } = useBagPhase();

  // États pour les modals
  const [showCommentModal, setShowCommentModal] = useState<{ id: string; comment: string } | null>(null);
  const [showPlanningPreview, setShowPlanningPreview] = useState<{
    date: string;
    position: { x: number; y: number };
  } | null>(null);
  
  // État pour le toast local
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });
  
  // État pour la date sélectionnée
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  
  // Fonction pour sélectionner une date
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  // États de filtrage et d'affichage - valeurs par défaut qui seront remplacées par celles du hook
  const [filterOptions, setFilterOptions] = useState({
    showOwnShifts: true,
    showMyInterests: false,
    showDesiderata: true,
    hidePrimaryDesiderata: false,
    hideSecondaryDesiderata: false,
    filterPeriod: 'all' as 'all' | ShiftPeriod
  });
  
  const [, setConflictDetails] = useState<Record<string, any>>({});

  // Référence pour stocker la date initiale
  const initialDateRef = useRef<Date | null>(null);

  // Hook pour la navigation du calendrier - déplacé avant useComposableExchangeData
  const {
    currentMonth,
    setCurrentMonth,
    calendarViewMode,
    setCalendarViewMode,
    isMobile,
    isSmallScreen,
    calendarContainerRef,
    goToPrevious,
    goToNext,
    getDaysToDisplay,
    initializeCalendarFromDateString
  } = useCalendarNavigation('list');

  // Référence pour suivre si l'initialisation a déjà été effectuée
  const isInitializedRef = useRef(false);

  // Hook pour les données des échanges - utilise notre nouveau hook composable
  const { 
    exchanges,
    filteredExchanges, 
    loading, 
    userAssignments, 
    receivedShifts,
    conflictStates,
    showOwnShifts,
    setShowOwnShifts,
    showMyInterests,
    setShowMyInterests,
    viewMode,
    setViewMode
  } = useShiftExchangeData();
  
  // Synchroniser les états locaux avec ceux du hook après le chargement initial
  useEffect(() => {
    setFilterOptions(prev => ({
      ...prev,
      showOwnShifts,
      showMyInterests
    }));
  }, [showOwnShifts, showMyInterests]);

  // Créer les maps pour les conflits et les intérêts
  const conflictPeriodsMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    if (user && exchanges) {
      exchanges.forEach(exchange => {
        const key = `${exchange.date}-${exchange.period}`;
        map[key] = conflictStates[exchange.id] || false;
      });
    }
    return map;
  }, [exchanges, conflictStates, user]);
  
  const interestedPeriodsMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    if (user && exchanges) {
      exchanges.forEach(exchange => {
        const key = `${exchange.date}-${exchange.period}`;
        map[key] = exchange.interestedUsers?.includes(user.id) || false;
      });
    }
    return map;
  }, [exchanges, user]);
  
  // Effet pour initialiser le calendrier une fois que les données sont chargées
  useEffect(() => {
    // Vérifier si nous avons des échanges et si l'initialisation n'a pas encore été effectuée
    if (exchanges.length > 0 && !isInitializedRef.current) {
      // Trouver la première date d'échange
      const sortedExchanges = [...exchanges].sort((a, b) => a.date.localeCompare(b.date));
      if (sortedExchanges.length > 0) {
        const firstExchangeDate = parseISO(sortedExchanges[0].date);
        console.log("Initialisation du calendrier à la première date d'échange:", firstExchangeDate);
        
        // Utiliser la fonction d'initialisation du hook de navigation
        initializeCalendarFromDateString(format(firstExchangeDate, 'yyyy-MM-dd'));
        
        // Marquer comme initialisé pour éviter les rendus en boucle
        isInitializedRef.current = true;
      }
    }
  }, [exchanges, initializeCalendarFromDateString]);

  // Hook pour la gestion des interactions (toggle interest)
  const {
    handleToggleInterest,
    showConflictModal,
    conflictExchange,
    exchangeUser,
    handleCloseConflictModal,
    handleConfirmConflict
  } = useShiftInteraction(users, conflictStates, setConflictDetails, setToast, {
    bagPhaseConfig
  });

  // Vérifier si les interactions doivent être désactivées
  const isInteractionDisabled = bagPhaseConfig.phase !== 'submission';
  
  // Chaîne de description pour aider l'utilisateur à comprendre les conflits
  const conflictHelpText = "Cela signifie que vous avez déjà une garde. Vous pouvez quand même vous positionner, un échange sera proposé sous validation de l'administrateur.";

  // Fonction pour mettre à jour les options de filtrage
  // Fonction unifiée pour mettre à jour les options de filtrage
  const updateFilterOption = <K extends keyof typeof filterOptions>(
    key: K,
    value: typeof filterOptions[K]
  ) => {
    // Utiliser à la fois les états locaux et ceux du hook
    setFilterOptions(prev => ({ ...prev, [key]: value }));
    
    // Synchroniser les états du hook si applicable
    if (key === 'showOwnShifts') {
      setShowOwnShifts(value as boolean);
    } else if (key === 'showMyInterests') {
      setShowMyInterests(value as boolean);
    }
  };

  // Rendu du composant d'en-tête personnalisé
  const renderCustomHeader = useCallback(() => {
    return (
      <div className="ml-0 sm:ml-3">
        <BagPhaseIndicator />
      </div>
    );
  }, []);

  // Rendu de la vue calendrier
  const renderCalendarView = useCallback(() => {
    if (!user) return null;
    
    return (
      <div className="w-full">
        {/* Vue calendrier principale */}
        <div 
          ref={calendarContainerRef}
          className="w-full bg-white rounded-lg shadow-lg overflow-hidden"
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="p-4">
            {/* Contrôles du calendrier */}
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center justify-center gap-3 mb-1">
                <button
                  onClick={goToPrevious}
                  className="p-1.5 rounded-md border border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  aria-label="Mois précédent"
                >
                  &larr;
                </button>
                
                <span className="text-base font-medium text-gray-800 min-w-[120px] text-center">
                  {new Intl.DateTimeFormat('fr-FR', {
                    month: 'long',
                    year: 'numeric'
                  }).format(currentMonth).replace(/^./, str => str.toUpperCase())}
                </span>
                
                <button
                  onClick={goToNext}
                  className="p-1.5 rounded-md border border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  aria-label="Mois suivant"
                >
                  &rarr;
                </button>
              </div>
              
              {/* Message pour le swipe sur mobile */}
              {isMobile && (
                <p className="text-[9px] text-gray-400 italic">
                  Glissez horizontalement pour naviguer entre les mois
                </p>
              )}
            </div>

            {/* Vue calendrier */}
            <ShiftExchangeCalendarView 
              days={getDaysToDisplay()}
              isMobile={isMobile}
              filteredExchanges={filteredExchanges}
              userAssignments={userAssignments}
              conflictStates={conflictStates}
              interestedPeriodsMap={interestedPeriodsMap}
              conflictPeriodsMap={conflictPeriodsMap}
              showDesiderata={filterOptions.showDesiderata}
              hidePrimaryDesiderata={filterOptions.hidePrimaryDesiderata}
              filterPeriod={filterOptions.filterPeriod}
              hideSecondaryDesiderata={filterOptions.hideSecondaryDesiderata}
              user={user}
              users={users}
              onToggleInterest={(exchange) => handleToggleInterest(exchange as unknown as import('../types').ShiftExchange)}
              isInteractionDisabled={isInteractionDisabled}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              receivedShifts={receivedShifts}
              currentMonth={currentMonth}
              calendarViewMode={calendarViewMode}
              bagPhaseConfig={bagPhaseConfig}
            />
            
            {/* Légende minimaliste */}
            <div className="mt-2 border-t border-gray-200 pt-1 flex flex-wrap items-center justify-between text-[9px] text-gray-500">
              <div className="flex gap-2">
                <span className="flex items-center"><span className="inline-block h-2 w-2 bg-[#E6F0FA] border border-[#7CB9E8] rounded-full mr-1"></span>M</span>
                <span className="flex items-center"><span className="inline-block h-2 w-2 bg-[#EEF2FF] border border-[#6366F1] rounded-full mr-1"></span>AM</span>
                <span className="flex items-center"><span className="inline-block h-2 w-2 bg-[#F3E8FF] border border-[#A855F7] rounded-full mr-1"></span>S</span>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center"><span className="inline-block h-2 w-2 opacity-70 bg-blue-50/60 border border-dotted border-blue-200/60 rounded-full mr-1"></span>Mes gardes</span>
                <span className="flex items-center"><span className="inline-block h-2 w-2 bg-green-500 rounded-full mr-1"></span>Intéressé</span>
                <span className="flex items-center"><span className="inline-block h-2 w-2 bg-red-500 rounded-full mr-1"></span>Conflit</span>
                {filterOptions.showDesiderata && (
                  <>
                    <span className="flex items-center"><span className="inline-block h-2 w-2 bg-red-300/70 mr-1"></span>Désid. 1</span>
                    <span className="flex items-center"><span className="inline-block h-2 w-2 bg-blue-300/70 mr-1"></span>Désid. 2</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    user, calendarContainerRef, currentMonth, goToPrevious, goToNext, 
    calendarViewMode, setCalendarViewMode, getDaysToDisplay, 
    filteredExchanges, userAssignments, conflictStates, 
    interestedPeriodsMap, conflictPeriodsMap, filterOptions.showDesiderata,
    users, handleToggleInterest, isInteractionDisabled, 
    receivedShifts, bagPhaseConfig, isMobile
  ]);

  return (
    <>
      {/* Utilisation du template de page d'échange */}
      <ExchangePageTemplate
        title="Bourse aux Gardes"
        user={user}
        users={users}
        exchanges={exchanges as unknown as import('../../../types/planning').ShiftExchange[]}
        filteredExchanges={filteredExchanges as unknown as import('../../../types/planning').ShiftExchange[]}
        loading={loading}
        error={null}
        userAssignments={userAssignments}
        receivedShifts={receivedShifts}
        conflictStates={conflictStates}
        conflictPeriodsMap={conflictPeriodsMap}
        interestedPeriodsMap={interestedPeriodsMap}
        bagPhaseConfig={bagPhaseConfig}
        isInteractionDisabled={isInteractionDisabled}
        onToggleInterest={(exchange) => handleToggleInterest(exchange as unknown as import('../types').ShiftExchange)}
        className={bottomNavPadding}
        filterOptions={{
          showOwnShifts: filterOptions.showOwnShifts,
          setShowOwnShifts: (value) => updateFilterOption('showOwnShifts', value),
          showMyInterests: filterOptions.showMyInterests,
          setShowMyInterests: (value) => updateFilterOption('showMyInterests', value),
          showDesiderata: filterOptions.showDesiderata,
          setShowDesiderata: (value) => updateFilterOption('showDesiderata', value),
          hidePrimaryDesiderata: filterOptions.hidePrimaryDesiderata,
          setHidePrimaryDesiderata: (value) => updateFilterOption('hidePrimaryDesiderata', value),
          hideSecondaryDesiderata: filterOptions.hideSecondaryDesiderata,
          setHideSecondaryDesiderata: (value) => updateFilterOption('hideSecondaryDesiderata', value),
          filterPeriod: filterOptions.filterPeriod,
          setFilterPeriod: (value) => updateFilterOption('filterPeriod', value),
        }}
        renderCustomHeader={renderCustomHeader}
        renderCalendarView={renderCalendarView}
        isMobile={isMobile}
        isSmallScreen={isSmallScreen}
        isCalendarView={viewMode === 'calendar'}
      />
      
      {/* Modals */}
      <ConflictModal
        isOpen={showConflictModal}
        onClose={handleCloseConflictModal}
        onConfirm={handleConfirmConflict}
        exchange={conflictExchange as unknown as import('../../../types/planning').ShiftExchange}
        exchangeUser={exchangeUser}
        helpText={conflictHelpText}
      />

      {/* Modal pour afficher les commentaires sur mobile */}
      <CommentModalView
        isOpen={!!showCommentModal}
        onClose={() => setShowCommentModal(null)}
        comment={showCommentModal?.comment || ''}
      />

      {/* Modal pour afficher l'aperçu du planning */}
      <PlanningPreviewModal
        isOpen={!!showPlanningPreview}
        onClose={() => setShowPlanningPreview(null)}
        date={showPlanningPreview?.date || ''}
        assignments={userAssignments}
        position={showPlanningPreview?.position || { x: 0, y: 0 }}
      />
    </>
  );
};

export default ShiftExchangePage;
