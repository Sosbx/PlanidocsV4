import React, { useState, useEffect, useRef } from 'react';
import { SkeletonBase } from '../skeleton';

/**
 * Props pour le composant LazyImage
 */
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  skeletonClassName?: string;
  intersectionOptions?: IntersectionObserverInit;
}

/**
 * Composant d'image avec chargement lazy et skeleton
 * Optimise les performances en chargeant les images seulement quand elles sont visibles
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallback,
  placeholder,
  onLoad,
  onError,
  className = '',
  skeletonClassName = '',
  intersectionOptions = {
    threshold: 0.1,
    rootMargin: '50px'
  },
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Observer d'intersection pour le lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      intersectionOptions
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [intersectionOptions]);

  // Gérer le chargement de l'image
  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      onError?.();
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src, onLoad, onError]);

  // Rendu du placeholder par défaut
  const defaultPlaceholder = (
    <SkeletonBase
      variant="rectangular"
      className={`bg-gray-200 ${skeletonClassName}`}
      animation="pulse"
    />
  );

  // Rendu de l'image d'erreur
  if (hasError) {
    if (fallback) {
      return (
        <img
          ref={imgRef}
          src={fallback}
          alt={alt}
          className={className}
          {...props}
        />
      );
    }
    
    return (
      <div 
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-100 text-gray-400 text-sm ${className}`}
        {...props}
      >
        Image non disponible
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Placeholder pendant le chargement */}
      {!isLoaded && (
        <div className={`absolute inset-0 ${className}`}>
          {placeholder || defaultPlaceholder}
        </div>
      )}

      {/* Image réelle */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;