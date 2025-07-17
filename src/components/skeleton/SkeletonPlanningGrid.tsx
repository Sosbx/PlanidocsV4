import React from 'react';
import SkeletonBase from './SkeletonBase';

/**
 * Props pour le skeleton de grille de planning
 */
interface SkeletonPlanningGridProps {
  days?: number;
  periods?: string[];
  showMonthHeader?: boolean;
  className?: string;
}

/**
 * Composant Skeleton spécialisé pour les grilles de planning
 * Simule la structure du planning pendant le chargement
 */
export const SkeletonPlanningGrid: React.FC<SkeletonPlanningGridProps> = ({
  days = 15,
  periods = ['M', 'AM', 'S'],
  showMonthHeader = true,
  className = ''
}) => {
  return (
    <div className={`inline-block align-top mr-4 mb-4 ${className}`}>
      <div className="border border-gray-200 bg-white rounded-lg overflow-hidden" style={{ tableLayout: 'fixed' }}>
        {/* En-tête du mois */}
        {showMonthHeader && (
          <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-200">
            <SkeletonBase
              width="8rem"
              height="1.25rem"
              variant="text"
              className="bg-gray-300 mx-auto"
            />
          </div>
        )}
        
        {/* En-tête des colonnes */}
        <div className="bg-gray-50/70 border-b border-gray-200 p-2">
          <div className="grid grid-cols-4 gap-2">
            <SkeletonBase height="1rem" variant="text" className="bg-gray-300" />
            {periods.map((period, index) => (
              <SkeletonBase 
                key={`period-${index}`}
                height="1rem" 
                variant="text" 
                className="bg-gray-300"
              />
            ))}
          </div>
        </div>
        
        {/* Lignes de jours */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: days }).map((_, dayIndex) => (
            <div key={`day-${dayIndex}`} className="grid grid-cols-4 gap-2 p-2">
              {/* Colonne du jour */}
              <div className="flex items-center space-x-2">
                <SkeletonBase
                  width="1.5rem"
                  height="1rem"
                  variant="text"
                  className="bg-gray-300"
                />
                <SkeletonBase
                  width="1rem"
                  height="0.75rem"
                  variant="text"
                  className="bg-gray-200"
                />
              </div>
              
              {/* Cellules des périodes */}
              {periods.map((_, periodIndex) => (
                <div key={`cell-${dayIndex}-${periodIndex}`} className="relative">
                  <SkeletonBase
                    height="2.5rem"
                    variant="rectangular"
                    className="border border-gray-200"
                  />
                  
                  {/* Badge simulé de façon aléatoire */}
                  {Math.random() > 0.7 && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1">
                      <SkeletonBase
                        width="0.75rem"
                        height="0.75rem"
                        variant="circular"
                        className="bg-blue-300"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonPlanningGrid;