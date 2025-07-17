import React, { useMemo } from 'react';
import type { ShiftAssignment } from '../../types/planning';

interface PlanningGridCellContentProps {
  assignment: ShiftAssignment;
  period: 'M' | 'AM' | 'S';
  hasProposedGuard: boolean;
  isReceivedShift: boolean;
}

/**
 * Composant Content optimisé pour les cellules de planning
 * Gère uniquement l'affichage du contenu texte
 */
export const PlanningGridCellContent: React.FC<PlanningGridCellContentProps> = React.memo(({
  assignment,
  period,
  hasProposedGuard,
  isReceivedShift
}) => {
  // Mémoïser les classes CSS
  const textClasses = useMemo(() => {
    const baseClasses = 'inline-block relative z-10 font-semibold text-[13px]';
    
    const periodColor = period === 'M' 
      ? 'text-amber-800' 
      : period === 'AM' 
        ? 'text-blue-800' 
        : 'text-violet-800';
    
    const shadowClass = (hasProposedGuard || isReceivedShift) ? 'drop-shadow-sm' : '';
    
    return `${baseClasses} ${periodColor} ${shadowClass}`;
  }, [period, hasProposedGuard, isReceivedShift]);

  return (
    <span className={textClasses}>
      {assignment.shiftType || ''}
    </span>
  );
});

PlanningGridCellContent.displayName = 'PlanningGridCellContent';