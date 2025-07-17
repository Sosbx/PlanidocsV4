import React from 'react';
import { Badge } from '../common';

interface PlanningGridCellBadgeProps {
  operationTypes: Array<{ type: 'exchange' | 'give' | 'replacement'; size: 'small' | 'medium' | 'large' }>;
  hasIncomingProposals: boolean;
  period: 'M' | 'AM' | 'S';
}

/**
 * Composant Badge optimisé pour les cellules de planning
 * Séparé pour éviter les re-rendus inutiles
 */
export const PlanningGridCellBadge: React.FC<PlanningGridCellBadgeProps> = React.memo(({
  operationTypes,
  hasIncomingProposals,
  period
}) => {
  // Pas de badges à afficher
  if (operationTypes.length === 0 && !hasIncomingProposals) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full flex items-start justify-end p-[1px] pointer-events-none">
      {/* Badge pour les opérations */}
      {operationTypes.length > 0 && (
        <Badge
          operationTypes={operationTypes}
          size="small"
          periodClass={period}
        />
      )}
      
      {/* Badge pour les propositions reçues */}
      {hasIncomingProposals && (
        <div className="ml-1">
          <Badge
            operationTypes={[{ type: 'exchange', size: 'small' }]}
            size="small"
            periodClass={period}
            hasProposals={true}
          />
        </div>
      )}
    </div>
  );
});

PlanningGridCellBadge.displayName = 'PlanningGridCellBadge';