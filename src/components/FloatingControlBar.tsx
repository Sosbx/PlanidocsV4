import React, { memo, useEffect, useState } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';

interface FloatingControlBarProps {
  activeDesiderata: 'primary' | 'secondary' | null;
  setActiveDesiderata: (type: 'primary' | 'secondary' | null) => void;
  primaryPercentage: number;
  secondaryPercentage: number;
  primaryLimit?: number;
  secondaryLimit?: number;
  isDeadlineExpired?: boolean;
  isSaving?: boolean;
  isValidated?: boolean;
  onValidate: () => void;
  isVisible: boolean;
}

const FloatingControlBar = memo<FloatingControlBarProps>(({
  activeDesiderata,
  setActiveDesiderata,
  primaryPercentage,
  secondaryPercentage,
  primaryLimit = 15,
  secondaryLimit = 10,
  isDeadlineExpired = false,
  isSaving = false,
  isValidated = false,
  onValidate,
  isVisible
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);
  
  const handleTypeClick = React.useCallback((type: 'primary' | 'secondary') => {
    setActiveDesiderata(activeDesiderata === type ? null : type);
  }, [activeDesiderata, setActiveDesiderata]);

  const isDisabled = isDeadlineExpired || isSaving;

  if (!isVisible && !isAnimating) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        <div className="bg-white rounded-b-lg shadow-lg border border-gray-200 border-t-0 p-2 sm:p-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Container pour les boutons de désidérata - 2/3 de la largeur sur mobile */}
            <div className="flex gap-2 w-2/3 sm:w-auto">
              {/* Bouton Désidérata Primaire */}
              <button
                type="button"
                onClick={() => handleTypeClick('primary')}
                disabled={isDisabled}
                className={`group flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
                  activeDesiderata === 'primary' 
                    ? 'bg-red-600 text-white shadow-md transform scale-105' 
                    : 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 hover:shadow-md'
                }`}
                title="Sélectionner les désidérata primaires"
                aria-label={`Désidérata primaires - ${primaryPercentage.toFixed(1)}%`}
              >
                <span className="text-base sm:text-lg font-bold">I</span>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] sm:text-xs opacity-90 hidden sm:block">Primaire</span>
                  <span className="text-xs sm:text-sm font-semibold">{primaryPercentage.toFixed(1)}%</span>
                </div>
              </button>
              
              {/* Bouton Désidérata Secondaire */}
              <button
                type="button"
                onClick={() => handleTypeClick('secondary')}
                disabled={isDisabled}
                className={`group flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' :
                  activeDesiderata === 'secondary' 
                    ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                    : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50 hover:shadow-md'
                }`}
                title="Sélectionner les désidérata secondaires"
                aria-label={`Désidérata secondaires - ${secondaryPercentage.toFixed(1)}%`}
              >
                <span className="text-base sm:text-lg font-bold">II</span>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] sm:text-xs opacity-90 hidden sm:block">Secondaire</span>
                  <span className="text-xs sm:text-sm font-semibold">{secondaryPercentage.toFixed(1)}%</span>
                </div>
              </button>
            </div>
            
            {/* Séparateur vertical */}
            <div className="h-10 w-px bg-gray-300 mx-2 hidden sm:block" />
            
            {/* Bouton de validation */}
            <button
              type="button"
              onClick={onValidate}
              disabled={isDisabled}
              className={`w-1/6 sm:w-auto sm:flex-none ml-auto flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 ${
                isDisabled 
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500' 
                  : isValidated 
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-md' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
              }`}
              title={isValidated ? "Désidérata validés" : "Valider et envoyer les désidérata"}
              aria-label={isSaving ? "Validation en cours..." : isValidated ? "Désidérata validés" : "Valider les désidérata"}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent" />
                  <span className="hidden sm:inline">Validation...</span>
                </>
              ) : isValidated ? (
                <>
                  <Check className="h-5 w-5 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Validé</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Valider</span>
                </>
              )}
            </button>
            
            {/* Indicateur de deadline expiré */}
            {isDeadlineExpired && (
              <div className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Délai expiré</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

FloatingControlBar.displayName = 'FloatingControlBar';

export default FloatingControlBar;
