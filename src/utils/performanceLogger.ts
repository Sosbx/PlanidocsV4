/**
 * Utilitaire pour logger les performances de l'application
 */

class PerformanceLogger {
  private marks: Map<string, number> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
    console.log('[PERF] PerformanceLogger initialized');
  }

  mark(name: string) {
    const time = performance.now();
    this.marks.set(name, time);
    console.log(`[PERF] ${name}: ${time - this.startTime}ms`);
  }

  measure(name: string, startMark: string, endMark: string) {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    
    if (start && end) {
      const duration = end - start;
      console.log(`[PERF] ${name}: ${duration}ms (from ${startMark} to ${endMark})`);
      return duration;
    }
    
    return null;
  }

  logCurrentTime(label: string) {
    console.log(`[PERF] ${label}: ${performance.now() - this.startTime}ms since start`);
  }
}

export const perfLogger = new PerformanceLogger();