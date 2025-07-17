/**
 * Service de calcul des scores basé sur l'équité de distribution
 */

import type { 
  ScoringConfig, 
  SuggestionScore, 
  UserStats, 
  ScoreComponents,
  GlobalEquityStats
} from '../types/scoring';
import type { ShiftExchange, ExchangeHistory } from '../types';
import type { User } from '../../users/types';

export class EquityCalculator {
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
    
    // Calculer les composants du score
    const components = this.calculateScoreComponents(userStats, exchange, globalStats);
    
    // Calculer le score global
    const score = this.calculateGlobalScore(components, userStats);
    
    // Calculer l'impact de cette attribution
    const impact = this.calculateImpact(userStats, exchange);
    
    // Générer la recommandation
    const recommendation = this.generateRecommendation(score, userStats, impact);
    
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
    // Gardes sur lesquelles l'utilisateur s'est positionné
    const interestedExchanges = this.exchanges.filter(e => 
      e.interestedUsers?.includes(userId)
    );
    
    // Gardes reçues par l'utilisateur dans l'historique
    const receivedShifts = this.history.filter(h => h.newUserId === userId);
    
    // Calculer la valeur totale et la répartition
    let totalValue = 0;
    const shiftsByType: Record<string, number> = {};
    
    receivedShifts.forEach(shift => {
      const shiftScore = this.getShiftScore(shift.shiftType);
      totalValue += shiftScore;
      shiftsByType[shift.shiftType] = (shiftsByType[shift.shiftType] || 0) + 1;
    });
    
    // Taux de satisfaction actuel
    const requestedShifts = interestedExchanges.length;
    const receivedShiftsCount = receivedShifts.length;
    const satisfactionRate = requestedShifts > 0 
      ? receivedShiftsCount / requestedShifts 
      : 0;
    
