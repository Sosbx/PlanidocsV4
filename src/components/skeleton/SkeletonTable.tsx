import React from 'react';
import SkeletonBase from './SkeletonBase';

/**
 * Props pour le skeleton de tableau
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
  cellHeight?: string;
  headerHeight?: string;
}

/**
 * Composant Skeleton pour les tableaux de planning
 * Simule la structure d'un tableau pendant le chargement
 */
export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
  cellHeight = '3rem',
  headerHeight = '2.5rem'
}) => {
  return (
    <div className={`border border-gray-200 bg-white rounded-lg overflow-hidden ${className}`}>
      {/* En-tête du tableau */}
      {showHeader && (
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <SkeletonBase
                key={`header-${index}`}
                height={headerHeight}
                variant="text"
                className="bg-gray-300"
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Corps du tableau */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="grid gap-2 p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonBase
                key={`cell-${rowIndex}-${colIndex}`}
                height={cellHeight}
                variant="rectangular"
                animation="pulse"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonTable;