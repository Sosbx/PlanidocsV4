import React, { memo } from 'react';
import { Percent, RotateCcw } from 'lucide-react';

interface DesiderataControlsProps {
  activeDesiderata: 'primary' | 'secondary' | null;
  setActiveDesiderata: (type: 'primary' | 'secondary' | null) => void;
  primaryPercentage: number;
  secondaryPercentage: number;
  primaryLimit: number;
  secondaryLimit: number;
  isDeadlineExpired?: boolean;
  isSaving?: boolean;
  onReset: () => void;
}

const DesiderataControls = memo<DesiderataControlsProps>(({
  activeDesiderata,
  setActiveDesiderata,
  primaryPercentage,
  secondaryPercentage,
  primaryLimit,
  secondaryLimit,
  isDeadlineExpired = false,
  isSaving = false,
  onReset,
}) => {
  const handleTypeClick = React.useCallback((type: 'primary' | 'secondary') => {
    setActiveDesiderata(activeDesiderata === type ? null : type);
  }, [activeDesiderata, setActiveDesiderata]);
  
  const handleReset = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser tous vos desiderata ? Cette action est irréversible.')) {
      onReset();
    }
  }, [onReset]);

  const isDisabled = isDeadlineExpired || isSaving;

  return (
    <div className="sticky top-16 bg-white z-40 p-2 sm:p-4 shadow-md rounded-md mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="flex gap-2 flex-1 flex-wrap">
            <button
              type="button"
              onClick={() => handleTypeClick('primary')}
              data-tutorial="desiderata-primary"
              disabled={isDisabled}
              className={`flex-1 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
                activeDesiderata === 'primary' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'}`}
            >
              <span className="hidden sm:inline">Desiderata </span>Primaire
            </button>
            
            <button
              type="button"
              onClick={() => handleTypeClick('secondary')}
              data-tutorial="desiderata-secondary"
              disabled={isDisabled}
              className={`flex-1 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
                activeDesiderata === 'secondary' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'}`}
            >
              <span className="hidden sm:inline">Desiderata </span>Secondaire
            </button>
          </div>          
        </div>
        
        <div className="flex flex-wrap gap-2 text-sm" data-tutorial="percentages">
          <div className="flex-1 flex items-center gap-1 sm:gap-2 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md">
            <Percent className="h-4 w-4 text-red-600 shrink-0" aria-label="Pourcentage primaire" />
            <span>
              P: <span className={`font-bold ${primaryPercentage > primaryLimit ? 'text-red-600' : ''}`}>
                {primaryPercentage.toFixed(1)}%
              </span>
              /{primaryLimit}%
            </span>
          </div>
          <div className="flex-1 flex items-center gap-1 sm:gap-2 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md">
            <Percent className="h-4 w-4 text-blue-600 shrink-0" aria-label="Pourcentage secondaire" />
            <span>
              S: <span className={`font-bold ${secondaryPercentage > secondaryLimit ? 'text-red-600' : ''}`}>
                {secondaryPercentage.toFixed(1)}%
              </span>
              /{secondaryLimit}%
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={isDisabled}
            className={`flex items-center justify-center gap-2 p-2 sm:px-3 sm:py-2 rounded-md transition-colors whitespace-nowrap
              ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' : 
              'text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300'}`}
            title="Réinitialiser les desiderata"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-label="Réinitialiser" />
            <span className="hidden sm:inline text-sm">Réinitialiser</span>
          </button>
        </div>
      </div>
    </div>
  );
});

DesiderataControls.displayName = 'DesiderataControls';

export default DesiderataControls;