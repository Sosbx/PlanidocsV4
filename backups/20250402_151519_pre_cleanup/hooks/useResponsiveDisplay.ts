import { useState, useEffect } from 'react';

export enum ScreenSize {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  LARGE = 'large'
}

export interface ResponsiveConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  large: number;
}

const defaultBreakpoints: ResponsiveConfig = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  large: 1440
};

/**
 * Hook pour la gestion réactive de l'affichage en fonction de la taille d'écran
 * @param customBreakpoints Configuration personnalisée des points de rupture
 * @returns Un objet contenant la taille d'écran actuelle et des méthodes utilitaires
 */
const useResponsiveDisplay = (customBreakpoints?: Partial<ResponsiveConfig>) => {
  // Combiner les points de rupture par défaut avec les points personnalisés
  const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };
  
  // État pour suivre la taille d'écran actuelle
  const [screenSize, setScreenSize] = useState<ScreenSize>(ScreenSize.DESKTOP);
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  // Effet pour mettre à jour la taille d'écran lors du redimensionnement
  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      setWidth(currentWidth);
      
      if (currentWidth < breakpoints.mobile) {
        setScreenSize(ScreenSize.MOBILE);
      } else if (currentWidth < breakpoints.tablet) {
        setScreenSize(ScreenSize.TABLET);
      } else if (currentWidth < breakpoints.desktop) {
        setScreenSize(ScreenSize.DESKTOP);
      } else {
        setScreenSize(ScreenSize.LARGE);
      }
    };
    
    // Initialiser avec la taille actuelle
    handleResize();
    
    // Ajouter l'écouteur d'événement avec une technique de debounce simple
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };
    
    window.addEventListener('resize', debouncedResize);
    
    // Nettoyage
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [breakpoints]);
  
  // Méthodes utilitaires pour vérifier facilement la taille d'écran
  const isMobile = screenSize === ScreenSize.MOBILE;
  const isTablet = screenSize === ScreenSize.TABLET;
  const isDesktop = screenSize === ScreenSize.DESKTOP || screenSize === ScreenSize.LARGE;
  const isLarge = screenSize === ScreenSize.LARGE;
  
  // Helper pour déterminer les styles/classes en fonction de la taille d'écran
  const getResponsiveValue = <T,>(
    options: { 
      mobile?: T;
      tablet?: T;
      desktop?: T;
      large?: T;
      default: T;
    }
  ): T => {
    switch (screenSize) {
      case ScreenSize.MOBILE:
        return options.mobile ?? options.default;
      case ScreenSize.TABLET:
        return options.tablet ?? options.default;
      case ScreenSize.DESKTOP:
        return options.desktop ?? options.default;
      case ScreenSize.LARGE:
        return options.large ?? options.desktop ?? options.default;
      default:
        return options.default;
    }
  };
  
  return {
    screenSize,
    width,
    isMobile,
    isTablet,
    isDesktop,
    isLarge,
    getResponsiveValue
  };
};

export default useResponsiveDisplay;