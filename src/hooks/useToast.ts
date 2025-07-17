import { useState, useCallback, useRef } from 'react';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  isVisible: boolean;
}

// Durées par type de toast (en millisecondes)
const TOAST_DURATIONS = {
  success: 3000,
  error: 5000,
  info: 3000
};

export const useToast = () => {
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    setToastState(prev => ({ ...prev, isVisible: false }));
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', persist = false) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setToastState({
      message,
      type,
      isVisible: true
    });

    // Démarrer le timeout pour faire disparaître le toast automatiquement
    if (!persist) {
      const duration = TOAST_DURATIONS[type];
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    }
  }, [hideToast]);

  return {
    toastState,
    showToast,
    hideToast
  };
};

// Singleton toast instance for global usage
let globalShowToast: ((message: string, type?: 'success' | 'error' | 'info', persist?: boolean) => void) | null = null;

export const setGlobalToast = (showToastFn: (message: string, type?: 'success' | 'error' | 'info', persist?: boolean) => void) => {
  globalShowToast = showToastFn;
};

export const toast = {
  success: (message: string, persist?: boolean) => globalShowToast?.(message, 'success', persist),
  error: (message: string, persist?: boolean) => globalShowToast?.(message, 'error', persist),
  info: (message: string, persist?: boolean) => globalShowToast?.(message, 'info', persist)
};