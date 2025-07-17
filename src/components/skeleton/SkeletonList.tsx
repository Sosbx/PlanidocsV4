import React from 'react';
import SkeletonBase from './SkeletonBase';

/**
 * Props pour le skeleton de liste
 */
interface SkeletonListProps {
  items?: number;
  showAvatar?: boolean;
  showActions?: boolean;
  variant?: 'simple' | 'detailed' | 'compact';
  className?: string;
}

/**
 * Composant Skeleton pour les listes
 * Simule différents types de listes pendant le chargement
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 5,
  showAvatar = false,
  showActions = false,
  variant = 'simple',
  className = ''
}) => {
  const renderListItem = (index: number) => {
    switch (variant) {
      case 'compact':
        return (
          <div key={`item-${index}`} className="flex items-center justify-between py-2 px-3">
            <div className="flex items-center space-x-3 flex-1">
              {showAvatar && (
                <SkeletonBase width="2rem" height="2rem" variant="circular" />
              )}
              <SkeletonBase height="1rem" width="60%" variant="text" />
            </div>
            {showActions && (
              <SkeletonBase width="3rem" height="1.5rem" variant="rectangular" />
            )}
          </div>
        );
        
      case 'detailed':
        return (
          <div key={`item-${index}`} className="p-4 space-y-3">
            <div className="flex items-start space-x-3">
              {showAvatar && (
                <SkeletonBase width="3rem" height="3rem" variant="circular" />
              )}
              <div className="flex-1 space-y-2">
                <SkeletonBase height="1.25rem" width="70%" variant="text" />
                <SkeletonBase height="1rem" width="50%" variant="text" className="bg-gray-300" />
                <div className="space-y-1">
                  <SkeletonBase height="0.875rem" width="90%" variant="text" />
                  <SkeletonBase height="0.875rem" width="75%" variant="text" />
                </div>
              </div>
            </div>
            {showActions && (
              <div className="flex justify-end space-x-2">
                <SkeletonBase width="4rem" height="2rem" variant="rectangular" />
                <SkeletonBase width="4rem" height="2rem" variant="rectangular" />
              </div>
            )}
          </div>
        );
        
      default: // simple
        return (
          <div key={`item-${index}`} className="flex items-center justify-between py-3 px-3">
            <div className="flex items-center space-x-3 flex-1">
              {showAvatar && (
                <SkeletonBase width="2.5rem" height="2.5rem" variant="circular" />
              )}
              <div className="flex-1 space-y-2">
                <SkeletonBase height="1rem" width="65%" variant="text" />
                <SkeletonBase height="0.875rem" width="45%" variant="text" className="bg-gray-300" />
              </div>
            </div>
            {showActions && (
              <SkeletonBase width="3.5rem" height="2rem" variant="rectangular" />
            )}
          </div>
        );
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 ${className}`}>
      {Array.from({ length: items }).map((_, index) => renderListItem(index))}
    </div>
  );
};

export default SkeletonList;