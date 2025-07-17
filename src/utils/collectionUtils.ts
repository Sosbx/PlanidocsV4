/**
 * Utilitaires pour la gestion des noms de collections Firestore
 * Ce fichier ne doit PAS importer Firebase pour éviter les dépendances circulaires
 */

/**
 * Retourne le nom de la collection en fonction de l'association
 * @param baseCollectionName - Le nom de base de la collection
 * @param associationId - L'ID de l'association ('RD' ou 'RG')
 * @returns Le nom de la collection approprié
 */
export function getCollectionName(baseCollectionName: string, associationId: string = 'RD'): string {
  // Pour Rive Droite, on utilise les collections de base
  if (associationId === 'RD') {
    return baseCollectionName;
  }
  
  // Pour les autres associations, on suffixe avec l'ID de l'association
  return `${baseCollectionName}_${associationId}`;
}

/**
 * Collections disponibles dans l'application
 */
export const COLLECTIONS = {
  USERS: 'users',
  DESIDERATA: 'desiderata',
  ARCHIVED_DESIDERATA: 'archived_desiderata',
  GENERATED_PLANNINGS: 'generated_plannings',
  GENERATED_PLANNING_EVENTS: 'generated_planning_events',
  PLANNING_PERIODS: 'planning_periods',
  SHIFT_EXCHANGES: 'shift_exchanges',
  DIRECT_EXCHANGES: 'direct_exchanges',
  DIRECT_EXCHANGE_PROPOSALS: 'direct_exchange_proposals',
  DEVICE_TOKENS: 'device_tokens',
  DIRECT_EXCHANGE_TRANSACTIONS: 'direct_exchange_transactions',
  EXCHANGE_TRANSACTIONS: 'exchange_transactions',
  PLANNINGS: 'plannings',
  FEEDBACK: 'feedback',
  FEATURE_FLAGS: 'feature_flags'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];