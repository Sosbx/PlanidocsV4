import { useState, useCallback, useEffect, useMemo } from 'react';
import { calculatePercentages, wouldExceedLimit } from '../utils/planningUtils';
import { useDesiderataState } from '../features/planning/hooks/useDesiderataState';
import { useDesiderata } from '../features/planning/hooks/useDesiderata';
import { usePlanningConfig } from '../context/planning/PlanningContext';
import { useAuth } from '../features/auth/hooks';
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
  const { config } = usePlanningConfig();
  const { user } = useAuth();
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
        // Vérifier si l'utilisateur est bloqué pour cette date
        if (user && config.holidayBlocks?.[user.id]) {
          const userBlocks = config.holidayBlocks[user.id];
          const dateObj = new Date(dateKey);
          const dayMonth = `${dateObj.getDate()}-${dateObj.getMonth() + 1}`;
          
          // Vérifier Noël (24 et 25 décembre)
          if (userBlocks.blockChristmas && (dayMonth === '24-12' || dayMonth === '25-12')) {
            onLimitExceeded('Vous ne pouvez pas sélectionner les jours de Noël');
            return prev;
          }
          
          // Vérifier Nouvel An (31 décembre)
          if (userBlocks.blockNewYear && dayMonth === '31-12') {
            onLimitExceeded('Vous ne pouvez pas sélectionner le jour de Nouvel An');
            return prev;
          }
        }
        
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
  }, [activeDesiderata, startDate, endDate, primaryLimit, secondaryLimit, onLimitExceeded, user, config]);

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

  // Nouvelle fonction pour sélectionner tous les créneaux d'un jour
  const handleDateClick = useCallback((date: string) => {
    if (!activeDesiderata) {
      onNoDesiderataSelected();
      return;
    }

    // Créer les clés pour M, AM et S
    const periods = ['M', 'AM', 'S'];
    const dateKeys = periods.map(period => `${date}-${period}`);
    
    setLocalSelections(prev => {
      const newSelections = { ...prev };
      
      // Vérifier si tous les créneaux sont déjà sélectionnés avec le même type
      const allSelected = dateKeys.every(key => 
        prev[key]?.type === activeDesiderata
      );
      
      if (allSelected) {
        // Si tous sont sélectionnés, on les désélectionne
        dateKeys.forEach(key => {
          delete newSelections[key];
        });
      } else {
        // Sinon, on sélectionne tous les créneaux
        // D'abord, vérifier si on ne dépasse pas la limite
        const tempSelections = { ...newSelections };
        dateKeys.forEach(key => {
          tempSelections[key] = { 
            ...tempSelections[key],
            type: activeDesiderata 
          };
        });
        
        const limit = activeDesiderata === 'primary' ? primaryLimit : secondaryLimit;
        if (wouldExceedLimit(tempSelections, startDate, endDate, activeDesiderata, limit)) {
          onLimitExceeded(`Limite de ${limit}% atteinte pour sélectionner toute la journée`);
          return prev;
        }
        
        // Si on ne dépasse pas la limite, appliquer les sélections
        dateKeys.forEach(key => {
          newSelections[key] = { 
            ...newSelections[key],
            type: activeDesiderata 
          };
        });
      }
      
      setHasUnsavedChanges(true);
      return newSelections;
    });
  }, [activeDesiderata, onNoDesiderataSelected, startDate, endDate, primaryLimit, secondaryLimit, onLimitExceeded]);

  useEffect(() => {
    // Gestionnaire pour terminer la sélection au relâchement du clic ou du toucher
    const handleDragEnd = () => {
      setIsDragging(false);
      setDragAction('select');
    };
    
    // Écouter les événements de souris et tactiles
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);
    
    return () => {
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, []);

  const resetSelections = useCallback(async () => {
    setLocalSelections({});
    setActiveDesiderata(null);
    setHasUnsavedChanges(false);
    // Passer un objet vide du type attendu par saveDesiderata
    await saveDesiderata({} as Record<string, PeriodSelection>);
  }, [saveDesiderata]);

  const saveSelections = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    // Transmettre les objets complets, y compris les commentaires
    // Pas de transformation nécessaire, nous envoyons directement localSelections
    // qui contient à la fois le type et les commentaires
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
    handleDateClick,
    resetSelections,
    saveSelections,
    isLoading,
    hasUnsavedChanges,
    isSaving
  };
};
