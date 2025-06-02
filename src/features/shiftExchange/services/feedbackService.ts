/**
 * Service de feedback et monitoring pour la bourse aux gardes
 * Centralise la gestion des messages utilisateur et le tracking des erreurs
 */

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackOptions {
  duration?: number;
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
  autoClose?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Configuration par défaut des toasts
 */
const DEFAULT_OPTIONS: FeedbackOptions = {
  duration: 4000,
  position: 'top-right',
  autoClose: true
};

/**
 * Messages prédéfinis pour les actions courantes
 */
export const FEEDBACK_MESSAGES = {
  // Succès
  INTEREST_ADDED: 'Votre intérêt a été enregistré',
  INTEREST_REMOVED: 'Votre intérêt a été retiré',
  EXCHANGE_VALIDATED: 'Échange validé avec succès',
  EXCHANGE_REJECTED: 'Échange rejeté',
  CONFIG_UPDATED: 'Configuration mise à jour',
  
  // Erreurs
  NETWORK_ERROR: 'Erreur de connexion. Vérifiez votre connexion internet.',
  PERMISSION_DENIED: 'Vous n\'avez pas les droits nécessaires',
  EXCHANGE_NOT_FOUND: 'Échange introuvable',
  PHASE_INCORRECT: 'Action impossible dans la phase actuelle',
  CONFLICT_EXISTS: 'Vous avez déjà une garde à cette période',
  
  // Info
  PHASE_SUBMISSION: 'Phase de soumission ouverte',
  PHASE_DISTRIBUTION: 'Phase de distribution en cours',
  PHASE_COMPLETED: 'Bourse aux gardes terminée',
  LOADING: 'Chargement en cours...',
  
  // Warnings
  SUBMISSION_DEADLINE_NEAR: 'La date limite de soumission approche',
  UNSAVED_CHANGES: 'Vous avez des modifications non sauvegardées',
  CONFLICT_WARNING: 'Attention : vous avez déjà une garde ce jour-là'
} as const;

/**
 * Implémentation simple de toast sans dépendance externe
 * À remplacer par une vraie librairie de toast en production
 */
class SimpleToast {
  private container: HTMLDivElement | null = null;
  private toasts: Map<string, HTMLDivElement> = new Map();
  
  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }
  
  show(message: string, type: FeedbackType, duration: number = 4000) {
    const container = this.ensureContainer();
    const id = Date.now().toString();
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      margin-bottom: 10px;
      padding: 16px 24px;
      border-radius: 8px;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      background-color: ${this.getColor(type)};
    `;
    
    toast.textContent = message;
    toast.onclick = () => this.dismiss(id);
    
    container.appendChild(toast);
    this.toasts.set(id, toast);
    
    // Animation d'entrée
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    
    return id;
  }
  
  dismiss(id?: string) {
    if (!id) {
      // Dismiss all
      this.toasts.forEach((_, toastId) => this.dismiss(toastId));
      return;
    }
    
    const toast = this.toasts.get(id);
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 300);
    }
  }
  
  private getColor(type: FeedbackType): string {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'info': return '#3b82f6';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  }
}

const simpleToast = new SimpleToast();

/**
 * Classe principale du service de feedback
 */
class FeedbackService {
  private static instance: FeedbackService;
  private queue: Array<{ message: string; type: FeedbackType; options?: FeedbackOptions }> = [];
  private isProcessing = false;

  private constructor() {}

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  /**
   * Affiche un message de succès
   */
  success(message: string, options?: FeedbackOptions) {
    this.show(message, 'success', options);
  }

  /**
   * Affiche un message d'erreur
   */
  error(message: string | Error, options?: FeedbackOptions) {
    const errorMessage = message instanceof Error ? this.formatError(message) : message;
    this.show(errorMessage, 'error', { ...options, duration: 6000 });
    
    // Logger l'erreur
    if (message instanceof Error) {
      this.logError(message);
    }
  }

  /**
   * Affiche un message d'information
   */
  info(message: string, options?: FeedbackOptions) {
    this.show(message, 'info', options);
  }

  /**
   * Affiche un message d'avertissement
   */
  warning(message: string, options?: FeedbackOptions) {
    this.show(message, 'warning', options);
  }

  /**
   * Affiche un message de chargement
   */
  loading(message: string = FEEDBACK_MESSAGES.LOADING) {
    const id = simpleToast.show(message, 'info', 0);
    return {
      success: (successMessage: string) => {
        simpleToast.dismiss(id);
        this.success(successMessage);
      },
      error: (errorMessage: string) => {
        simpleToast.dismiss(id);
        this.error(errorMessage);
      },
      dismiss: () => simpleToast.dismiss(id)
    };
  }

  /**
   * Affiche un message avec confirmation
   */
  confirm(message: string, onConfirm: () => void, onCancel?: () => void) {
    // Utilisation simple de window.confirm pour l'instant
    const confirmMessage = `${message}\n\nCliquez OK pour confirmer.`;
    if (window.confirm(confirmMessage)) {
      onConfirm();
    } else {
      onCancel?.();
    }
  }

  /**
   * Méthode privée pour afficher un message
   */
  private show(message: string, type: FeedbackType, options?: FeedbackOptions) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Ajouter à la queue pour éviter les spams
    this.queue.push({ message, type, options: mergedOptions });
    this.processQueue();
  }

  /**
   * Traite la queue des messages
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const { message, type, options } = this.queue.shift()!;
      
      // Si le même message est déjà affiché, on le skip
      if (this.isDuplicateMessage(message)) {
        continue;
      }
      
      // Afficher le toast
      simpleToast.show(message, type, options?.duration);
      
      // Petit délai entre les messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }

  /**
   * Vérifie si un message est déjà affiché
   */
  private isDuplicateMessage(message: string): boolean {
    // Implémentation simplifiée
    return false;
  }

  /**
   * Formate une erreur pour l'affichage
   */
  private formatError(error: Error): string {
    // Messages d'erreur personnalisés selon le type
    if (error.message.includes('network')) {
      return FEEDBACK_MESSAGES.NETWORK_ERROR;
    }
    if (error.message.includes('permission')) {
      return FEEDBACK_MESSAGES.PERMISSION_DENIED;
    }
    
    // Message par défaut
    return error.message || 'Une erreur est survenue';
  }

  /**
   * Logger une erreur (peut être envoyé à un service de monitoring)
   */
  private logError(error: Error) {
    console.error('[ShiftExchange Error]', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Ici on pourrait envoyer l'erreur à Sentry, LogRocket, etc.
  }

  /**
   * Nettoie tous les toasts actifs
   */
  clearAll() {
    simpleToast.dismiss();
    this.queue = [];
  }
}

// Export de l'instance singleton
export const feedbackService = FeedbackService.getInstance();

// Export des hooks React pour faciliter l'utilisation
export const useFeedback = () => {
  return {
    success: feedbackService.success.bind(feedbackService),
    error: feedbackService.error.bind(feedbackService),
    info: feedbackService.info.bind(feedbackService),
    warning: feedbackService.warning.bind(feedbackService),
    loading: feedbackService.loading.bind(feedbackService),
    confirm: feedbackService.confirm.bind(feedbackService),
    clear: feedbackService.clearAll.bind(feedbackService)
  };
};