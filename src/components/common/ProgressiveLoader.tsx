import React, { useState, useEffect } from 'react';
import { SkeletonBase } from '../skeleton';

/**
 * Props pour le loader progressif
 */
interface ProgressiveLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
  minDuration?: number;
  className?: string;
  showProgress?: boolean;
}

/**
 * Composant de chargement progressif
 * Évite les flashs de contenu et améliore l'expérience utilisateur
 */
export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  isLoading,
  children,
  fallback,
  delay = 200,
  minDuration = 500,
  className = '',
  showProgress = false
}) => {
  const [showLoader, setShowLoader] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Gérer l'affichage du loader avec délai
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isLoading) {
      setStartTime(Date.now());
      
      // Délai avant d'afficher le loader
      timeoutId = setTimeout(() => {
        setShowLoader(true);
      }, delay);
    } else {
      // Vérifier la durée minimale
      if (startTime) {
        const elapsed = Date.now() - startTime;
        if (elapsed < minDuration) {
          // Attendre le temps minimum
          timeoutId = setTimeout(() => {
            setShowLoader(false);
            setProgress(0);
          }, minDuration - elapsed);
        } else {
          setShowLoader(false);
          setProgress(0);
        }
      } else {
        setShowLoader(false);
        setProgress(0);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay, minDuration, startTime]);

  // Animation de progression simulée
  useEffect(() => {
    if (showLoader && showProgress) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev; // Plafonner à 90% jusqu'au vrai chargement
          return prev + Math.random() * 10;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [showLoader, showProgress]);

  // Finaliser la progression quand le chargement est terminé
  useEffect(() => {
    if (!isLoading && showProgress) {
      setProgress(100);
    }
  }, [isLoading, showProgress]);

  // Fallback par défaut
  const defaultFallback = (
    <div className="space-y-4">
      {showProgress && (
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div className="space-y-3">
        <SkeletonBase height="2rem" width="60%" variant="text" />
        <SkeletonBase height="1rem" width="80%" variant="text" />
        <SkeletonBase height="1rem" width="70%" variant="text" />
      </div>
    </div>
  );

  if (showLoader) {
    return (
      <div className={`transition-opacity duration-300 ${className}`}>
        {fallback || defaultFallback}
      </div>
    );
  }

  return (
    <div className={`transition-opacity duration-300 ${className}`}>
      {children}
    </div>
  );
};

export default ProgressiveLoader;