/**
 * Service de calcul des scores de suggestion pour l'attribution équitable des gardes
 */

import type { 
  ScoringConfig, 
  SuggestionScore, 
  UserStats, 
  ScoreComponents,
  GlobalEquityStats,
  ScoringCoefficients
} from '../types/scoring';
import type { ShiftExchange, ExchangeHistory } from '../types';
import type { User } from '../../users/types';

export class SuggestionCalculator {
  private config: ScoringConfig;
  private users: User[];
  private exchanges: ShiftExchange[];
  private history: ExchangeHistory[];
  
  constructor(
    config: ScoringConfig,
    users: User[],
    exchanges: ShiftExchange[],
    history: ExchangeHistory[]
  ) {
    this.config = config;
    this.users = users;
    this.exchanges = exchanges;
    this.history = history;
  }

  /**
   * Calcule le score de suggestion pour un utilisateur sur une garde spécifique
   */
  calculateSuggestionScore(
    userId: string,
    exchange: ShiftExchange
  ): SuggestionScore {
    // Récupérer les statistiques de l'utilisateur
    const userStats = this.getUserStats(userId);
    
    // Récupérer les statistiques globales
    const globalStats = this.getGlobalStats();
    
    // Calculer chaque composant du score
    const components = this.calculateScoreComponents(
      userStats,
      globalStats,
      exchange
    );
    
    // Calculer le score global avec les coefficients
    const score = this.calculateWeightedScore(components, this.config.coefficients);
    
    // Calculer l'impact de cette attribution
    const impact = this.calculateImpact(userStats, exchange, globalStats);
    
    // Générer la recommandation
    const recommendation = this.generateRecommendation(score, components, impact);
    
    // Déterminer la couleur
    const color = this.getScoreColor(score);
    
    return {
      userId,
      exchangeId: exchange.id,
      score: Math.round(score),
      components,
      stats: userStats,
      impact,
      recommendation,
      color
    };
  }

  /**
   * Calcule les statistiques d'un utilisateur
   */
  private getUserStats(userId: string): UserStats {
    // Gardes reçues par l'utilisateur
    const receivedShifts = this.history.filter(h => h.newUserId === userId);
    
    // Gardes proposées par l'utilisateur
    const proposedShifts = this.exchanges.filter(e => e.userId === userId);
    
    // Calculer la valeur totale
    let currentValue = 0;
    const shiftsByType: Record<string, number> = {};
    const shiftsByPeriod = { M: 0, AM: 0, S: 0 };
    
    receivedShifts.forEach(shift => {
      const shiftScore = this.getShiftScore(shift.shiftType);
      currentValue += shiftScore;
      
      shiftsByType[shift.shiftType] = (shiftsByType[shift.shiftType] || 0) + 1;
      shiftsByPeriod[shift.period]++;
    });
    
    // Taux de participation
    const participationRate = proposedShifts.length > 0
      ? Math.min(100, (receivedShifts.length / proposedShifts.length) * 100)
      : 0;
    
    return {
      userId,
      currentValue,
      shiftCount: receivedShifts.length,
      shiftsByType,
      shiftsByPeriod,
      proposedCount: proposedShifts.length,
      receivedCount: receivedShifts.length,
      participationRate
    };
  }

  /**
   * Calcule les statistiques globales
   */
  private getGlobalStats(): GlobalEquityStats {
    const activeUsers = this.users.filter(u => 
      u.roles.isUser || u.roles.isManager || u.roles.isValidator
    );
    
    const userValues = activeUsers.map(user => 
      this.getUserStats(user.id).currentValue
    );
    
    const totalValue = userValues.reduce((sum, val) => sum + val, 0);
    const averageValue = totalValue / activeUsers.length || 0;
    
    // Calculer la médiane
    const sortedValues = [...userValues].sort((a, b) => a - b);
    const medianValue = sortedValues.length > 0
      ? sortedValues[Math.floor(sortedValues.length / 2)]
      : 0;
    
    // Calculer l'écart-type
    const variance = userValues.reduce((sum, val) => 
      sum + Math.pow(val - averageValue, 2), 0
    ) / activeUsers.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Score d'équité global (plus l'écart-type est faible, meilleur est le score)
    const equityScore = averageValue > 0
      ? Math.max(0, 100 - (standardDeviation / averageValue) * 100)
      : 100;
    
