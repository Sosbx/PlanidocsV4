import { useState, useCallback, useEffect, useMemo } from 'react';
import { calculatePercentages, wouldExceedLimit } from '../utils/planningUtils';
import { useDesiderataState } from './useDesiderataState';
import { useDesiderata } from './useDesiderata';
import type { Selections, PeriodSelection } from '../types/planning';

interface UseSelectionsProps {
  startDate: Date;
  endDate: Date;
  primaryLimit: number;
  secondaryLimit: number;
  onLimitExceeded: (message: string) => void;
  onNoDesiderataSelected: () => void;
}

export const useSelections = ({
  startDate,
  endDate,
  primaryLimit,
  secondaryLimit,
  onLimitExceeded,
  onNoDesiderataSelected
}: UseSelectionsProps) => {
  const { selections: savedSelections, isLoading } = useDesiderataState();
  const { saveDesiderata, isSaving } = useDesiderata();
  const [activeDesiderata, setActiveDesiderata] = useState<'primary' | 'secondary' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localSelections, setLocalSelections] = useState<Selections>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dragAction, setDragAction] = useState<'select' | 'deselect'>('select');

  useEffect(() => {
    if (!isLoading) {
      setLocalSelections(savedSelections);
    }
  }, [savedSelections, isLoading]);

  const percentages = useMemo(() => 
    calculatePercentages(localSelections, startDate, endDate),
    [localSelections, startDate, endDate]
  );

  const updateSelection = useCallback((dateKey: string, action: 'select' | 'deselect') => {
    if (!activeDesiderata) {
      onNoDesiderataSelected();
      return;
    }

    setLocalSelections(prev => {
      const newSelections = { ...prev };
      const currentSelection = prev[dateKey]?.type;
      
      if (action === 'select') {
        newSelections[dateKey] = { 
          ...prev[dateKey],
          type: activeDesiderata 
        };
        
        const limit = activeDesiderata === 'primary' ? primaryLimit : secondaryLimit;
        if (wouldExceedLimit(newSelections, startDate, endDate, activeDesiderata, limit)) {
          onLimitExceeded(`Limite de ${limit}% atteinte`);
          return prev;
        }
      } else {
        if (currentSelection !== activeDesiderata) return prev;
        delete newSelections[dateKey];
      }

      setHasUnsavedChanges(true);
      return newSelections;
    });
  }, [activeDesiderata, startDate, endDate, primaryLimit, secondaryLimit, onLimitExceeded]);

  const handleComment = useCallback((dateKey: string, comment: string) => {
    setLocalSelections(prev => {
      const newSelections = { ...prev };
      if (!newSelections[dateKey]) {
        newSelections[dateKey] = { type: null };
      }
      newSelections[dateKey] = {
        ...newSelections[dateKey],
        comment: comment || undefined
      };
      return newSelections;
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleCellMouseDown = useCallback((dateKey: string) => {
    if (!activeDesiderata) {
      onNoDesiderataSelected();
      return;
    }
    setIsDragging(true);

    const currentType = localSelections[dateKey]?.type;
    if (currentType === activeDesiderata) {
      setDragAction('deselect');
    } else {
      setDragAction('select');
    }
    updateSelection(dateKey, currentType === activeDesiderata ? 'deselect' : 'select');
  }, [activeDesiderata, localSelections, updateSelection]);

  const handleCellMouseEnter = useCallback((dateKey: string) => {
    if (!isDragging || !activeDesiderata) return;
    updateSelection(dateKey, dragAction);
  }, [isDragging, activeDesiderata, dragAction, updateSelection]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragAction('select');
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const resetSelections = useCallback(async () => {
    setLocalSelections({});
    setActiveDesiderata(null);
    setHasUnsavedChanges(false);
    await saveDesiderata({});
  }, [saveDesiderata]);

  const saveSelections = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    await saveDesiderata(localSelections);
    setHasUnsavedChanges(false);
  }, [saveDesiderata, localSelections, hasUnsavedChanges]);

  return {
    activeDesiderata,
    setActiveDesiderata,
    selections: localSelections,
    primaryPercentage: percentages.primary,
    secondaryPercentage: percentages.secondary,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleComment,
    resetSelections,
    saveSelections,
    isLoading,
    hasUnsavedChanges,
    isSaving
  };
};