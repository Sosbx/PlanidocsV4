/**
 * Utilitaires pour la fonctionnalité de bourse aux gardes
 */

import { ShiftExchange, ShiftPeriod } from '../types';

/**
 * Filtre les échanges par période
 * @param exchanges Liste des échanges à filtrer
 * @param period Période à filtrer (matin, après-midi, soir ou tous)
 * @returns Liste des échanges filtrés
 */
export const filterExchangesByPeriod = (
  exchanges: ShiftExchange[],
  period: 'all' | ShiftPeriod
): ShiftExchange[] => {
  if (period === 'all') return exchanges;
  return exchanges.filter(exchange => exchange.period === period);
};

/**
 * Filtre les échanges par utilisateur
 * @param exchanges Liste des échanges à filtrer
 * @param userId ID de l'utilisateur
 * @param includeInterested Inclure les échanges où l'utilisateur a manifesté de l'intérêt
 * @returns Liste des échanges filtrés
 */
export const filterExchangesByUser = (
  exchanges: ShiftExchange[],
  userId: string,
  includeInterested = false
): ShiftExchange[] => {
  return exchanges.filter(exchange => {
    const isOwner = exchange.userId === userId;
    const isInterested = includeInterested && exchange.interestedUsers?.includes(userId);
    return isOwner || isInterested;
  });
};

/**
 * Groupe les échanges par date
 * @param exchanges Liste des échanges à grouper
 * @returns Objet avec les dates comme clés et les échanges comme valeurs
 */
export const groupExchangesByDate = (
  exchanges: ShiftExchange[]
): Record<string, ShiftExchange[]> => {
  const grouped: Record<string, ShiftExchange[]> = {};
  
  exchanges.forEach(exchange => {
    if (!grouped[exchange.date]) {
      grouped[exchange.date] = [];
    }
    grouped[exchange.date].push(exchange);
  });
  
  return grouped;
};

/**
 * Trie les échanges par date
 * @param exchanges Liste des échanges à trier
 * @param ascending Ordre croissant (true) ou décroissant (false)
 * @returns Liste des échanges triés
 */
export const sortExchangesByDate = (
  exchanges: ShiftExchange[],
  ascending = true
): ShiftExchange[] => {
  return [...exchanges].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    return ascending ? dateComparison : -dateComparison;
  });
};

/**
 * Trie les échanges par période (matin, après-midi, soir)
 * @param exchanges Liste des échanges à trier
 * @returns Liste des échanges triés
 */
export const sortExchangesByPeriod = (
  exchanges: ShiftExchange[]
): ShiftExchange[] => {
  return [...exchanges].sort((a, b) => {
    const getOrdinalForPeriod = (period: ShiftPeriod | string) => {
      if (period === ShiftPeriod.MORNING) return 0;
      if (period === ShiftPeriod.AFTERNOON) return 1;
      if (period === ShiftPeriod.EVENING) return 2;
      return 3; // fallback pour toute autre valeur
    };
    return getOrdinalForPeriod(a.period) - getOrdinalForPeriod(b.period);
  });
};

/**
 * Vérifie si un échange est disponible pour manifester de l'intérêt
 * @param exchange Échange à vérifier
 * @param userId ID de l'utilisateur
 * @param isInteractionDisabled Si les interactions sont désactivées
 * @returns true si l'échange est disponible, false sinon
 */
export const isExchangeAvailableForInterest = (
  exchange: ShiftExchange,
  userId: string,
  isInteractionDisabled: boolean
): boolean => {
  // Vérifier si l'utilisateur est le propriétaire de l'échange
  const isOwner = exchange.userId === userId;
  
  // Vérifier si l'échange est indisponible
  const isUnavailable = exchange.status === 'unavailable';
  
  return !isInteractionDisabled && !isOwner && !isUnavailable;
};

/**
 * Vérifie si un utilisateur a manifesté de l'intérêt pour un échange
 * @param exchange Échange à vérifier
 * @param userId ID de l'utilisateur
 * @returns true si l'utilisateur a manifesté de l'intérêt, false sinon
 */
export const hasUserInterest = (
  exchange: ShiftExchange,
  userId: string
): boolean => {
  return exchange.interestedUsers?.includes(userId) || false;
};

/**
 * Génère une clé unique pour un échange basée sur sa date et sa période
 * @param exchange Échange pour lequel générer une clé
 * @returns Clé unique pour l'échange
 */
export const generateExchangeKey = (
  exchange: ShiftExchange
): string => {
  return `${exchange.date}-${exchange.period}`;
};

/**
 * Génère une clé unique pour un échange basée sur sa date et sa période
 * @param date Date de l'échange
 * @param period Période de l'échange
 * @returns Clé unique pour l'échange
 */
export const generateExchangeKeyFromParts = (
  date: string,
  period: ShiftPeriod | string
): string => {
  return `${date}-${period}`;
};
