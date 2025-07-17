import React from 'react';

/**
 * Props pour le composant Skeleton de base
 */
interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  children?: React.ReactNode;
}

/**
 * Composant Skeleton de base pour les états de chargement
 * Fournit une animation de placeholder pendant le chargement des données
 */
export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'rectangular',
  animation = 'pulse',
  children
}) => {
  // Classes de base pour le skeleton
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  
  // Classes d'animation
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: ''
  };
  
  // Classes de variante
  const variantClasses = {
    text: 'rounded-sm',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  };
  
  // Style inline pour les dimensions
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };
  
  // Classes finales
  const finalClasses = [
    baseClasses,
    animationClasses[animation],
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div 
      className={finalClasses}
      style={style}
      role="status" 
      aria-label="Chargement en cours..."
    >
      {children}
      <span className="sr-only">Chargement en cours...</span>
    </div>
  );
};

export default SkeletonBase;