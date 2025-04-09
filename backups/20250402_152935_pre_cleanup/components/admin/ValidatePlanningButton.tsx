import React, { useState } from 'react';
import { validateBagPlanning } from '../../lib/firebase/planningValidation';
import { useBagPhase } from '../../context/shiftExchange';

interface ValidatePlanningButtonProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

/**
 * Bouton pour valider le planning après la phase 3 de la bourse aux gardes
 * Ce bouton n'apparaît que si la phase est "completed" et que le planning n'est pas encore validé
 */
const ValidatePlanningButton: React.FC<ValidatePlanningButtonProps> = ({
  onSuccess,
  onError
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const { config: bagPhaseConfig } = useBagPhase();
  
  const handleValidatePlanning = async () => {
    try {
      setIsValidating(true);
      await validateBagPlanning();
      
      if (onSuccess) {
        onSuccess('Le planning a été validé avec succès');
      }
    } catch (error) {
      console.error('Error validating planning:', error);
      
      if (onError) {
        onError(`Erreur lors de la validation du planning: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    } finally {
      setIsValidating(false);
    }
  };
  
  // N'afficher le bouton que si la phase est "completed" et que le planning n'est pas encore validé
  if (bagPhaseConfig.phase !== 'completed' || bagPhaseConfig.isValidated) {
    return null;
  }
  
  return (
    <button
      onClick={handleValidatePlanning}
      disabled={isValidating}
      className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
        isValidating
          ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
          : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
      }`}
    >
      {isValidating ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Validation en cours...
        </>
      ) : (
        'Valider le planning'
      )}
    </button>
  );
};

export default ValidatePlanningButton;
