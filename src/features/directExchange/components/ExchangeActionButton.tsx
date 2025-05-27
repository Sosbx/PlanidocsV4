import { useState } from 'react';
import { useDirectExchangeTransactions } from '../hooks';

interface ExchangeActionButtonProps {
  // Type d'action à effectuer
  actionType: 'accept' | 'reject' | 'cancel';
  
  // ID de l'échange ou de la proposition
  id: string;
  
  // Texte à afficher sur le bouton
  label: string;
  
  // Texte de confirmation
  confirmText?: string;
  
  // Fonction de rappel après l'action
  onComplete?: () => void;
  
  // Classes CSS additionnelles
  className?: string;
}

/**
 * Bouton d'action pour les échanges directs
 * Utilise le nouveau système TransactionService via le hook de compatibilité
 */
export const ExchangeActionButton: React.FC<ExchangeActionButtonProps> = ({
  actionType,
  id,
  label,
  confirmText,
  onComplete,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Utiliser le hook de compatibilité pour accéder aux fonctions du TransactionService
  const { 
    acceptProposal,
    rejectProposal,
    removeExchange
  } = useDirectExchangeTransactions({
    onSuccess: () => {
      setLoading(false);
      setShowConfirm(false);
      onComplete?.();
    },
    onError: () => {
      setLoading(false);
      setShowConfirm(false);
    }
  });
  
  // Action à exécuter en fonction du type
  const executeAction = async () => {
    setLoading(true);
    
    try {
      switch (actionType) {
        case 'accept':
          await acceptProposal(id);
          break;
        case 'reject':
          await rejectProposal(id);
          break;
        case 'cancel':
          await removeExchange(id);
          break;
      }
    } catch (error) {
      console.error('Erreur lors de l\'exécution de l\'action:', error);
      setLoading(false);
    }
  };
  
  // Gestion du clic sur le bouton
  const handleClick = () => {
    if (confirmText && !showConfirm) {
      // Montrer la confirmation si un texte est fourni
      setShowConfirm(true);
    } else {
      // Exécuter l'action directement
      executeAction();
    }
  };
  
  // Gestion du clic sur Annuler
  const handleCancel = () => {
    setShowConfirm(false);
  };
  
  // Définir les classes CSS en fonction du type d'action
  const getButtonClasses = () => {
    let baseClasses = `px-4 py-2 rounded-md transition-colors ${className} `;
    
    if (loading) {
      return baseClasses + 'bg-gray-300 text-gray-700 cursor-not-allowed';
    }
    
    switch (actionType) {
      case 'accept':
        return baseClasses + 'bg-green-600 hover:bg-green-700 text-white';
      case 'reject':
        return baseClasses + 'bg-red-600 hover:bg-red-700 text-white';
      case 'cancel':
        return baseClasses + 'bg-gray-600 hover:bg-gray-700 text-white';
      default:
        return baseClasses + 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };
  
  return (
    <div className="inline-flex">
      {showConfirm ? (
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            onClick={executeAction}
            disabled={loading}
          >
            {loading ? 'En cours...' : 'Confirmer'}
          </button>
          <button
            className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md"
            onClick={handleCancel}
            disabled={loading}
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          className={getButtonClasses()}
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? 'En cours...' : label}
        </button>
      )}
    </div>
  );
};

export default ExchangeActionButton;