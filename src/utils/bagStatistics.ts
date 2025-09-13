/**
 * Utilitaires pour les calculs de statistiques de la bourse aux gardes
 */

import { isGrayedOut } from '../utils/dateUtils';

/**
 * Calcule le taux de succès d'un utilisateur (plafonné à 100%)
 * @param receivedCount Nombre de gardes reçues
 * @param positionedCount Nombre de positions prises
 * @returns Pourcentage entre 0 et 100
 */
export const calculateSuccessRate = (receivedCount: number, positionedCount: number): number => {
  if (positionedCount === 0) return 0;
  const rate = (receivedCount / positionedCount) * 100;
  return Math.min(Math.round(rate), 100);
};

/**
 * Calcule un pourcentage plafonné à 100%
 * @param value Valeur actuelle
 * @param total Total de référence
 * @returns Pourcentage entre 0 et 100
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  const percentage = (value / total) * 100;
  return Math.min(Math.round(percentage), 100);
};

/**
 * Statistiques par période
 */
export interface PeriodStats {
  M: number;   // Matin
  AM: number;  // Après-midi
  S: number;   // Soir
}

/**
 * Calcule les statistiques d'un utilisateur dans la BAG
 */
export interface UserBagStats {
  proposedCount: number;      // Nombre de gardes proposées
  positionedCount: number;    // Nombre de positions prises
  receivedCount: number;      // Nombre de gardes reçues
  givenCount: number;         // Nombre de gardes données
  successRate: number;        // Taux de succès (0-100%)
  participationRate: number;  // Taux de participation (0-100%)
  proposedByPeriod: PeriodStats;   // Gardes proposées par période
  receivedByPeriod: PeriodStats;   // Gardes reçues par période
  weekendHolidayCount: number;      // Nombre de gardes week-end/fériés
}


/**
 * Calcule les statistiques complètes d'un utilisateur
 */
export const calculateUserStats = (
  userId: string,
  exchanges: any[],
  history: any[]
): UserBagStats => {
  // Gardes proposées par l'utilisateur (incluant celles de l'historique)
  const userProposedExchanges = exchanges.filter(e => e.userId === userId);
  const userProposedHistory = history.filter(h => 
    h.originalUserId === userId && h.status === 'completed'
  );
  const proposedCount = userProposedExchanges.length + userProposedHistory.length;
  
  // Positions prises par l'utilisateur (incluant l'historique)
  const positionedExchanges = exchanges.filter(e => 
    e.interestedUsers?.includes(userId)
  );
  // Compter aussi les positions de l'historique où l'utilisateur était intéressé
  const positionedHistory = history.filter(h => 
    h.interestedUsers?.includes(userId) && h.status === 'completed'
  );
  const positionedCount = positionedExchanges.length + positionedHistory.length;
  
  // Gardes reçues (l'utilisateur est newUserId dans l'historique)
  const receivedHistory = history.filter(h => 
    h.newUserId === userId && h.status === 'completed'
  );
  const receivedCount = receivedHistory.length;
  
  // Gardes données (l'utilisateur est originalUserId dans l'historique)
  const givenHistory = history.filter(h => 
    h.originalUserId === userId && h.status === 'completed'
  );
  const givenCount = givenHistory.length;
  
  // Compter par période pour les gardes proposées (actives + historique)
  const allProposedExchanges = [...userProposedExchanges, ...userProposedHistory];
  const proposedByPeriod: PeriodStats = {
    M: allProposedExchanges.filter(e => e.period === 'M').length,
    AM: allProposedExchanges.filter(e => e.period === 'AM').length,
    S: allProposedExchanges.filter(e => e.period === 'S').length
  };
  
  // Compter par période pour les gardes reçues
  const receivedByPeriod: PeriodStats = {
    M: receivedHistory.filter(h => h.period === 'M').length,
    AM: receivedHistory.filter(h => h.period === 'AM').length,
    S: receivedHistory.filter(h => h.period === 'S').length
  };
  
  // Compter les gardes week-end/fériés
  const weekendHolidayCount = history.filter(h => {
    return isGrayedOut(new Date(h.date)) && 
           (h.originalUserId === userId || h.newUserId === userId) &&
           h.status === 'completed';
  }).length;
  
  // Taux de succès : gardes reçues / positions prises (plafonné à 100%)
  const successRate = calculateSuccessRate(receivedCount, positionedCount);
  
  // Taux de participation : (proposées + positionnées) / total des échanges disponibles
  // Inclure le total des gardes historiques pour cohérence avec ParticipationPanel
  const completedExchangesCount = history.filter(h => 
    h.status === 'completed' && h.originalExchangeId
  ).length;
  const totalExchanges = exchanges.length + completedExchangesCount;
  
  const participationRate = calculatePercentage(
    proposedCount + positionedCount,
    totalExchanges
  );
  
  return {
    proposedCount,
    positionedCount,
    receivedCount,
    givenCount,
    successRate,
    participationRate,
    proposedByPeriod,
    receivedByPeriod,
    weekendHolidayCount
  };
};

/**
 * Calcule les statistiques globales de la BAG
 */
export interface GlobalBagStats {
  totalExchanges: number;
  totalValidated: number;
  totalRejected: number;
  totalPending: number;
  validationRate: number;  // Taux de validation (0-100%)
  participationRate: number; // Taux de participation global (0-100%)
}

export const calculateGlobalStats = (
  exchanges: any[],
  history: any[],
  users: any[]
): GlobalBagStats => {
  const totalExchanges = exchanges.length;
  const totalValidated = history.filter(h => h.status === 'completed').length;
  const totalRejected = history.filter(h => h.status === 'rejected').length;
  const totalPending = exchanges.filter(e => e.status === 'pending').length;
  
  // Taux de validation
  const validationRate = calculatePercentage(totalValidated, totalExchanges);
  
  // Taux de participation : utilisateurs ayant au moins une interaction / total utilisateurs
  const activeUsers = new Set([
    ...exchanges.map(e => e.userId),
    ...exchanges.flatMap(e => e.interestedUsers || []),
    ...history.map(h => h.originalUserId),
    ...history.map(h => h.newUserId)
  ]).size;
  
  const participationRate = calculatePercentage(activeUsers, users.length);
  
  return {
    totalExchanges,
    totalValidated,
    totalRejected,
    totalPending,
    validationRate,
    participationRate
  };
};