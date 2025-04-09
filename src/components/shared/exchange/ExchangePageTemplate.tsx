import React, { useState } from 'react';
import Toast from '../../Toast';
import ShiftExchangeFilters from '../../../features/shiftExchange/components/ShiftExchangeFilters';
import ViewModeSwitcher from './ViewModeSwitcher';
import { LoadingState, EmptyState, ErrorState } from '../../../features/shiftExchange/components/ShiftExchangeStates';
import GroupedShiftExchangeList from '../../../features/shiftExchange/components/GroupedShiftExchangeList';
import PermanentPlanningPreview from '../../../features/planning/components/PermanentPlanningPreview';
import type { ShiftExchange, BagPhaseConfig, ShiftAssignment } from '../../../types/planning';
import type { User } from '../../../features/users/types';
import type { ShiftPeriod } from '../../../features/shiftExchange/types';

interface ExchangePageTemplateProps {
  title: string;
  description?: string;
  user: User | null;
  users: User[];
  exchanges: ShiftExchange[];
  filteredExchanges: ShiftExchange[];
  loading: boolean;
  error: string | null;
  userAssignments: Record<string, ShiftAssignment>;
  receivedShifts: Record<string, any>;
  conflictStates: Record<string, boolean>;
  conflictPeriodsMap: Record<string, boolean>;
  interestedPeriodsMap: Record<string, boolean>;
  bagPhaseConfig: BagPhaseConfig;
  isInteractionDisabled: boolean;
  onToggleInterest: (exchange: ShiftExchange) => Promise<void>;
  onRetry?: () => void;
  filterOptions: {
    showOwnShifts: boolean;
    setShowOwnShifts: (value: boolean) => void;
    showMyInterests: boolean;
    setShowMyInterests: (value: boolean) => void;
    showDesiderata: boolean;
    setShowDesiderata: (value: boolean) => void;
    hidePrimaryDesiderata: boolean;
    setHidePrimaryDesiderata: (value: boolean) => void;
    hideSecondaryDesiderata: boolean;
    setHideSecondaryDesiderata: (value: boolean) => void;
    filterPeriod: 'all' | ShiftPeriod;
    setFilterPeriod: (value: 'all' | ShiftPeriod) => void;
  };
  renderCustomHeader?: () => React.ReactNode;
  renderCustomContent?: () => React.ReactNode;
  renderCalendarView?: () => React.ReactNode;
  isMobile?: boolean;
  isSmallScreen?: boolean;
}

/**
 * Composant template pour les pages d'échange
 * Réduit la duplication entre ShiftExchangePage et DirectExchangePage
 */
const ExchangePageTemplate: React.FC<ExchangePageTemplateProps> = ({
  title,
  description,
  user,
  users,
  exchanges,
  filteredExchanges,
  loading,
  error,
  userAssignments,
  receivedShifts,
  conflictStates,
  conflictPeriodsMap,
  interestedPeriodsMap,
  bagPhaseConfig,
  isInteractionDisabled,
  onToggleInterest,
  onRetry,
  filterOptions,
  renderCustomHeader,
  renderCustomContent,
  renderCalendarView,
  isMobile = false,
  isSmallScreen = false
}) => {
  // États locaux
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Fonction pour sélectionner une date
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  // Affichage conditionnel
  if (loading) {
    return <LoadingState />;
  }
  
  if (error) {
    return (
      <ErrorState 
        message={error} 
        onRetry={onRetry || (() => {})}
        toastMessage={toast.message}
        toastVisible={toast.visible}
        toastType={toast.type}
        onCloseToast={() => setToast({ ...toast, visible: false })}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast({ ...toast, visible: false })}
      />

      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <h1 className="text-2xl font-bold text-indigo-900">{title}</h1>
          {renderCustomHeader && renderCustomHeader()}
        </div>
        
        <ViewModeSwitcher 
          viewMode={viewMode} 
          setViewMode={setViewMode}
          showText={!isSmallScreen}
        />
      </div>

      {description && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-700 text-sm">{description}</p>
        </div>
      )}
      
      <ShiftExchangeFilters
        filterPeriod={filterOptions.filterPeriod}
        setFilterPeriod={filterOptions.setFilterPeriod}
        showOwnShifts={filterOptions.showOwnShifts}
        setShowOwnShifts={filterOptions.setShowOwnShifts}
        showMyInterests={filterOptions.showMyInterests}
        setShowMyInterests={filterOptions.setShowMyInterests}
        showDesiderata={filterOptions.showDesiderata}
        setShowDesiderata={filterOptions.setShowDesiderata}
        hidePrimaryDesiderata={filterOptions.hidePrimaryDesiderata}
        setHidePrimaryDesiderata={filterOptions.setHidePrimaryDesiderata}
        hideSecondaryDesiderata={filterOptions.hideSecondaryDesiderata}
        setHideSecondaryDesiderata={filterOptions.setHideSecondaryDesiderata}
        isInteractionDisabled={isInteractionDisabled}
        bagPhaseConfig={bagPhaseConfig}
      />
      
      {renderCustomContent ? (
        renderCustomContent()
      ) : (
        <>
          {!user || loading ? (
            <LoadingState />
          ) : viewMode === 'list' ? (
            // Vue Liste optimisée pour mobile
            <div className="flex flex-row gap-1 sm:gap-3 md:gap-4 w-full max-w-full">
              {/* Liste des gardes à gauche */}
              <div className="w-3/5 sm:w-2/3 max-h-[calc(100vh-13rem)] overflow-y-auto overflow-x-hidden px-2" id="shift-exchange-container">
                {filteredExchanges.length === 0 ? (
                  <EmptyState />
                ) : (
                  <GroupedShiftExchangeList
                    exchanges={filteredExchanges}
                    user={user}
                    users={users}
                    userAssignments={userAssignments}
                    conflictStates={conflictStates}
                    receivedShifts={receivedShifts}
                    isInteractionDisabled={isInteractionDisabled}
                    bagPhaseConfig={bagPhaseConfig}
                    onToggleInterest={onToggleInterest}
                    onSelectDate={handleSelectDate}
                    selectedDate={selectedDate}
                    filterPeriod={filterOptions.filterPeriod}
                    showDesiderata={filterOptions.showDesiderata}
                    hidePrimaryDesiderata={filterOptions.hidePrimaryDesiderata}
                    hideSecondaryDesiderata={filterOptions.hideSecondaryDesiderata}
                  />
                )}
              </div>
              
              {/* Planning fixe à droite, avec style adapté pour mobile */}
              <div className="w-2/5 sm:w-1/3 sticky top-2 self-start">
                <PermanentPlanningPreview
                  assignments={userAssignments}
                  selectedDate={selectedDate}
                  showDesiderata={filterOptions.showDesiderata}
                  onToggleDesiderata={() => filterOptions.setShowDesiderata(!filterOptions.showDesiderata)}
                  className="max-h-[calc(100vh-6rem)]"
                  interestedPeriods={interestedPeriodsMap}
                  conflictPeriods={conflictPeriodsMap}
                  hidePrimaryDesiderata={filterOptions.hidePrimaryDesiderata}
                  hideSecondaryDesiderata={filterOptions.hideSecondaryDesiderata}
                />
              </div>
            </div>
          ) : (
            // Vue Calendrier
            renderCalendarView ? renderCalendarView() : (
              <div className="bg-white rounded-lg shadow-lg p-4">
                <p className="text-center text-gray-500">Vue calendrier non implémentée</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default ExchangePageTemplate;
