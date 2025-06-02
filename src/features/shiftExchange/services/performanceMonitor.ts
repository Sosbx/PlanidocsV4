/**
 * Service de monitoring des performances pour la bourse aux gardes
 * Permet de tracker les métriques importantes et d'identifier les goulots d'étranglement
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceReport {
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  count: number;
  p95: number;
  p99: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private marks: Map<string, number> = new Map();
  private enabled: boolean = process.env.NODE_ENV === 'development';

  private constructor() {
    // Nettoyer les métriques toutes les 10 minutes en production
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Commence une mesure de performance
   */
  startMeasure(name: string, metadata?: Record<string, any>) {
    if (!this.enabled) return;
    
    const key = this.generateKey(name, metadata);
    this.marks.set(key, performance.now());
  }

  /**
   * Termine une mesure de performance
   */
  endMeasure(name: string, metadata?: Record<string, any>) {
    if (!this.enabled) return;
    
    const key = this.generateKey(name, metadata);
    const startTime = this.marks.get(key);
    
    if (!startTime) {
      console.warn(`No start mark found for ${name}`);
      return;
    }
    
    const duration = performance.now() - startTime;
    this.marks.delete(key);
    
    // Stocker la métrique
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata
    });
    
    // Log si la durée dépasse un seuil
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Mesure une fonction asynchrone
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startMeasure(name, metadata);
    try {
      const result = await fn();
      this.endMeasure(name, metadata);
      return result;
    } catch (error) {
      this.endMeasure(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Mesure une fonction synchrone
   */
  measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.startMeasure(name, metadata);
    try {
      const result = fn();
      this.endMeasure(name, metadata);
      return result;
    } catch (error) {
      this.endMeasure(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Obtient un rapport de performance pour une métrique
   */
  getReport(name: string): PerformanceReport | null {
    const metrics = this.metrics.get(name);
    
    if (!metrics || metrics.length === 0) {
      return null;
    }
    
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    
    return {
      averageDuration: sum / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      count: durations.length,
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    };
  }

  /**
   * Obtient tous les rapports de performance
   */
  getAllReports(): Map<string, PerformanceReport> {
    const reports = new Map<string, PerformanceReport>();
    
    this.metrics.forEach((_, name) => {
      const report = this.getReport(name);
      if (report) {
        reports.set(name, report);
      }
    });
    
    return reports;
  }

  /**
   * Log toutes les métriques dans la console
   */
  logReports() {
    if (!this.enabled) return;
    
    console.group('🚀 Performance Report - Bourse aux Gardes');
    
    const reports = this.getAllReports();
    reports.forEach((report, name) => {
      console.log(`\n📊 ${name}:`);
      console.table({
        'Moyenne': `${report.averageDuration.toFixed(2)}ms`,
        'Min': `${report.minDuration.toFixed(2)}ms`,
        'Max': `${report.maxDuration.toFixed(2)}ms`,
        'P95': `${report.p95.toFixed(2)}ms`,
        'P99': `${report.p99.toFixed(2)}ms`,
        'Nombre': report.count
      });
    });
    
    console.groupEnd();
  }

  /**
   * Réinitialise les métriques
   */
  reset() {
    this.metrics.clear();
    this.marks.clear();
  }

  /**
   * Active/désactive le monitoring
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Nettoie les anciennes métriques (plus de 30 minutes)
   */
  private cleanup() {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    
    this.metrics.forEach((metrics, name) => {
      const filtered = metrics.filter(m => m.timestamp > thirtyMinutesAgo);
      if (filtered.length > 0) {
        this.metrics.set(name, filtered);
      } else {
        this.metrics.delete(name);
      }
    });
  }

  /**
   * Génère une clé unique pour une mesure
   */
  private generateKey(name: string, metadata?: Record<string, any>): string {
    if (!metadata) return name;
    return `${name}_${JSON.stringify(metadata)}`;
  }

  /**
   * Calcule un percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

// Export de l'instance singleton
export const performanceMonitor = PerformanceMonitor.getInstance();

// Hook React pour faciliter l'utilisation
export const usePerformanceMonitor = () => {
  return {
    startMeasure: performanceMonitor.startMeasure.bind(performanceMonitor),
    endMeasure: performanceMonitor.endMeasure.bind(performanceMonitor),
    measure: performanceMonitor.measure.bind(performanceMonitor),
    measureAsync: performanceMonitor.measureAsync.bind(performanceMonitor),
    getReport: performanceMonitor.getReport.bind(performanceMonitor),
    logReports: performanceMonitor.logReports.bind(performanceMonitor)
  };
};

// Decorator pour mesurer automatiquement les méthodes
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const className = target.constructor.name;
    const metricName = `${className}.${propertyKey}`;
    
    return performanceMonitor.measureAsync(
      metricName,
      () => originalMethod.apply(this, args),
      { args: args.length }
    );
  };
  
  return descriptor;
}