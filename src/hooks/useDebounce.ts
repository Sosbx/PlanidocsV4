import { useCallback, useRef } from 'react';

/**
 * Hook pour créer une fonction debounced qui empêche les appels multiples rapides
 * Particulièrement utile pour prévenir les doubles soumissions
 * 
 * @param callback - La fonction à débouncer
 * @param delay - Le délai en millisecondes (par défaut 1000ms)
 * @returns Une version débouncée de la fonction
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1000
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  return useCallback(
    (...args: Parameters<T>) => {
      // Si une exécution est déjà en cours, on ignore l'appel
      if (isExecutingRef.current) {
        console.log('🔒 Action déjà en cours, appel ignoré');
        return;
      }

      // Annuler le timeout précédent s'il existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Marquer comme en cours d'exécution
      isExecutingRef.current = true;

      // Exécuter immédiatement la fonction
      callback(...args);

      // Réinitialiser le flag après le délai
      timeoutRef.current = setTimeout(() => {
        isExecutingRef.current = false;
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Hook pour créer une fonction debounced avec Promise
 * Utile pour les opérations asynchrones comme les appels API
 * 
 * @param callback - La fonction asynchrone à débouncer
 * @param delay - Le délai en millisecondes (par défaut 1000ms)
 * @returns Une version débouncée de la fonction qui retourne une Promise
 */
export function useDebounceAsync<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  delay: number = 1000
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  return useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      // Si une exécution est déjà en cours, on retourne undefined
      if (isExecutingRef.current) {
        console.log('🔒 Action asynchrone déjà en cours, appel ignoré');
        return undefined;
      }

      // Annuler le timeout précédent s'il existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Marquer comme en cours d'exécution
      isExecutingRef.current = true;

      try {
        // Exécuter la fonction asynchrone
        const result = await callback(...args);
        
        // Réinitialiser le flag après le délai
        timeoutRef.current = setTimeout(() => {
          isExecutingRef.current = false;
        }, delay);

        return result;
      } catch (error) {
        // En cas d'erreur, réinitialiser immédiatement
        isExecutingRef.current = false;
        throw error;
      }
    },
    [callback, delay]
  );
}