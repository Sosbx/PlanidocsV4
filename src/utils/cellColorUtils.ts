/**
 * Utilitaires pour la coloration des cellules du planning
 * Centralise la logique de calcul des classes de couleur pour assurer la cohérence
 */

import { ShiftExchange } from '../types/exchange';

type OperationType = 'exchange' | 'give' | 'replacement';

interface CellColorContext {
  isGrayedOut: boolean;
  desideratum?: { type: 'primary' | 'secondary' | null };
  showDesiderata: boolean;
  exchange?: ShiftExchange;
  directExchange?: ShiftExchange;
  isProposedToReplacements?: boolean;
  isReceivedShift?: boolean;
  isReceivedPermutation?: boolean;
  userId?: string;
  bagPhase: 'submission' | 'distribution' | 'completed';
}

/**
 * Détermine les classes de couleur de fond pour une cellule de garde
 */
export function getCellBackgroundClass(context: CellColorContext): string {
  const {
    isGrayedOut,
    desideratum,
    showDesiderata,
    exchange,
    directExchange,
    isProposedToReplacements,
    isReceivedShift,
    isReceivedPermutation,
    userId,
    bagPhase
  } = context;

  // Rassembler toutes les classes
  const classes: string[] = [];

  // 1. Déterminer si la cellule a un échange proposé par l'utilisateur
  const hasProposedGuard = exchange && exchange.userId === userId && !isReceivedShift;

  // 2. Récupérer tous les types d'opérations (exchange, give, replacement)
  const operationTypes = getAllOperationTypes(exchange, directExchange, isProposedToReplacements);
  
  // 3. Déterminer les combinaisons de types d'opérations
  const hasExchangeOp = operationTypes.includes('exchange');
  const hasGiveOp = operationTypes.includes('give');
  const hasReplacementOp = operationTypes.includes('replacement');

  // Phase complétée: appliquer les couleurs des échanges directs
  if (bagPhase === 'completed') {
    const directExchangeBgClass = getCompletedPhaseBackgroundClass(directExchange, userId, isProposedToReplacements);
    if (directExchangeBgClass) {
      // Supprimer les classes bg existantes qui pourraient interférer
      // Pour éviter les conflits avec d'autres classes bg-*
      return directExchangeBgClass;
    }
  }
  
  // Autres phases (submission/distribution): appliquer les couleurs en fonction des types d'opérations
  if (!isReceivedShift) {
    // Calculer la classe de fond basée sur les opérations
    const operationBgClass = getOperationBackgroundClass(
      bagPhase !== 'completed',
      hasExchangeOp,
      hasGiveOp, 
      hasReplacementOp,
      exchange?.exchangeType === 'direct' || directExchange != null
    );
    
    if (operationBgClass) {
      return operationBgClass;
    }
  }

  // Priorité pour désidératas et grayed out
  if (isGrayedOut) {
    if (showDesiderata && desideratum?.type) {
      if (desideratum.type === 'primary') {
        return 'bg-red-100/85';  // Plus visible sur fond grisé
      } else {
        return 'bg-blue-100/85'; // Plus visible sur fond grisé
      }
    }
    return 'bg-gray-100/85';     // Gris légèrement plus visible
  } 
  
  // Désidératas sur cellules normales
  if (showDesiderata && desideratum?.type) {
    if (desideratum.type === 'primary') {
      return 'bg-red-100/80';    // Rouge plus visible
    } else {
      return 'bg-blue-100/80';   // Bleu plus visible
    }
  }
  
  // Gardes reçues
  if (isReceivedShift && bagPhase !== 'completed') {
    if (isReceivedPermutation) {
      return 'bg-emerald-100/85'; // Vert émeraude plus visible
    } else {
      return 'bg-green-100/85';   // Vert plus visible
    }
  }

  return '';
}

/**
 * Récupère tous les types d'opérations pour une cellule
 */
function getAllOperationTypes(
  exchange?: ShiftExchange, 
  directExchange?: ShiftExchange,
  isProposedToReplacements?: boolean
): OperationType[] {
  const allOpTypes: OperationType[] = [];
  
  // Source 1: échange standard
  if (exchange) {
    const exchangeOpTypes = getExchangeOperationTypes(exchange);
    exchangeOpTypes.forEach(type => {
      if (!allOpTypes.includes(type)) {
        allOpTypes.push(type);
      }
    });
  }
  
  // Source 2: échange direct
  if (directExchange) {
    const directOpTypes = getExchangeOperationTypes(directExchange);
    directOpTypes.forEach(type => {
      if (!allOpTypes.includes(type)) {
        allOpTypes.push(type);
      }
    });
  }
  
  // Source 3: remplacement
  if (isProposedToReplacements && !allOpTypes.includes('replacement')) {
    allOpTypes.push('replacement');
  }
  
  return allOpTypes;
}

/**
 * Récupère les types d'opérations d'un échange
 */
function getExchangeOperationTypes(exchange: ShiftExchange): OperationType[] {
  // Prioriser le tableau operationTypes s'il existe
  if (exchange.operationTypes?.length) {
    return exchange.operationTypes as OperationType[];
  }
  
  // Sinon, déterminer les types à partir de operationType
  if (exchange.operationType === 'both') {
    return ['exchange', 'give'];
  }
  
  return exchange.operationType ? [exchange.operationType as OperationType] : [];
}