    return {
      userId,
      requestedShifts,
      receivedShifts: receivedShiftsCount,
      satisfactionRate,
      totalValue,
      shiftsByType,
      interestedIn: interestedExchanges.map(e => e.id)
    };
  }

  /**
   * Calcule les statistiques globales
   */
  private getGlobalStats(): GlobalEquityStats {
    const activeUsers = this.users.filter(u => 
      u.roles.isUser || u.roles.isManager || u.roles.isValidator
    );
    
    // Calculer les statistiques pour chaque utilisateur
    const userStats = activeUsers.map(user => this.getUserStats(user.id));
    
    // Filtrer les utilisateurs qui ont fait au moins une demande
    const activeRequesters = userStats.filter(stats => stats.requestedShifts > 0);
    
    if (activeRequesters.length === 0) {
      return {
        totalRequests: 0,
        totalDistributed: 0,
        averageSatisfactionRate: 0,
        minSatisfactionRate: 0,
        maxSatisfactionRate: 0,
        userCount: activeUsers.length,
        pendingShifts: this.exchanges.length
      };
    }
    
    const satisfactionRates = activeRequesters.map(stats => stats.satisfactionRate);
    
    return {
      totalRequests: activeRequesters.reduce((sum, stats) => sum + stats.requestedShifts, 0),
      totalDistributed: this.history.length,
      averageSatisfactionRate: satisfactionRates.reduce((sum, rate) => sum + rate, 0) / satisfactionRates.length,
      minSatisfactionRate: Math.min(...satisfactionRates),
      maxSatisfactionRate: Math.max(...satisfactionRates),
      userCount: activeRequesters.length,
      pendingShifts: this.exchanges.filter(e => e.status === 'pending').length
    };
  }

  /**
   * Calcule les composants du score
   */
  private calculateScoreComponents(
    userStats: UserStats,
    exchange: ShiftExchange,
    globalStats: GlobalEquityStats
  ): ScoreComponents {
    const targetRate = this.config.equity.targetSatisfactionRate;
    
    // 1. Déficit de satisfaction
    const currentDeficit = Math.max(0, targetRate - userStats.satisfactionRate);
    const satisfactionDeficit = currentDeficit * 100 / targetRate;
    
    // 2. Priorité basée sur le nombre de demandes
    const maxRequests = Math.max(...this.users.map(u => 
      this.getUserStats(u.id).requestedShifts
    ));
    const demandPriority = maxRequests > 0
      ? 100 * (1 - userStats.requestedShifts / maxRequests)
      : 50;
    
    // 3. Valeur de la garde
    const shiftValue = this.getShiftScore(exchange.shiftType);
    
    // 4. Score d'équité global
    const equityScore = this.calculateEquityComponent(userStats, globalStats);
    
    return {
      satisfactionDeficit: Math.round(satisfactionDeficit),
      demandPriority: Math.round(demandPriority),
      shiftValue: Math.round(shiftValue),
      equityScore: Math.round(equityScore)
    };
  }

  /**
   * Calcule le composant d'équité
   */
  private calculateEquityComponent(
    userStats: UserStats,
    globalStats: GlobalEquityStats
  ): number {
    // Si l'utilisateur est au-dessus du taux moyen, pénaliser
    if (userStats.satisfactionRate > globalStats.averageSatisfactionRate) {
      const excess = userStats.satisfactionRate - globalStats.averageSatisfactionRate;
      return Math.max(0, 100 - (excess * 200)); // Pénalité forte
    }
    
    // Si en dessous, bonus proportionnel au déficit
    const deficit = globalStats.averageSatisfactionRate - userStats.satisfactionRate;
    return Math.min(100, 50 + (deficit * 100));
  }

  /**
   * Calcule le score global
   */
  private calculateGlobalScore(
    components: ScoreComponents,
    userStats: UserStats
  ): number {
    const { distributionMode, smallDemandBonus } = this.config.equity;
    
    let score = 0;
    
    switch (distributionMode) {
      case 'equity':
        // Mode équité pure : priorité au déficit de satisfaction
        score = components.satisfactionDeficit * 0.5 + 
                components.equityScore * 0.3 +
                components.shiftValue * 0.2;
        break;
        
      case 'priority':
        // Mode priorité : favoriser fortement les petits demandeurs
        score = components.demandPriority * 0.5 +
                components.satisfactionDeficit * 0.3 +
                components.shiftValue * 0.2;
        break;
        
      case 'mixed':
        // Mode mixte : équilibre entre équité et priorité
        score = components.satisfactionDeficit * 0.35 +
                components.demandPriority * 0.25 +
                components.equityScore * 0.25 +
                components.shiftValue * 0.15;
        break;
    }
    
    // Appliquer le bonus pour les petits demandeurs
    if (userStats.requestedShifts <= 3) {
      score += smallDemandBonus * 0.5;
    } else if (userStats.requestedShifts <= 5) {
      score += smallDemandBonus * 0.3;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calcule l'impact de l'attribution
   */
  private calculateImpact(
    userStats: UserStats,
    exchange: ShiftExchange
  ) {
    const newReceivedCount = userStats.receivedShifts + 1;
    const newSatisfactionRate = userStats.requestedShifts > 0
      ? newReceivedCount / userStats.requestedShifts
      : 1;
    
    const targetRate = this.config.equity.targetSatisfactionRate;
    const currentDeficit = Math.max(0, targetRate - userStats.satisfactionRate);
    const newDeficit = Math.max(0, targetRate - newSatisfactionRate);
    
    return {
      newSatisfactionRate: Math.round(newSatisfactionRate * 100) / 100,
      satisfactionDelta: Math.round((newSatisfactionRate - userStats.satisfactionRate) * 100) / 100,
      remainingDeficit: Math.round(newDeficit * 100) / 100
    };
  }

  /**
   * Génère une recommandation textuelle
   */
  private generateRecommendation(
    score: number,
    userStats: UserStats,
    impact: any
  ): string {
    const targetRate = this.config.equity.targetSatisfactionRate;
    
    if (userStats.satisfactionRate >= targetRate) {
      return `Déjà au taux cible (${Math.round(userStats.satisfactionRate * 100)}%)`;
    }
    
    if (score >= 80) {
      return `Fortement recommandé - Améliore l'équité (→ ${Math.round(impact.newSatisfactionRate * 100)}%)`;
    } else if (score >= 60) {
      return `Recommandé - ${userStats.requestedShifts} demandes, ${userStats.receivedShifts} reçues`;
    } else if (score >= 40) {
      return `Acceptable - Considérer d'autres options`;
    } else {
      return `Non recommandé - Utilisateur déjà bien servi`;
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
    return typeScore?.score || 50;
  }

  /**
   * Calcule les scores pour tous les utilisateurs intéressés par une garde
   */
  calculateAllSuggestions(exchange: ShiftExchange): SuggestionScore[] {
    const interestedUsers = exchange.interestedUsers || [];
    
    return interestedUsers
      .map(userId => this.calculateSuggestionScore(userId, exchange))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Obtient des recommandations de distribution optimale
   */
  getOptimalDistribution(): Map<string, string[]> {
    const distribution = new Map<string, string[]>();
    const userSatisfaction = new Map<string, { requested: number; received: number }>();
    
    // Initialiser les compteurs
    this.users.forEach(user => {
      const stats = this.getUserStats(user.id);
      userSatisfaction.set(user.id, {
        requested: stats.requestedShifts,
        received: stats.receivedShifts
      });
    });
    
    // Trier les échanges par nombre d'intéressés (moins d'intéressés = plus prioritaire)
    const sortedExchanges = [...this.exchanges]
      .filter(e => e.status === 'pending' && e.interestedUsers?.length > 0)
      .sort((a, b) => (a.interestedUsers?.length || 0) - (b.interestedUsers?.length || 0));
    
    // Distribuer les gardes
    sortedExchanges.forEach(exchange => {
      const suggestions = this.calculateAllSuggestions(exchange);
      
      if (suggestions.length > 0) {
        // Prendre le meilleur candidat
        const bestCandidate = suggestions[0];
        distribution.set(exchange.id, [bestCandidate.userId]);
        
        // Mettre à jour les statistiques
        const userStat = userSatisfaction.get(bestCandidate.userId);
        if (userStat) {
          userStat.received++;
        }
      }
    });
    
    return distribution;
  }
}