    return {
      totalValue,
      averageValue,
      medianValue,
      standardDeviation,
      equityScore: Math.round(equityScore),
      userCount: activeUsers.length,
      totalShifts: this.history.length
    };
  }

  /**
   * Calcule les composants du score
   */
  private calculateScoreComponents(
    userStats: UserStats,
    globalStats: GlobalEquityStats,
    exchange: ShiftExchange
  ): ScoreComponents {
    const shiftValue = this.getShiftScore(exchange.shiftType);
    
    // Score d'équité par valeur
    const targetValue = globalStats.averageValue;
    const currentDiff = Math.abs(userStats.currentValue - targetValue);
    const newDiff = Math.abs(userStats.currentValue + shiftValue - targetValue);
    const equiteValeur = newDiff < currentDiff
      ? Math.min(100, 100 * (1 - newDiff / targetValue))
      : Math.max(0, 50 * (1 - newDiff / targetValue));
    
    // Score d'équité par nombre
    const targetCount = globalStats.totalShifts / globalStats.userCount;
    const countDiff = Math.abs(userStats.shiftCount + 1 - targetCount);
    const equiteNombre = Math.max(0, 100 * (1 - countDiff / targetCount));
    
    // Score de diversité des types
    const typeCount = Object.keys(userStats.shiftsByType).length;
    const maxTypes = this.getUniqueShiftTypes().length;
    const hasThisType = userStats.shiftsByType[exchange.shiftType] > 0;
    const diversiteTypes = hasThisType
      ? 100 * (typeCount / maxTypes)
      : 100 * ((typeCount + 1) / maxTypes);
    
    // Score de participation
    const participation = userStats.participationRate;
    
    // Score de charge actuelle
    const maxShifts = Math.max(...this.users.map(u => 
      this.getUserStats(u.id).shiftCount
    ));
    const chargeActuelle = maxShifts > 0
      ? Math.max(0, 100 * (1 - userStats.shiftCount / maxShifts))
      : 100;
    
    return {
      equiteValeur: Math.round(equiteValeur),
      equiteNombre: Math.round(equiteNombre),
      diversiteTypes: Math.round(diversiteTypes),
      participation: Math.round(participation),
      chargeActuelle: Math.round(chargeActuelle)
    };
  }

  /**
   * Calcule le score pondéré
   */
  private calculateWeightedScore(
    components: ScoreComponents,
    coefficients: ScoringCoefficients
  ): number {
    return (
      components.equiteValeur * coefficients.equiteValeur +
      components.equiteNombre * coefficients.equiteNombre +
      components.diversiteTypes * coefficients.diversiteTypes +
      components.participation * coefficients.participation +
      components.chargeActuelle * coefficients.chargeActuelle
    );
  }

  /**
   * Calcule l'impact de l'attribution
   */
  private calculateImpact(
    userStats: UserStats,
    exchange: ShiftExchange,
    globalStats: GlobalEquityStats
  ) {
    const shiftValue = this.getShiftScore(exchange.shiftType);
    const newValue = userStats.currentValue + shiftValue;
    
    // Calculer le nouvel écart à la moyenne
    const currentDiff = Math.abs(userStats.currentValue - globalStats.averageValue);
    const newDiff = Math.abs(newValue - globalStats.averageValue);
    
    // Amélioration de l'équité (positif = amélioration)
    const equityImprovement = currentDiff > 0
      ? ((currentDiff - newDiff) / currentDiff) * 100
      : 0;
    
    return {
      newValue,
      valueDelta: shiftValue,
      equityImprovement: Math.round(equityImprovement * 10) / 10
    };
  }

  /**
   * Génère une recommandation textuelle
   */
  private generateRecommendation(
    score: number,
    components: ScoreComponents,
    impact: any
  ): string {
    if (score >= 80) {
      return "Fortement recommandé - Améliore significativement l'équité";
    } else if (score >= 60) {
      const lowestComponent = this.getLowestComponent(components);
      return `Recommandé - Attention au critère "${lowestComponent}"`;
    } else if (score >= 40) {
      return "Acceptable - Considérer d'autres options si disponibles";
    } else {
      return "Non recommandé - Risque de déséquilibre important";
    }
  }

  /**
   * Détermine la couleur en fonction du score
   */
  private getScoreColor(score: number): 'green' | 'orange' | 'red' {
    if (score >= 70) return 'green';
    if (score >= 40) return 'orange';
    return 'red';
  }

  /**
   * Récupère le score d'une garde
   */
  private getShiftScore(shiftType: string): number {
    const typeScore = this.config.shiftScores[shiftType];
    return typeScore?.score || 50; // Score par défaut
  }

  /**
   * Récupère tous les types de garde uniques
   */
  private getUniqueShiftTypes(): string[] {
    const types = new Set<string>();
    this.exchanges.forEach(e => types.add(e.shiftType));
    this.history.forEach(h => types.add(h.shiftType));
    return Array.from(types);
  }

  /**
   * Trouve le composant avec le score le plus bas
   */
  private getLowestComponent(components: ScoreComponents): string {
    const componentNames: Record<keyof ScoreComponents, string> = {
      equiteValeur: 'Équité par valeur',
      equiteNombre: 'Équité par nombre',
      diversiteTypes: 'Diversité des types',
      participation: 'Participation',
      chargeActuelle: 'Charge actuelle'
    };
    
    let lowestKey: keyof ScoreComponents = 'equiteValeur';
    let lowestValue = components.equiteValeur;
    
    (Object.keys(components) as Array<keyof ScoreComponents>).forEach(key => {
      if (components[key] < lowestValue) {
        lowestValue = components[key];
        lowestKey = key;
      }
    });
    
    return componentNames[lowestKey];
  }

  /**
   * Calcule les scores pour tous les utilisateurs intéressés par une garde
   */
  calculateAllSuggestions(exchange: ShiftExchange): SuggestionScore[] {
    const interestedUsers = exchange.interestedUsers || [];
    
    return interestedUsers
      .map(userId => this.calculateSuggestionScore(userId, exchange))
      .sort((a, b) => b.score - a.score); // Trier par score décroissant
  }
}