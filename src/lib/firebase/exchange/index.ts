/**
 * Module d'échange de gardes
 * 
 * Ce module contient toutes les fonctions nécessaires pour gérer les échanges de gardes
 * dans l'application. Il est organisé en plusieurs sous-modules pour une meilleure
 * maintenabilité et lisibilité.
 */

// Réexporter les types
export * from './types';

// Réexporter les fonctions de base
export { 
  addShiftExchange,
  removeShiftExchange,
  getShiftExchanges,
  finalizeAllExchanges,
  restorePendingExchanges,
  restoreNotTakenToPending
} from './core';

// Réexporter les fonctions de validation
export {
  validateExchangeData,
  verifyNoExistingExchange,
  verifyNoReceivedGuard,
  verifyPlanningAssignment,
  verifyExchangeStatus
} from './validation';

// Réexporter les fonctions de gestion des intérêts
export {
  toggleInterest,
  removeUserFromExchange,
  proposeToUsers,
  proposeToReplacements,
  cancelPropositionToReplacements
} from './interest-operations';

// Réexporter les fonctions de gestion de l'historique
export {
  getExchangeHistory,
  revertToExchange,
  restoreRejectedExchange,
  restoreInterestRemoval
} from './history-operations';

// Export du gestionnaire d'historique
export { historyManager, type CreateHistoryData, type HistoryOperationType } from './history-manager';

// Export du gestionnaire des utilisateurs bloqués
export { blockedUsersManager, type BlockedUserReason } from './blocked-users-manager';

// Réexporter les fonctions d'abonnement
export {
  subscribeToShiftExchanges,
  subscribeToExchangeHistory
} from './subscription-operations';

// Réexporter les fonctions spécifiques à la bourse aux gardes
export {
  validateShiftExchange
} from './bag-exchange';

// Réexporter les fonctions de manipulation des plannings
export {
  findAssignmentInPlanning,
  findPeriodWithAssignment,
  removeAssignmentFromPlanningData,
  addAssignmentToPlanningData,
  getPlanningRefs
} from './planning-operations';

// Réexporter les fonctions de gestion des remplacements
// Ces fonctions sont importées depuis un autre module
import { createReplacement, deleteReplacement } from '../replacements';
export { createReplacement, deleteReplacement };

// Réexporter les fonctions optimisées
export {
  getOptimizedExchanges,
  subscribeToOptimizedExchanges,
  batchExchangeOperations,
  getOptimizedHistory,
  batchCheckConflicts,
  startCacheCleanup,
  invalidateCache
} from './optimized';

// Réexporter les fonctions de restauration
export {
  restoreAllBagExchanges,
  canRestoreAllExchanges,
  restoreFromBackup,
  listAvailableBackups
} from './restore-operations';

// Réexporter les fonctions de gestion des utilisateurs bloqués
export {
  recalculateBlockedUsersForSlot,
  checkInvalidExchanges
} from './blocked-users-operations';
