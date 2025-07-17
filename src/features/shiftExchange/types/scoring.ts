/**
 * Types pour le système de scoring et de suggestion d'attribution
 */

/**
 * Configuration simplifiée pour l'équité de distribution
 */
export interface EquityConfig {
  targetSatisfactionRate: number;  // Taux de satisfaction cible (0-1) ex: 0.5 = 50%
  smallDemandBonus: number;        // Bonus pour ceux qui demandent peu (0-100)
  distributionMode: 'equity' | 'priority' | 'mixed'; // Mode de distribution
}

/**
 * Score de rentabilité pour un type de garde
 */
export interface ShiftTypeScore {
  shiftType: string;
  score: number;   // Score unique pour ce type de garde (0-100)
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * Configuration complète du système de scoring
 */
export interface ScoringConfig {
  id?: string;
  equity: EquityConfig;              // Configuration d'équité remplace les coefficients
  shiftScores: Record<string, ShiftTypeScore>;
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * Composants détaillés d'un score de suggestion
 */
export interface ScoreComponents {
  satisfactionDeficit: number;    // Déficit par rapport au taux cible (0-100)
  demandPriority: number;         // Priorité basée sur le nombre de demandes (0-100)
  shiftValue: number;             // Valeur de la garde (0-100)
  equityScore: number;            // Score d'équité global (0-100)
}

/**
 * Statistiques d'un utilisateur pour le calcul
 */
export interface UserStats {
  userId: string;
  requestedShifts: number;      // Nombre de gardes sur lesquelles l'utilisateur s'est positionné
  receivedShifts: number;       // Nombre de gardes effectivement reçues
  satisfactionRate: number;     // Taux de satisfaction actuel (reçues/demandées)
  totalValue: number;           // Valeur totale des gardes reçues
  shiftsByType: Record<string, number>; // Répartition par type
  interestedIn: string[];       // IDs des échanges où l'utilisateur est intéressé
}

/**
 * Score de suggestion pour un utilisateur
 */
export interface SuggestionScore {
  userId: string;
  exchangeId: string;
  score: number;              // Score global (0-100)
  components: ScoreComponents;
  stats: UserStats;
  impact: {
    newSatisfactionRate: number;  // Nouveau taux de satisfaction après attribution
    satisfactionDelta: number;    // Changement du taux de satisfaction
    remainingDeficit: number;     // Déficit restant par rapport au taux cible
  };
  recommendation: string;      // Message de recommandation
  color: 'green' | 'orange' | 'red'; // Couleur d'affichage
}

/**
 * Presets de configuration prédéfinis
 */
export interface ScoringPreset {
  id: string;
  name: string;
  description: string;
  equity: EquityConfig;
}

/**
 * Statistiques globales pour l'équité
 */
export interface GlobalEquityStats {
  totalRequests: number;         // Total des demandes
  totalDistributed: number;      // Total des gardes distribuées
  averageSatisfactionRate: number; // Taux de satisfaction moyen
  minSatisfactionRate: number;   // Taux de satisfaction minimum
  maxSatisfactionRate: number;   // Taux de satisfaction maximum
  userCount: number;             // Nombre d'utilisateurs actifs
  pendingShifts: number;         // Gardes encore à distribuer
}

// Valeurs par défaut
export const DEFAULT_EQUITY_CONFIG: EquityConfig = {
  targetSatisfactionRate: 0.5,    // 50% de satisfaction cible
  smallDemandBonus: 30,           // 30 points de bonus pour les petits demandeurs
  distributionMode: 'equity'      // Mode équité par défaut
};

export const EQUITY_PRESETS: ScoringPreset[] = [
  {
    id: 'strict-equity',
    name: 'Équité stricte',
    description: 'Tous les médecins reçoivent le même pourcentage de leurs demandes',
    equity: {
      targetSatisfactionRate: 0.5,
      smallDemandBonus: 0,
      distributionMode: 'equity'
    }
  },
  {
    id: 'favor-small',
    name: 'Favoriser les petits demandeurs',
    description: 'Avantage à ceux qui demandent peu de gardes',
    equity: {
      targetSatisfactionRate: 0.5,
      smallDemandBonus: 50,
      distributionMode: 'mixed'
    }
  },
  {
    id: 'priority-based',
    name: 'Priorité absolue',
    description: 'Les petits demandeurs sont servis en premier',
    equity: {
      targetSatisfactionRate: 0.7,
      smallDemandBonus: 100,
      distributionMode: 'priority'
    }
  }
];