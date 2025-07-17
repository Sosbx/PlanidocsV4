import React, { Suspense } from 'react';
import { SkeletonBase, SkeletonTable, SkeletonCard, SkeletonList, SkeletonPlanningGrid } from '../skeleton';
import LoadingSpinner from './LoadingSpinner';

/**
 * Types de fallback disponibles
 */
type FallbackType = 
  | 'spinner' 
  | 'table' 
  | 'card' 
  | 'list' 
  | 'planning-grid'
  | 'custom';

/**
 * Props pour le wrapper Suspense
 */
interface SuspenseWrapperProps {
  children: React.ReactNode;
  fallback?: FallbackType;
  fallbackProps?: Record<string, any>;
  customFallback?: React.ReactNode;
  className?: string;
  minHeight?: string;
}

/**
 * Wrapper Suspense avec fallbacks intelligents
 * Fournit des skeletons appropriés selon le contexte
 */
export const SuspenseWrapper: React.FC<SuspenseWrapperProps> = ({
  children,
  fallback = 'spinner',
  fallbackProps = {},
  customFallback,
  className = '',
  minHeight = '200px'
}) => {
  
  const getFallbackComponent = () => {
    if (fallback === 'custom' && customFallback) {
      return customFallback;
    }
    
    const containerStyle = { minHeight };
    const containerClasses = `flex items-center justify-center ${className}`;
    
    switch (fallback) {
      case 'table':
        return (
          <div className={`p-4 ${className}`} style={containerStyle}>
            <SkeletonTable {...fallbackProps} />
          </div>
        );
        
      case 'card':
        return (
          <div className={`p-4 ${className}`} style={containerStyle}>
            <div className="space-y-4">
              {Array.from({ length: fallbackProps.count || 3 }).map((_, index) => (
                <SkeletonCard key={`card-${index}`} {...fallbackProps} />
              ))}
            </div>
          </div>
        );
        
      case 'list':
        return (
          <div className={`p-4 ${className}`} style={containerStyle}>
            <SkeletonList {...fallbackProps} />
          </div>
        );
        
      case 'planning-grid':
        return (
          <div className={`p-4 ${className}`} style={containerStyle}>
            <div className="flex flex-wrap">
              {Array.from({ length: fallbackProps.months || 2 }).map((_, index) => (
                <SkeletonPlanningGrid key={`grid-${index}`} {...fallbackProps} />
              ))}
            </div>
          </div>
        );
        
      default: // spinner
        return (
          <div className={containerClasses} style={containerStyle}>
            <div className="text-center">
              <LoadingSpinner />
              <p className="mt-2 text-sm text-gray-500">Chargement en cours...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={getFallbackComponent()}>
      {children}
    </Suspense>
  );
};

export default SuspenseWrapper;