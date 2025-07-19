import { useRef, useCallback } from 'react';

interface DebouncedActionOptions {
  delay?: number;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook pour éviter les double-clics et les actions multiples
 * Implémente un mécanisme de debounce et de verrouillage
 */
export const useDebouncedAction = <T extends (...args: any[]) => Promise<any>>(
  action: T,
  options: DebouncedActionOptions = {}
) => {
  const { delay = 500, onStart, onComplete, onError } = options;
  const isProcessingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedAction = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    // Si une action est déjà en cours, l'ignorer
    if (isProcessingRef.current) {
      console.log('Action ignorée - Une action est déjà en cours');
      return null;
    }

    // Annuler tout timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    return new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        try {
          // Marquer comme en cours
          isProcessingRef.current = true;
          onStart?.();

          // Exécuter l'action
          const result = await action(...args);
          
          resolve(result);
          onComplete?.();
        } catch (error) {
          console.error('Erreur lors de l\'exécution de l\'action:', error);
          const err = error instanceof Error ? error : new Error(String(error));
          onError?.(err);
          reject(err);
        } finally {
          // Libérer le verrou après un délai
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 300);
        }
      }, delay);
    });
  }, [action, delay, onStart, onComplete, onError]);

  // Fonction pour annuler l'action en attente
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Fonction pour vérifier si une action est en cours
  const isProcessing = useCallback(() => {
    return isProcessingRef.current;
  }, []);

  return {
    debouncedAction,
    cancel,
    isProcessing
  };
};