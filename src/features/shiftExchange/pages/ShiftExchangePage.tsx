import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useShiftExchangeCore, useCalendarNavigation } from '../hooks';
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
 * Page de bourse aux gardes - Version optimisée
 * Utilise le hook centralisé useShiftExchangeCore pour éviter les redondances
 */
const ShiftExchangePage: React.FC = () => {
  // Hook principal optimisé
  const {
    user,
    users,
    bagPhaseConfig,
    exchanges,
    filteredExchanges,
    loading,
    userAssignments,
    receivedShifts,
    conflictStates,
    conflictDetails,
    isInteractionDisabled,
    showOwnShifts,
    setShowOwnShifts,
    showMyInterests,
    setShowMyInterests,
    viewMode,
    setViewMode,
    toggleInterest,
    checkForConflict
  } = useShiftExchangeCore({
    enableHistory: false, // Pas besoin de l'historique pour la page utilisateur
    enableConflictCheck: true,
    limitResults: 0 // Pas de limite pour voir toutes les gardes disponibles
  });
  
  const bottomNavPadding = useBottomNavPadding();

  // États locaux pour les modals uniquement
  const [showCommentModal, setShowCommentModal] = useState<{ id: string; comment: string } | null>(null);
  const [showPlanningPreview, setShowPlanningPreview] = useState<{
    date: string;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  
  // État local pour le toast
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });
  
  // États locaux pour la gestion des conflits
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictExchange, setConflictExchange] = useState<any>(null);
  const [exchangeUser, setExchangeUser] = useState<any>(null);
  
  // État pour les options de filtrage (reste local car spécifique à cette vue)
  const [filterOptions, setFilterOptions] = useState({
    showOwnShifts: true,
    showMyInterests: false,
    showDesiderata: true,
    hidePrimaryDesiderata: false,
    hideSecondaryDesiderata: false,
    filterPeriod: 'all' as 'all' | ShiftPeriod
  });

  // Hook pour la navigation du calendrier
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

  // Références pour optimisation
  const isInitializedRef = useRef(false);
  
  // Synchroniser les états de filtrage avec le hook principal
  useEffect(() => {
    setFilterOptions(prev => ({
      ...prev,
      showOwnShifts,
      showMyInterests
    }));
  }, [showOwnShifts, showMyInterests]);
  
  // Calcul optimisé des maps avec useMemo
  const conflictPeriodsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (user && exchanges) {
      exchanges.forEach(exchange => {
        const key = `${exchange.date}-${exchange.period}`;
        map[key] = conflictStates[exchange.id] || false;
      });
    }
    return map;
  }, [exchanges, conflictStates, user]);
  
  const interestedPeriodsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (user && exchanges) {
      exchanges.forEach(exchange => {
        const key = `${exchange.date}-${exchange.period}`;
        map[key] = exchange.interestedUsers?.includes(user.id) || false;
      });
    }
    return map;
  }, [exchanges, user]);
  
  // Initialisation du calendrier une seule fois
  useEffect(() => {
    if (exchanges.length > 0 && !isInitializedRef.current) {
      const sortedExchanges = [...exchanges].sort((a, b) => a.date.localeCompare(b.date));
      if (sortedExchanges.length > 0) {
        const firstExchangeDate = parseISO(sortedExchanges[0].date);
        initializeCalendarFromDateString(format(firstExchangeDate, 'yyyy-MM-dd'));
        isInitializedRef.current = true;
      }
    }
  }, [exchanges, initializeCalendarFromDateString]);
  
  // Gestion optimisée de l'intérêt avec vérification de conflit
  const handleToggleInterest = useCallback(async (exchange: any) => {
    if (!user || isInteractionDisabled) {
      setToast({
        visible: true,
        message: isInteractionDisabled 
          ? 'La période de soumission est terminée' 
          : 'Vous devez être connecté',
        type: 'error'
      });
      return;
    }
    
    try {
      // Vérifier s'il y a un conflit
      const conflict = await checkForConflict(exchange);
      
      if (conflict.hasConflict) {
        // Montrer le modal de confirmation
        setConflictExchange(exchange);
        const exchangeUserData = users.find(u => u.id === exchange.userId);
        setExchangeUser(exchangeUserData);
        setShowConflictModal(true);
      } else {
        // Pas de conflit, procéder directement
        await toggleInterest(exchange);
        setToast({
          visible: true,
          message: exchange.interestedUsers?.includes(user.id) 
            ? 'Intérêt retiré' 
            : 'Intérêt manifesté',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error toggling interest:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'opération',
        type: 'error'
      });
    }
  }, [user, users, isInteractionDisabled, checkForConflict, toggleInterest]);
  
  // Confirmation du conflit
  const handleConfirmConflict = useCallback(async () => {
    if (!conflictExchange) return;
    
    try {
      await toggleInterest(conflictExchange);
      setToast({
        visible: true,
        message: 'Intérêt manifesté avec conflit potentiel',
        type: 'info'
      });
    } catch (error) {
      console.error('Error confirming conflict:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'opération',
        type: 'error'
      });
    } finally {
      setShowConflictModal(false);
      setConflictExchange(null);
      setExchangeUser(null);
    }
  }, [conflictExchange, toggleInterest]);
  
  // Fonction pour mettre à jour les options de filtrage
  const updateFilterOption = useCallback(<K extends keyof typeof filterOptions>(
    key: K,
    value: typeof filterOptions[K]
  ) => {
    setFilterOptions(prev => ({ ...prev, [key]: value }));
    
    // Synchroniser avec le hook principal si nécessaire
    if (key === 'showOwnShifts') {
      setShowOwnShifts(value as boolean);
    } else if (key === 'showMyInterests') {
      setShowMyInterests(value as boolean);
    }
  }, [setShowOwnShifts, setShowMyInterests]);
  
  // Rendu du composant d'en-tête personnalisé
  const renderCustomHeader = useCallback(() => (
    <div className="ml-0 sm:ml-3">
      <BagPhaseIndicator />
    </div>
  ), []);
  
  // Rendu optimisé de la vue calendrier
  const renderCalendarView = useCallback(() => {
    if (!user) return null;
    
    return (
      <div className="w-full">
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
              onToggleInterest={handleToggleInterest}
              isInteractionDisabled={isInteractionDisabled}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
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
    getDaysToDisplay, filteredExchanges, userAssignments, conflictStates,
    interestedPeriodsMap, conflictPeriodsMap, filterOptions, users,
    handleToggleInterest, isInteractionDisabled, selectedDate, receivedShifts,
    bagPhaseConfig, isMobile, calendarViewMode
  ]);
  
  // Toast pour les messages
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  return (
    <>
      {/* Toast pour les notifications */}
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />
      
      {/* Template de page principal */}
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
        onToggleInterest={handleToggleInterest}
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
        onClose={() => {
          setShowConflictModal(false);
          setConflictExchange(null);
          setExchangeUser(null);
        }}
        onConfirm={handleConfirmConflict}
        exchange={conflictExchange}
        exchangeUser={exchangeUser}
        helpText="Cela signifie que vous avez déjà une garde. Vous pouvez quand même vous positionner, un échange sera proposé sous validation de l'administrateur."
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