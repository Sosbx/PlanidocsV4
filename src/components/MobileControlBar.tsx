import React, { memo } from 'react';
import { Save } from 'lucide-react';

interface MobileControlBarProps {
  activeDesiderata: 'primary' | 'secondary' | null;
  setActiveDesiderata: (type: 'primary' | 'secondary' | null) => void;
  primaryPercentage: number;
  secondaryPercentage: number;
  primaryLimit: number; // Utilisé pour afficher les limites dans l'interface
  secondaryLimit: number; // Utilisé pour afficher les limites dans l'interface
  isDeadlineExpired: boolean;
  isSaving: boolean;
  isValidated: boolean;
  onValidate: () => void;
}

const MobileControlBar = memo<MobileControlBarProps>(({
  activeDesiderata,
  setActiveDesiderata,
  primaryPercentage,
  secondaryPercentage,
  primaryLimit,
  secondaryLimit,
  isDeadlineExpired,
  isSaving,
  isValidated,
  onValidate
}) => {
  const handleTypeClick = React.useCallback((type: 'primary' | 'secondary') => {
    setActiveDesiderata(activeDesiderata === type ? null : type);
  }, [activeDesiderata, setActiveDesiderata]);

  const isDisabled = isDeadlineExpired || isSaving;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-200/50 shadow-lg py-2 px-3 flex items-center justify-between md:hidden">
      <div className="flex gap-2 items-center w-2/3">
        <button
          type="button"
          onClick={() => handleTypeClick('primary')}
          disabled={isDisabled}
          className={`flex items-center justify-center px-3 py-1.5 rounded-md text-base font-medium transition-colors flex-1
            ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
            activeDesiderata === 'primary' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-600'}`}
          title="Desiderata Primaire"
        >
          <span className="font-serif font-bold text-lg">I</span>
          <sup className="text-[11px]">R</sup>
          <span className="ml-1 text-sm" title={`${primaryPercentage.toFixed(1)}% / ${primaryLimit}%`}>
            {primaryPercentage.toFixed(1)}%
            <span className="text-[10px]">/{primaryLimit}%</span>
          </span>
        </button>
        
        <button
          type="button"
          onClick={() => handleTypeClick('secondary')}
          disabled={isDisabled}
          className={`flex items-center justify-center px-3 py-1.5 rounded-md text-base font-medium transition-colors flex-1
            ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
            activeDesiderata === 'secondary' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600'}`}
          title="Desiderata Secondaire"
        >
          <span className="font-serif font-bold text-lg">II</span>
          <sup className="text-[11px]">R</sup>
          <span className="ml-1 text-sm" title={`${secondaryPercentage.toFixed(1)}% / ${secondaryLimit}%`}>
            {secondaryPercentage.toFixed(1)}%
            <span className="text-[10px]">/{secondaryLimit}%</span>
          </span>
        </button>
      </div>
      
      <button 
        onClick={onValidate}
        disabled={isDisabled}
        className={`flex items-center justify-center px-4 py-1.5 border border-transparent text-base font-medium rounded-md text-white ${
          isValidated ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title={isValidated ? "Mettre à jour les desiderata" : "Valider les desiderata"}
      >
        <Save className="h-5 w-5" />
      </button>
    </div>
  );
});

MobileControlBar.displayName = 'MobileControlBar';

export default MobileControlBar;