/**
 * Retourne la classe de couleur pour une combinaison d'opérations
 */
function getOperationBackgroundClass(
  isActive: boolean,
  hasExchangeOp: boolean,
  hasGiveOp: boolean,
  hasReplacementOp: boolean,
  isDirectExchange: boolean
): string {
  // N'appliquer que si c'est un échange direct ou un remplacement
  if (!isDirectExchange && !hasReplacementOp) {
    // Si c'est un échange de la bourse aux gardes 
    if (hasExchangeOp || hasGiveOp) {
      return 'bg-yellow-100/90 shadow-sm'; // Couleur jaune plus visible pour la bourse aux gardes
    }
    return '';
  }
  
  // Logique de couleurs cohérente avec dégradé subtil pour C, E, CE
  // et teinte orangée pour les cas avec R (remplaçant)
  
  // Cas fréquents (C, E, CE) - dégradé de jaune à vert pâle
  if (hasGiveOp && !hasExchangeOp && !hasReplacementOp) {
    return 'bg-yellow-100/85 shadow-sm'; // C (Cession) - jaune
  } else if (hasExchangeOp && !hasGiveOp && !hasReplacementOp) {
    return 'bg-green-50/90 shadow-sm';   // E (Échange) - vert très pâle, légèrement moins transparent
  } else if (hasExchangeOp && hasGiveOp && !hasReplacementOp) {
    return 'bg-lime-100/85 shadow-sm';   // CE (Cession+Échange) - teinte intermédiaire jaune-vert
  } 
  
  // Cas avec remplaçant (R) - teinte orangée presque identique pour CR, ER, CER
  else if (hasReplacementOp && !hasExchangeOp && !hasGiveOp) {
    return 'bg-orange-200/85 shadow-sm';  // R (Remplaçant seul) - légèrement plus foncé
  } else if (hasExchangeOp && hasReplacementOp && !hasGiveOp) {
    return 'bg-orange-100/85 shadow-sm';   // ER (même teinte que CR et CER)
  } else if (hasGiveOp && hasReplacementOp && !hasExchangeOp) {
    return 'bg-orange-100/85 shadow-sm';   // CR (teinte de référence pour R)
  } else if (hasExchangeOp && hasGiveOp && hasReplacementOp) {
    return 'bg-orange-100/85 shadow-sm';   // CER (même teinte que CR et ER)
  }
  
  // Fallback si c'est un échange direct sans type
  if (isDirectExchange) {
    return 'bg-blue-100/85';
  }
  
  return '';
}

/**
 * Détermine la classe de fond pour la phase complétée
 */
function getCompletedPhaseBackgroundClass(
  directExchange?: ShiftExchange,
  userId?: string,
  isProposedToReplacements?: boolean
): string {
  if (!directExchange && !isProposedToReplacements) return '';
  
  if (directExchange && directExchange.userId === userId) {
    const directExchangeOpTypes = directExchange.operationTypes || [];
    const hasDirectExchangeOp = directExchangeOpTypes.includes('exchange');
    const hasDirectGiveOp = directExchangeOpTypes.includes('give');
    const hasDirectReplacementOp = directExchangeOpTypes.includes('replacement');
    
    // Cas fréquents (C, E, CE) - dégradé de jaune à vert pâle
    if (hasDirectGiveOp && !hasDirectExchangeOp && !hasDirectReplacementOp) {
      return 'bg-yellow-100/85 shadow-sm'; // C (Cession) - jaune
    } else if (hasDirectExchangeOp && !hasDirectGiveOp && !hasDirectReplacementOp) {
      return 'bg-green-50/90 shadow-sm';   // E (Échange) - vert très pâle, légèrement moins transparent
    } else if (hasDirectExchangeOp && hasDirectGiveOp && !hasDirectReplacementOp) {
      return 'bg-lime-100/85 shadow-sm';   // CE (Cession+Échange) - teinte intermédiaire jaune-vert
    } 
    
    // Cas avec remplaçant (R) - teinte orangée presque identique pour CR, ER, CER
    else if (hasDirectReplacementOp && !hasDirectExchangeOp && !hasDirectGiveOp) {
      return 'bg-orange-200/85 shadow-sm';  // R (Remplaçant seul) - légèrement plus foncé
    } else if (hasDirectExchangeOp && hasDirectReplacementOp && !hasDirectGiveOp) {
      return 'bg-orange-100/85 shadow-sm';   // ER (même teinte que CR et CER)
    } else if (hasDirectGiveOp && hasDirectReplacementOp && !hasDirectExchangeOp) {
      return 'bg-orange-100/85 shadow-sm';   // CR (teinte de référence pour R)
    } else if (hasDirectExchangeOp && hasDirectGiveOp && hasDirectReplacementOp) {
      return 'bg-orange-100/85 shadow-sm';   // CER (même teinte que CR et ER)
    }
    
    // Fallback 
    return 'bg-blue-100/85';
  } else if (isProposedToReplacements) {
    return 'bg-orange-200/85 shadow-sm'; // R (Remplaçant seul) - légèrement plus foncé
  }
  
  return '';
}