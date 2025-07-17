import { createParisDate } from '@/utils/timezoneUtils';

/**
 * Logger centralisé pour remplacer console.log dans l'application
 * Optimisé pour la production avec désactivation conditionnelle
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LogConfig {
  level: LogLevel;
  enabledInProduction: boolean;
  enablePerformanceLogging: boolean;
  enableNetworkLogging: boolean;
}

class Logger {
  private config: LogConfig;
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = performance.now();
    
    // Configuration basée sur l'environnement
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    this.config = {
      level: isDevelopment ? LogLevel.DEBUG : LogLevel.WARN,
      enabledInProduction: false,
      enablePerformanceLogging: isDevelopment,
      enableNetworkLogging: isDevelopment
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (process.env.NODE_ENV === 'production' && !this.config.enabledInProduction) {
      return false;
    }
    return level >= this.config.level;
  }

  private formatMessage(level: string, context: string, message: any, ...args: any[]): any[] {
    const timestamp = createParisDate().toISOString().slice(11, 23); // HH:mm:ss.sss
    const prefix = `[${timestamp}] [${level}] [${context}]`;
    
    if (typeof message === 'string') {
      return [prefix, message, ...args];
    }
    return [prefix, message, ...args];
  }

  debug(context: string, message: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage('DEBUG', context, message, ...args));
    }
  }

  info(context: string, message: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage('INFO', context, message, ...args));
    }
  }

  warn(context: string, message: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage('WARN', context, message, ...args));
    }
  }

  error(context: string, message: any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage('ERROR', context, message, ...args));
    }
  }

  // Logger de performance intégré
  perf = {
    mark: (name: string) => {
      if (!this.config.enablePerformanceLogging) return;
      
      const time = performance.now();
      this.marks.set(name, time);
      this.debug('PERF', `${name}: ${time - this.startTime}ms`);
    },

    measure: (name: string, startMark: string, endMark: string) => {
      if (!this.config.enablePerformanceLogging) return null;
      
      const start = this.marks.get(startMark);
      const end = this.marks.get(endMark);
      
      if (start && end) {
        const duration = end - start;
        this.debug('PERF', `${name}: ${duration}ms (from ${startMark} to ${endMark})`);
        return duration;
      }
      
      return null;
    },

    time: (label: string) => {
      if (!this.config.enablePerformanceLogging) return;
      this.debug('PERF', `${label}: ${performance.now() - this.startTime}ms since start`);
    }
  };

  // Logger réseau pour Firebase et API
  network = {
    request: (method: string, url: string, data?: any) => {
      if (!this.config.enableNetworkLogging) return;
      this.debug('NETWORK', `→ ${method.toUpperCase()} ${url}`, data);
    },

    response: (method: string, url: string, status: number, data?: any) => {
      if (!this.config.enableNetworkLogging) return;
      const level = status >= 400 ? 'ERROR' : 'DEBUG';
      this[level.toLowerCase() as keyof this]('NETWORK', `← ${method.toUpperCase()} ${url} [${status}]`, data);
    },

    error: (method: string, url: string, error: any) => {
      this.error('NETWORK', `✗ ${method.toUpperCase()} ${url}`, error);
    }
  };

  // Logger pour les contextes spécifiques
  auth = {
    login: (userId: string) => this.info('AUTH', `User logged in: ${userId}`),
    logout: () => this.info('AUTH', 'User logged out'),
    error: (error: any) => this.error('AUTH', 'Authentication error', error)
  };

  firebase = {
    query: (collection: string, filter?: any) => 
      this.debug('FIREBASE', `Query ${collection}`, filter),
    write: (collection: string, data: any) => 
      this.debug('FIREBASE', `Write to ${collection}`, data),
    error: (operation: string, error: any) => 
      this.error('FIREBASE', `Firebase ${operation} error`, error)
  };

  planning = {
    load: (userId: string, period?: string) => 
      this.debug('PLANNING', `Loading planning for ${userId}`, { period }),
    save: (userId: string, period?: string) => 
      this.info('PLANNING', `Saved planning for ${userId}`, { period }),
    export: (format: string, period?: string) => 
      this.info('PLANNING', `Exported planning as ${format}`, { period }),
    error: (operation: string, error: any) => 
      this.error('PLANNING', `Planning ${operation} error`, error)
  };

  exchange = {
    create: (type: string, exchangeId: string) => 
      this.info('EXCHANGE', `Created ${type} exchange`, { exchangeId }),
    update: (exchangeId: string, status: string) => 
      this.info('EXCHANGE', `Exchange ${exchangeId} → ${status}`),
    validate: (exchangeId: string) => 
      this.info('EXCHANGE', `Validated exchange ${exchangeId}`),
    error: (operation: string, error: any) => 
      this.error('EXCHANGE', `Exchange ${operation} error`, error)
  };

  // Configuration runtime
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  enableInProduction(enable: boolean): void {
    this.config.enabledInProduction = enable;
  }

  enablePerformanceLogging(enable: boolean): void {
    this.config.enablePerformanceLogging = enable;
  }

  enableNetworkLogging(enable: boolean): void {
    this.config.enableNetworkLogging = enable;
  }
}

// Instance singleton
export const logger = new Logger();

// Exports pour compatibilité
export default logger;