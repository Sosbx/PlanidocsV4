/** @jsxRuntime automatic */
import React, { Profiler, ProfilerOnRenderCallback } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { logger } from './logger';

/**
 * Interface pour les métriques de performance d'un composant
 */
export interface ComponentPerformanceMetrics {
  componentName: string;
  renderCount: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  lastRenderTime: number;
  unnecessaryRenders: number;
}

/**
 * Gestionnaire de performance pour monitorer les composants React
 */
class PerformanceProfilerManager {
  private metrics: Map<string, ComponentPerformanceMetrics> = new Map();
  private isEnabled: boolean = true; // Toujours activé en dev
  private renderThreshold: number = 16; // 16ms = 60fps
  private maxMetricsSize: number = 100;

  /**
   * Active ou désactive le profiling
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📊 PerformanceProfiler: Profiling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Callback appelé à chaque rendu d'un composant profilé
   */
  onRender: ProfilerOnRenderCallback = (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number,
    interactions: Set<any> | undefined
  ) => {
    if (!this.isEnabled) return;

    const componentName = id;
    const existingMetrics = this.metrics.get(componentName);

    if (existingMetrics) {
      // Mise à jour des métriques existantes
      const newRenderCount = existingMetrics.renderCount + 1;
      const newTotalTime = existingMetrics.totalTime + actualDuration;
      
      // Détection de rendu potentiellement inutile
      const isUnnecessary = phase === 'update' && actualDuration < 1 && baseDuration < 1;
      const unnecessaryRenders = existingMetrics.unnecessaryRenders + (isUnnecessary ? 1 : 0);

      const updatedMetrics: ComponentPerformanceMetrics = {
        ...existingMetrics,
        renderCount: newRenderCount,
        totalTime: newTotalTime,
        averageTime: newTotalTime / newRenderCount,
        maxTime: Math.max(existingMetrics.maxTime, actualDuration),
        minTime: Math.min(existingMetrics.minTime, actualDuration),
        lastRenderTime: actualDuration,
        unnecessaryRenders
      };

      this.metrics.set(componentName, updatedMetrics);

      // Log des rendus lents (seulement en mode debug)
      if (actualDuration > this.renderThreshold && process.env.NODE_ENV === 'development') {
        console.log(`🐌 SlowRender: ${componentName} rendered in ${actualDuration.toFixed(2)}ms (${phase})`);
      }

      // Log des rendus potentiellement inutiles (seulement en mode debug)
      if (isUnnecessary && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ UnnecessaryRender: ${componentName} may have rendered unnecessarily`);
      }
    } else {
      // Premières métriques pour ce composant
      const initialMetrics: ComponentPerformanceMetrics = {
        componentName,
        renderCount: 1,
        totalTime: actualDuration,
        averageTime: actualDuration,
        maxTime: actualDuration,
        minTime: actualDuration,
        lastRenderTime: actualDuration,
        unnecessaryRenders: 0
      };

      this.metrics.set(componentName, initialMetrics);
    }

    // Nettoyage des métriques si trop nombreuses
    if (this.metrics.size > this.maxMetricsSize) {
      this.cleanupOldMetrics();
    }
  };

  /**
   * Nettoie les anciennes métriques pour éviter la fuite mémoire
   */
  private cleanupOldMetrics(): void {
    const metricsArray = Array.from(this.metrics.entries());
    // Garde seulement les 80 composants les plus récemment utilisés
    const sortedByLastRender = metricsArray.sort((a, b) => b[1].lastRenderTime - a[1].lastRenderTime);
    
    this.metrics.clear();
    sortedByLastRender.slice(0, 80).forEach(([key, value]) => {
      this.metrics.set(key, value);
    });
  }

  /**
   * Récupère les métriques d'un composant spécifique
   */
  getComponentMetrics(componentName: string): ComponentPerformanceMetrics | undefined {
    return this.metrics.get(componentName);
  }

  /**
   * Récupère toutes les métriques
   */
  getAllMetrics(): ComponentPerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Récupère les composants avec le plus de rendus inutiles
   */
  getComponentsWithUnnecessaryRenders(): ComponentPerformanceMetrics[] {
    return this.getAllMetrics()
      .filter(metrics => metrics.unnecessaryRenders > 0)
      .sort((a, b) => b.unnecessaryRenders - a.unnecessaryRenders);
  }

  /**
   * Récupère les composants les plus lents
   */
  getSlowestComponents(): ComponentPerformanceMetrics[] {
    return this.getAllMetrics()
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);
  }

  /**
   * Génère un rapport de performance
   */
  generatePerformanceReport(): {
    totalComponents: number;
    totalRenders: number;
    slowestComponents: ComponentPerformanceMetrics[];
    componentsWithUnnecessaryRenders: ComponentPerformanceMetrics[];
    summary: string;
  } {
    const allMetrics = this.getAllMetrics();
    const totalRenders = allMetrics.reduce((sum, metrics) => sum + metrics.renderCount, 0);
    const slowestComponents = this.getSlowestComponents();
    const componentsWithUnnecessaryRenders = this.getComponentsWithUnnecessaryRenders();

    const summary = `
Performance Report:
- Total components monitored: ${allMetrics.length}
- Total renders: ${totalRenders}
- Components with unnecessary renders: ${componentsWithUnnecessaryRenders.length}
- Slowest component: ${slowestComponents[0]?.componentName || 'N/A'} (${slowestComponents[0]?.averageTime.toFixed(2) || 0}ms avg)
    `.trim();

    return {
      totalComponents: allMetrics.length,
      totalRenders,
      slowestComponents,
      componentsWithUnnecessaryRenders,
      summary
    };
  }

  /**
   * Remet à zéro toutes les métriques
   */
  reset(): void {
    this.metrics.clear();
    console.log('📊 PerformanceProfiler: Metrics reset');
  }

  /**
   * Export des métriques au format JSON
   */
  exportMetrics(): string {
    const data = {
      timestamp: createParisDate().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      report: this.generatePerformanceReport()
    };
    return JSON.stringify(data, null, 2);
  }
}

// Instance singleton
export const performanceProfiler = new PerformanceProfilerManager();

// Hook pour utiliser le profiler dans les composants
export const usePerformanceProfiler = (componentName: string) => {
  if (process.env.NODE_ENV === 'development') {
    return {
      onRender: performanceProfiler.onRender,
      getMetrics: () => performanceProfiler.getComponentMetrics(componentName)
    };
  }
  return {
    onRender: () => {},
    getMetrics: () => undefined
  };
};

// Version optimisée du HOC avec option de désactivation
export function withPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  profileId?: string,
  forceDisable = false
) {
  const displayName = profileId || Component.displayName || Component.name || 'UnknownComponent';
  
  const ProfiledComponent: React.FC<P> = (props) => {
    if (process.env.NODE_ENV === 'development' && !forceDisable) {
      return (
        <Profiler id={displayName} onRender={performanceProfiler.onRender}>
          <Component {...props} />
        </Profiler>
      );
    }
    return <Component {...props} />;
  };

  ProfiledComponent.displayName = `withPerformanceProfiler(${displayName})`;
  return ProfiledComponent;
}

// Version allégée sans Profiler React
export function withLightPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  profileId?: string
) {
  const displayName = profileId || Component.displayName || Component.name || 'UnknownComponent';
  
  const ProfiledComponent: React.FC<P> = (props) => {
    // Simple compteur sans Profiler React
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 ${displayName} rendered`);
      }
    });
    
    return <Component {...props} />;
  };

  ProfiledComponent.displayName = `withLightPerformanceProfiler(${displayName})`;
  return ProfiledComponent;
}