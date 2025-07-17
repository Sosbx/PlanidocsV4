import { createParisDate } from '@/utils/timezoneUtils';

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
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }
  
  show(message: string, type: FeedbackType, duration: number = 4000) {
    const container = this.ensureContainer();
    const id = Date.now().toString();
    
    const toast = document.createElement('div');
    const { bgColor, textColor, borderColor } = this.getColors(type);
    
    toast.style.cssText = `
      margin-bottom: 10px;
      padding: 12px 16px;
      padding-right: 48px;
      border-radius: 8px;
      background-color: ${bgColor};
      color: ${textColor};
      border: 1px solid ${borderColor};
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      backdrop-filter: blur(4px);
      min-width: 300px;
      max-width: 500px;
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // Ajouter l'icône
    const icon = document.createElement('span');
    icon.innerHTML = this.getIcon(type);
    icon.style.cssText = `
      display: flex;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      color: ${this.getIconColor(type)};
    `;
    
    // Ajouter le texte
    const text = document.createElement('span');
    text.innerHTML = message;
    text.style.cssText = `
      flex: 1;
    `;
    
    // Ajouter le bouton de fermeture
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: ${textColor};
      font-size: 20px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
      padding: 4px;
      border-radius: 4px;
      line-height: 1;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onmouseover = () => closeButton.style.opacity = '1';
    closeButton.onmouseout = () => closeButton.style.opacity = '0.7';
    closeButton.onclick = (e) => {
      e.stopPropagation();
      this.dismiss(id);
    };
    
    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeButton);
    
    // Animation d'entrée (fade in)
    toast.style.opacity = '0';
    container.appendChild(toast);
    this.toasts.set(id, toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
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
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 200); // Même durée que l'animation toast-fade-out
    }
  }
  
  private getIcon(type: FeedbackType): string {
    switch (type) {
      case 'success':
        // CheckCircle icon
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      case 'error':
        // AlertCircle icon
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      case 'info':
        // Info icon
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
      case 'warning':
        // AlertTriangle icon
        return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      default:
        return '';
    }
  }
  
  private getIconColor(type: FeedbackType): string {
    switch (type) {
      case 'success': return '#16a34a'; // green-600
      case 'error': return '#dc2626'; // red-600
      case 'info': return '#2563eb'; // blue-600
      case 'warning': return '#d97706'; // amber-600
      default: return '#6b7280'; // gray-500
    }
  }
  
  private getColors(type: FeedbackType): { bgColor: string; textColor: string; borderColor: string } {
    switch (type) {
      case 'success': 
        return {
          bgColor: '#f0fdf4', // green-50
          textColor: '#166534', // green-800
          borderColor: 'rgba(34, 197, 94, 0.2)' // green-500 with opacity
        };
      case 'error': 
        return {
          bgColor: '#fef2f2', // red-50
          textColor: '#991b1b', // red-800
          borderColor: 'rgba(239, 68, 68, 0.2)' // red-500 with opacity
        };
      case 'info': 
        return {
          bgColor: '#eff6ff', // blue-50
          textColor: '#1e40af', // blue-800
          borderColor: 'rgba(59, 130, 246, 0.2)' // blue-500 with opacity
        };
      case 'warning': 
        return {
          bgColor: '#fffbeb', // amber-50
          textColor: '#92400e', // amber-800
          borderColor: 'rgba(245, 158, 11, 0.2)' // amber-500 with opacity
        };
      default: 
        return {
          bgColor: '#f9fafb', // gray-50
          textColor: '#1f2937', // gray-800
          borderColor: 'rgba(107, 114, 128, 0.2)' // gray-500 with opacity
        };
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
      timestamp: createParisDate().toISOString()
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