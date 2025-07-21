import type { OperationType } from '../types';

/**
 * Détermine les types d'opération disponibles pour un échange
 * En fonction de ses propriétés operationTypes ou operationType
 */
export function determineAvailableOperationTypes(exchange: any): OperationType[] {
  let operationTypes: OperationType[] = [];
  
  // Si l'échange a une propriété operationTypes, l'utiliser en priorité
  if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
    operationTypes = [...exchange.operationTypes];
  }
  // Sinon, dériver de operationType
  else {
    // Si l'échange est de type 'both', ajouter les deux types
    if (exchange.operationType === 'both') {
      operationTypes = ['exchange', 'give'];
    }
    // Sinon, ajouter le type d'opération de l'échange
    else if (exchange.operationType === 'exchange' || exchange.operationType === 'give') {
      operationTypes = [exchange.operationType];
    }
    // Par défaut, permettre au moins la reprise
    else {
      operationTypes = ['give'];
    }
  }
  
  console.log('Types d\'opération disponibles pour cet échange:', operationTypes);
  return operationTypes;
}

/**
 * Normalise une assignation pour s'assurer que period est défini
 */
export function normalizeAssignment(assignment: any): any {
  return {
    ...assignment,
    // S'assurer que period est défini, sinon utiliser type
    period: assignment.period || assignment.type
  };
}