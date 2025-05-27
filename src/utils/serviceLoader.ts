/**
 * Service centralisé pour le chargement dynamique des modules Firebase
 * Évite les conflicts entre imports statiques et dynamiques
 */

// Cache pour éviter les imports multiples
const serviceCache = new Map();

/**
 * Charge le service de planning de manière lazy
 */
export const loadPlanningService = async () => {
  if (!serviceCache.has('planning')) {
    const module = await import('../lib/firebase/planning');
    serviceCache.set('planning', module);
  }
  return serviceCache.get('planning');
};

/**
 * Charge le service de transaction de manière lazy
 */
export const loadTransactionService = async () => {
  if (!serviceCache.has('transaction')) {
    const module = await import('../lib/firebase/directExchange/TransactionService');
    serviceCache.set('transaction', module);
  }
  return serviceCache.get('transaction');
};

/**
 * Charge les opérations atomiques de manière lazy
 */
export const loadAtomicOperations = async () => {
  if (!serviceCache.has('atomic')) {
    const module = await import('../lib/firebase/atomicOperations');
    serviceCache.set('atomic', module);
  }
  return serviceCache.get('atomic');
};

/**
 * Charge le service d'échange core de manière lazy
 */
export const loadExchangeCoreService = async () => {
  if (!serviceCache.has('exchangeCore')) {
    const module = await import('../lib/firebase/exchange/core');
    serviceCache.set('exchangeCore', module);
  }
  return serviceCache.get('exchangeCore');
};

/**
 * Charge les opérations d'historique d'échange de manière lazy
 */
export const loadExchangeHistoryService = async () => {
  if (!serviceCache.has('exchangeHistory')) {
    const module = await import('../lib/firebase/exchange/history-operations');
    serviceCache.set('exchangeHistory', module);
  }
  return serviceCache.get('exchangeHistory');
};

/**
 * Charge le composant GeneratedPlanningTable de manière lazy
 */
export const loadGeneratedPlanningTable = async () => {
  if (!serviceCache.has('generatedPlanningTable')) {
    const module = await import('../features/planning/components/GeneratedPlanningTable');
    serviceCache.set('generatedPlanningTable', module);
  }
  return serviceCache.get('generatedPlanningTable');
};