import { OperationType } from '../types';

/**
 * Types d'opération valides pour les échanges directs
 */
export const VALID_OPERATION_TYPES: OperationType[] = ['give', 'exchange', 'replacement'];

/**
 * Vérifie si un type d'opération est valide
 */
export function isValidOperationType(type: unknown): type is OperationType {
  return typeof type === 'string' && VALID_OPERATION_TYPES.includes(type as OperationType);
}

/**
 * Filtre et valide un tableau de types d'opération
 * Retourne uniquement les types valides
 */
export function validateOperationTypes(types: unknown[]): OperationType[] {
  if (!Array.isArray(types)) {
    console.warn('validateOperationTypes: types n\'est pas un tableau', types);
    return [];
  }

  const validTypes = types.filter(isValidOperationType);
  
  if (validTypes.length !== types.length) {
    console.warn('validateOperationTypes: certains types ont été filtrés', {
      original: types,
      valid: validTypes
    });
  }

  return validTypes;
}

/**
 * Vérifie si une combinaison de types d'opération est valide
 * Par exemple, on ne peut pas avoir 'give' et 'exchange' en même temps
 */
export function isValidOperationCombination(types: OperationType[]): boolean {
  // Si aucun type, c'est invalide
  if (types.length === 0) return false;

  // Si un seul type, c'est toujours valide
  if (types.length === 1) return true;

  // Vérifier les combinaisons invalides
  const hasGive = types.includes('give');
  const hasExchange = types.includes('exchange');
  const hasReplacement = types.includes('replacement');

  // 'give' et 'exchange' peuvent être utilisés ensemble
  // Cette combinaison permet à un médecin de proposer sa garde en cession ET en échange
  // L'autre médecin pourra choisir l'option qui lui convient

  // Le remplacement peut être combiné avec give et/ou exchange
  // Toutes les combinaisons sont autorisées pour offrir plus de flexibilité

  return true;
}

/**
 * Nettoie et valide les types d'opération d'un échange
 * Retourne un tableau de types valides ou un tableau vide si invalide
 */
export function sanitizeOperationTypes(exchange: any): OperationType[] {
  // Si operationTypes existe et est un tableau
  if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
    const validTypes = validateOperationTypes(exchange.operationTypes);
    if (isValidOperationCombination(validTypes)) {
      return validTypes;
    }
  }

  // Sinon, essayer de dériver depuis operationType (legacy)
  if (exchange.operationType) {
    if (exchange.operationType === 'both') {
      return ['give', 'exchange'];
    } else if (isValidOperationType(exchange.operationType)) {
      return [exchange.operationType];
    }
  }

  // Par défaut, retourner un tableau vide
  console.warn('sanitizeOperationTypes: aucun type valide trouvé', exchange);
  return [];
}