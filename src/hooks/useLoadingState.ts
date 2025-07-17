import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Options pour le hook de gestion d'état de chargement
 */
interface UseLoadingStateOptions {
  minDuration?: number;
  delayBeforeShow?: number;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
}

/**
 * État de chargement avec métadonnées
 */
interface LoadingState {
  isLoading: boolean;
  isVisible: boolean;
  progress?: number;
  startTime?: number;
  error?: any;
  hasCompleted: boolean;
}

/**
 * Hook pour gérer les états de chargement avec UX optimisée
 * Évite les flashs de contenu et gère les durées minimales
 */
export const useLoadingState = (options: UseLoadingStateOptions = {}) => {
  const {
    minDuration = 300,
    delayBeforeShow = 150,
    onStart,
    onComplete,
    onError
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    isVisible: false,
    hasCompleted: false
  });

  const timeoutRefs = useRef<{
    show?: NodeJS.Timeout;
    hide?: NodeJS.Timeout;
  }>({});

  // Nettoyer les timeouts à la destruction
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const startLoading = useCallback((initialProgress?: number) => {
    // Nettoyer les timeouts existants
    Object.values(timeoutRefs.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    const startTime = Date.now();
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      startTime,
      progress: initialProgress,
      error: undefined,
      hasCompleted: false
    }));

    // Délai avant d'afficher le loader
    timeoutRefs.current.show = setTimeout(() => {
      setState(prev => ({ ...prev, isVisible: true }));
    }, delayBeforeShow);

    onStart?.();
  }, [delayBeforeShow, onStart]);

  const updateProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress))
    }));
  }, []);

  const completeLoading = useCallback(() => {
    setState(prev => {
      const elapsed = prev.startTime ? Date.now() - prev.startTime : 0;
      const remainingTime = Math.max(0, minDuration - elapsed);

      if (remainingTime > 0) {
        // Attendre la durée minimale
        timeoutRefs.current.hide = setTimeout(() => {
          setState(current => ({
            ...current,
            isLoading: false,
            isVisible: false,
            progress: 100,
            hasCompleted: true
          }));
          onComplete?.();
        }, remainingTime);

        return {
          ...prev,
          progress: 100
        };
      } else {
        // Compléter immédiatement
        onComplete?.();
        return {
          ...prev,
          isLoading: false,
          isVisible: false,
          progress: 100,
          hasCompleted: true
        };
      }
    });
  }, [minDuration, onComplete]);

  const setError = useCallback((error: any) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      isVisible: false,
      error,
      hasCompleted: true
    }));
    onError?.(error);
  }, [onError]);

  const reset = useCallback(() => {
    // Nettoyer les timeouts
    Object.values(timeoutRefs.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    setState({
      isLoading: false,
      isVisible: false,
      hasCompleted: false
    });
  }, []);

  return {
    ...state,
    startLoading,
    completeLoading,
    updateProgress,
    setError,
    reset
  };
};

/**
 * Hook pour les opérations asynchrones avec état de chargement
 */
export const useAsyncOperation = <T = any>(
  operation: () => Promise<T>,
  options: UseLoadingStateOptions = {}
) => {
  const loadingState = useLoadingState(options);

  const execute = useCallback(async (): Promise<T> => {
    try {
      loadingState.startLoading();
      const result = await operation();
      loadingState.completeLoading();
      return result;
    } catch (error) {
      loadingState.setError(error);
      throw error;
    }
  }, [operation, loadingState]);

  return {
    ...loadingState,
    execute
  };
};

export default useLoadingState;