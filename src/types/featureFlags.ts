export type FeatureStatus = 'enabled' | 'disabled' | 'dev';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  route: string;
  requiredRoles?: string[];
  status: {
    RD: FeatureStatus;
    RG: FeatureStatus;
  };
  lastUpdated: Date;
  updatedBy: string;
}

export interface FeatureFlagUpdate {
  featureId: string;
  association: 'RD' | 'RG';
  status: FeatureStatus;
}

export const FEATURES = {
  DESIDERATA: 'desiderata',
  PLANNING: 'planning',
  SHIFT_EXCHANGE: 'shiftExchange',
  DIRECT_EXCHANGE: 'directExchange',
  DIRECT_EXCHANGE_MODAL: 'directExchangeModal',
  REPLACEMENTS: 'replacements',
  GENERATED_PLANNING: 'generatedPlanning',
  USER_MANAGEMENT: 'userManagement',
  ADMIN_SHIFT_EXCHANGE: 'adminShiftExchange',
  ADMIN_DESIDERATA: 'adminDesiderata',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

export const DEFAULT_FEATURES: Record<FeatureKey, Omit<FeatureFlag, 'id' | 'lastUpdated' | 'updatedBy'>> = {
  [FEATURES.DESIDERATA]: {
    name: 'Desiderata',
    description: 'Saisir mes desiderata',
    route: '/user',
    requiredRoles: ['USER'],
    status: { RD: 'enabled', RG: 'enabled' }
  },
  [FEATURES.PLANNING]: {
    name: 'Mon Planning',
    description: 'Consulter mon planning et échanger mes gardes',
    route: '/planning',
    requiredRoles: ['USER'],
    status: { RD: 'dev', RG: 'disabled' }
  },
  [FEATURES.SHIFT_EXCHANGE]: {
    name: 'Bourse aux Gardes',
    description: 'Interagir avec la bourse aux gardes',
    route: '/shift-exchange',
    requiredRoles: ['USER'],
    status: { RD: 'disabled', RG: 'disabled' }
  },
  [FEATURES.DIRECT_EXCHANGE]: {
    name: 'Échanges',
    description: 'Céder, échanger ou se faire remplacer',
    route: '/direct-exchange',
    requiredRoles: ['USER'],
    status: { RD: 'disabled', RG: 'disabled' }
  },
  [FEATURES.DIRECT_EXCHANGE_MODAL]: {
    name: 'Modal Échanges Directs',
    description: 'Activer le modal d\'échange direct depuis le planning',
    route: '',
    requiredRoles: ['USER'],
    status: { RD: 'disabled', RG: 'disabled' }
  },
  [FEATURES.ADMIN_DESIDERATA]: {
    name: 'Gestion des désidérata',
    description: 'Configurer les paramètres des desiderata',
    route: '/admin',
    requiredRoles: ['ADMIN', 'MANAGER'],
    status: { RD: 'enabled', RG: 'enabled' }
  },
  [FEATURES.REPLACEMENTS]: {
    name: 'Remplacements',
    description: 'Gérer les remplacements',
    route: '/remplacements',
    requiredRoles: ['ADMIN'],
    status: { RD: 'dev', RG: 'disabled' }
  },
  [FEATURES.GENERATED_PLANNING]: {
    name: 'Gestion Planning',
    description: 'Importer et visualiser les plannings',
    route: '/generated-planning',
    requiredRoles: ['ADMIN', 'MANAGER'],
    status: { RD: 'enabled', RG: 'enabled' }
  },
  [FEATURES.USER_MANAGEMENT]: {
    name: 'Utilisateurs',
    description: 'Gérer les comptes utilisateurs',
    route: '/users',
    requiredRoles: ['ADMIN'],
    status: { RD: 'enabled', RG: 'enabled' }
  },
  [FEATURES.ADMIN_SHIFT_EXCHANGE]: {
    name: 'Gestion BaG',
    description: 'Gérer la bourse aux gardes',
    route: '/admin-shift-exchange',
    requiredRoles: ['ADMIN'],
    status: { RD: 'disabled', RG: 'disabled' }
  }
};