import React from 'react';
import SkeletonBase from './SkeletonBase';

/**
 * Props pour le skeleton de carte
 */
interface SkeletonCardProps {
  showAvatar?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showActions?: boolean;
  lines?: number;
  className?: string;
}

/**
 * Composant Skeleton pour les cartes
 * Simule la structure d'une carte pendant le chargement
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showAvatar = false,
  showTitle = true,
  showSubtitle = false,
  showActions = false,
  lines = 3,
  className = ''
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* En-tête avec avatar et titre */}
      <div className="flex items-start space-x-3 mb-4">
        {showAvatar && (
          <SkeletonBase
            width="2.5rem"
            height="2.5rem"
            variant="circular"
          />
        )}
        <div className="flex-1 space-y-2">
          {showTitle && (
            <SkeletonBase
              height="1.25rem"
              width="60%"
              variant="text"
            />
          )}
          {showSubtitle && (
            <SkeletonBase
              height="1rem"
              width="40%"
              variant="text"
              className="bg-gray-300"
            />
          )}
        </div>
      </div>
      
      {/* Contenu principal */}
      <div className="space-y-2 mb-4">
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBase
            key={`line-${index}`}
            height="1rem"
            width={index === lines - 1 ? '75%' : '100%'}
            variant="text"
          />
        ))}
      </div>
      
      {/* Actions */}
      {showActions && (
        <div className="flex justify-end space-x-2">
          <SkeletonBase
            width="4rem"
            height="2rem"
            variant="rectangular"
            className="bg-gray-300"
          />
          <SkeletonBase
            width="4rem"
            height="2rem"
            variant="rectangular"
            className="bg-gray-300"
          />
        </div>
      )}
    </div>
  );
};

export default SkeletonCard;