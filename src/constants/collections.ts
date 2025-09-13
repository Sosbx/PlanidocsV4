/**
 * Noms des collections Firebase centralisés
 * Évite la duplication et garantit la cohérence
 */
export const FIREBASE_COLLECTIONS = {
  // Collections principales
  USERS: 'users',
  PLANNINGS: 'generated_plannings',
  
  // Collections d'échange
  EXCHANGES: 'shift_exchanges',
  HISTORY: 'exchange_history',
  
  // Collections d'échange direct
  DIRECT_EXCHANGES: 'direct_exchanges',
  DIRECT_EXCHANGE_PROPOSALS: 'direct_exchange_proposals',
  DIRECT_EXCHANGE_HISTORY: 'direct_exchange_history',
  
  // Collections de configuration
  BAG_PHASE_CONFIG: 'bag_phase_config',
  
  // Collections de remplacements
  REPLACEMENTS: 'replacements',
  
  // Collections de gardes
  SHIFTS: 'shifts',
  SHIFT_ASSIGNMENTS: 'shift_assignments',
  
  // Collections de périodes
  PERIODS: 'periods',
  
  // Collections d'audit
  AUDIT_LOGS: 'audit_logs',
  
  // Collections de notifications
  NOTIFICATIONS: 'notifications',
  
  // Collections de sauvegardes
  BACKUPS: 'backups'
} as const;

// Type pour les noms de collections
export type CollectionName = typeof FIREBASE_COLLECTIONS[keyof typeof FIREBASE_COLLECTIONS];

// Alias pour compatibilité arrière (à supprimer progressivement)
export const COLLECTIONS = FIREBASE_COLLECTIONS;