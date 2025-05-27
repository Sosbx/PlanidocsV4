import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { AlertTriangle } from 'lucide-react';
import DesiderataControls from './DesiderataControls';
import Toast from './Toast';
import DesktopTable from '../features/planning/components/DesktopTable';
import MobileTable from '../features/planning/components/MobileTable';
import { useSelections } from '../hooks/useSelections';
import { useAuth } from '../features/auth/hooks';
import { usePlanningConfig } from '../context/planning/PlanningContext';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import LoadingSpinner from './common/LoadingSpinner';
import { useAssociation } from '../context/association/AssociationContext';

interface PlanningTableProps {
  startDate: Date;
  endDate: Date;
  primaryLimit: number;
  secondaryLimit: number;
  isDeadlineExpired?: boolean;
  onResetComplete?: () => void;
  viewMode?: 'multiColumn' | 'singleColumn';
}

export interface PlanningTableRef {
  saveSelections: () => Promise<void>;
  activeDesiderata: 'primary' | 'secondary' | null;
  setActiveDesiderata: (type: 'primary' | 'secondary' | null) => void;
  primaryPercentage: number;
  secondaryPercentage: number;
  isSaving: boolean;
}

const PlanningTable = forwardRef<PlanningTableRef, PlanningTableProps>(({
  startDate,
  endDate,
  primaryLimit,
  secondaryLimit,
  isDeadlineExpired = false,
  onResetComplete,
  viewMode = 'multiColumn'
}, ref) => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'error' | 'success' });
  const [activeModal, setActiveModal] = useState<{
    cellKey: string;
    position: { x: number; y: number };
  } | null>(null);
  const { user } = useAuth();
  const { config } = usePlanningConfig();
  const { currentAssociation } = useAssociation();

  const handleLimitExceeded = useCallback((message: string) => {
    setToast({ visible: true, message, type: 'error' });
  }, []);

  const handleNoDesiderataSelected = useCallback(() => {
    setToast({
      visible: true,
      message: 'Veuillez sélectionner un type de desiderata (Primaire ou Secondaire) avant de cliquer sur le planning',
      type: 'error'
    });
  }, []);

  const selectionsConfig = useMemo(() => ({
    startDate,
    endDate,
    primaryLimit,
    secondaryLimit,
    onLimitExceeded: handleLimitExceeded,
    onNoDesiderataSelected: handleNoDesiderataSelected
  }), [startDate, endDate, primaryLimit, secondaryLimit, handleLimitExceeded, handleNoDesiderataSelected]);

  const {
    activeDesiderata,
    setActiveDesiderata,
    selections,
    primaryPercentage,
    secondaryPercentage,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleComment,
    resetSelections,
    saveSelections,
    isLoading,
    hasUnsavedChanges,
    isSaving
  } = useSelections(selectionsConfig);

  useUnsavedChanges(hasUnsavedChanges);

  useImperativeHandle(ref, () => ({
    saveSelections,
    activeDesiderata,
    setActiveDesiderata,
    primaryPercentage,
    secondaryPercentage,
    isSaving
  }), [saveSelections, activeDesiderata, setActiveDesiderata, primaryPercentage, secondaryPercentage, isSaving]);

  const handleOpenModal = useCallback((cellKey: string, position: { x: number; y: number }) => {
    setActiveModal({ cellKey, position });
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleReset = useCallback(async () => {
    await resetSelections();
    if (onResetComplete) {
      onResetComplete();
    }
  }, [resetSelections, onResetComplete]);

  const isDateBlocked = useCallback((date: Date) => {
    if (!user || !config.holidayBlocks?.[user.id]) return false;
    
    const userBlocks = config.holidayBlocks[user.id];
    const dayMonth = `${date.getDate()}-${date.getMonth() + 1}`;
    
    // Vérifier Noël (24 et 25 décembre)
    if (userBlocks.blockChristmas && (dayMonth === '24-12' || dayMonth === '25-12')) {
      return true;
    }
    
    // Vérifier Nouvel An (31 décembre)
    if (userBlocks.blockNewYear && dayMonth === '31-12') {
      return true;
    }
    
    return false;
  }, [user, config]);

  // Vérifier si l'utilisateur a des blocages
  const userHasBlocks = useMemo(() => {
    if (!user || !config.holidayBlocks?.[user.id]) return { hasBlocks: false, blockChristmas: false, blockNewYear: false };
    
    const userBlocks = config.holidayBlocks[user.id];
    return {
      hasBlocks: userBlocks.blockChristmas || userBlocks.blockNewYear,
      blockChristmas: userBlocks.blockChristmas,
      blockNewYear: userBlocks.blockNewYear
    };
  }, [user, config]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {userHasBlocks.hasBlocks && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {currentAssociation === 'RD' 
                  ? 'Conformément à la décision en AGE de juin 2022 :' 
                  : 'Restriction des desidérata pour les fêtes'}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  En fonction de votre historique des années précédentes, vous ne pouvez pas mettre en désidérata :
                </p>
                <ul className="list-disc list-inside mt-1">
                  {userHasBlocks.blockChristmas && (
                    <li>Noël (24 et 25 décembre)</li>
                  )}
                  {userHasBlocks.blockNewYear && (
                    <li>Nouvel An (31 décembre)</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <DesiderataControls
        activeDesiderata={activeDesiderata}
        setActiveDesiderata={setActiveDesiderata}
        primaryPercentage={primaryPercentage}
        secondaryPercentage={secondaryPercentage}
        primaryLimit={primaryLimit}
        secondaryLimit={secondaryLimit}
        isDeadlineExpired={isDeadlineExpired}
        isSaving={isSaving}
        onReset={handleReset}
        startDate={startDate}
        endDate={endDate}
      />

      {viewMode === 'multiColumn' ? (
        <div>
          <DesktopTable
            startDate={startDate}
            endDate={endDate}
            selections={selections}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            onComment={handleComment}
            onOpenModal={handleOpenModal}
            activeModal={activeModal}
            onCloseModal={handleCloseModal}
            isDateBlocked={isDateBlocked}
          />
        </div>
      ) : (
        <div>
          <MobileTable
            startDate={startDate}
            endDate={endDate}
            selections={selections}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            onComment={handleComment}
            onOpenModal={handleOpenModal}
            activeModal={activeModal}
            onCloseModal={handleCloseModal}
            isDateBlocked={isDateBlocked}
          />
        </div>
      )}
    </div>
  );
});

PlanningTable.displayName = 'PlanningTable';

export default React.memo(PlanningTable);
