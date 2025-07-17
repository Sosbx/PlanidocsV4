import { lazy, ComponentType } from 'react';

/**
 * Wrapper pour lazy() qui ajoute la capacité de précharger
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const Component = lazy(factory);
  
  // Ajouter une méthode de préchargement
  (Component as any).preload = factory;
  
  return Component;
}

/**
 * Précharge un composant après un délai
 */
export function preloadComponent(
  component: any,
  delay: number = 1000
) {
  setTimeout(() => {
    if (component.preload) {
      component.preload();
    }
  }, delay);
}