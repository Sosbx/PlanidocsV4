/**
 * cache.ts
 * 
 * Système de gestion des caches pour les données Firebase
 * Permet d'invalider le cache après des modifications critiques
 */

// Map pour suivre les timestamps de dernière invalidation par utilisateur et type
const cacheInvalidationTimestamps = new Map<string, Map<string, number>>();

/**
 * Invalide le cache pour un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @param cacheType Type de cache à invalider (par défaut: 'all')
 * @returns Timestamp de l'invalidation
 */
export const invalidateCache = (userId: string, cacheType: string = 'all'): number => {
  if (!userId) return 0;

  // Obtenir ou créer la map pour l'utilisateur
  let userMap = cacheInvalidationTimestamps.get(userId);
  if (!userMap) {
    userMap = new Map<string, number>();
    cacheInvalidationTimestamps.set(userId, userMap);
  }

  // Mettre à jour le timestamp d'invalidation
  const now = Date.now();
  userMap.set(cacheType, now);

  console.log(`Cache invalidé pour l'utilisateur ${userId}, type: ${cacheType}, timestamp: ${now}`);
  return now;
};

/**
 * Invalide le cache d'échange pour un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @returns Timestamp de l'invalidation
 */
export const invalidateExchangeCache = (userId: string): number => {
  return invalidateCache(userId, 'exchange');
};

/**
 * Invalide le cache de planning pour un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @returns Timestamp de l'invalidation
 */
export const invalidatePlanningCache = (userId: string): number => {
  return invalidateCache(userId, 'planning');
};

/**
 * Vérifie si le cache est toujours valide
 * @param userId ID de l'utilisateur
 * @param cacheType Type de cache à vérifier
 * @param timestamp Timestamp à comparer
 * @returns true si le cache est toujours valide
 */
export const isCacheValid = (userId: string, cacheType: string, timestamp: number): boolean => {
  if (!userId) return false;

  const userMap = cacheInvalidationTimestamps.get(userId);
  if (!userMap) return true; // Pas d'invalidation connue

  // Vérifier le type spécifique et le type 'all'
  const typeTimestamp = userMap.get(cacheType) || 0;
  const allTypesTimestamp = userMap.get('all') || 0;
  
  // Le cache est valide si le timestamp est plus récent que les deux timestamps d'invalidation
  return timestamp > typeTimestamp && timestamp > allTypesTimestamp;
};

/**
 * Récupère le timestamp d'invalidation du cache
 * @param userId ID de l'utilisateur
 * @param cacheType Type de cache
 * @returns Timestamp de la dernière invalidation ou 0
 */
export const getCacheInvalidationTimestamp = (userId: string, cacheType: string): number => {
  if (!userId) return 0;

  const userMap = cacheInvalidationTimestamps.get(userId);
  if (!userMap) return 0;

  // Récupérer le timestamp spécifique ou 'all'
  const typeTimestamp = userMap.get(cacheType) || 0;
  const allTypesTimestamp = userMap.get('all') || 0;
  
  // Retourner le plus récent des deux
  return Math.max(typeTimestamp, allTypesTimestamp);
};