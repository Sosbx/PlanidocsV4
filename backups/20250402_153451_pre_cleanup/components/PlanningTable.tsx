import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import DesiderataControls from './DesiderataControls';
import Toast from './Toast';
import DesktopTable from '../features/planning/components/DesktopTable';
import MobileTable from '../features/planning/components/MobileTable';
import { useSelections } from '../hooks/useSelections';
import { useAuth } from '../features/auth/hooks';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import type { Selections } from '../types/planning';
import LoadingSpinner from './common/LoadingSpinner';

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
    saveSelections
  }), [saveSelections]);

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
          />
        </div>
      )}
    </div>
  );
});

PlanningTable.displayName = 'PlanningTable';

export default React.memo(PlanningTable);
