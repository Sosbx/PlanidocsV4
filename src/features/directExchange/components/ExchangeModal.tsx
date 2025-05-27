import React, { useState, useEffect } from 'react';
import { X, Repeat, Gift, Users } from 'lucide-react';
import type { ShiftAssignment } from '../../planning/types';
import '../../../styles/BadgeStyles.css';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string, operationTypes: Array<'exchange' | 'give' | 'replacement' | 'both'>) => void;
  onRemove?: () => void; // Nouvelle prop pour gérer la suppression de la garde
  initialComment?: string;
  position?: { x: number; y: number };
  assignment?: ShiftAssignment;
  exchangeType?: 'direct' | 'bag';
  showReplacementOption?: boolean;
  operationTypes?: string[];
  existingExchangeId?: string;
  allOptionsSelected?: boolean; // Indique si toutes les options sont déjà sélectionnées
}

/**
 * Modal pour proposer un échange direct
 */
const ExchangeModal: React.FC<ExchangeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onRemove,
  initialComment = '',
  // La position n'est plus utilisée car la modale est maintenant toujours centrée
  assignment,
  exchangeType = 'direct',
  showReplacementOption = false,
  operationTypes = [],
  allOptionsSelected = false
}) => {
  const [comment, setComment] = useState(initialComment);
  const [selectedOperations, setSelectedOperations] = useState<Array<'exchange' | 'give' | 'replacement' | 'both'>>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Animation d'entrée
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);
  
  // Initialisation des opérations sélectionnées à partir des types d'opération
  useEffect(() => {
    console.log("ExchangeModal: Mise à jour avec types d'opérations:", operationTypes);
    
    // Utiliser directement les operations types sans duplication
    // Ne pas reconstruire mais utiliser directement les valeurs fournies
    if (operationTypes && operationTypes.length > 0) {
      console.log("ExchangeModal: Utilisation directe des operationTypes:", operationTypes);
      
      // Filtrer pour ne garder que les types d'opération valides
      const validOperationTypes = operationTypes.filter(
        type => ['exchange', 'give', 'replacement', 'both'].includes(type)
      );
      
      // Utiliser les types d'opérations comme référence unique
      setSelectedOperations(validOperationTypes as Array<'exchange' | 'give' | 'replacement' | 'both'>);
    } else {
      // Réinitialiser si pas de types d'opération
      console.log("ExchangeModal: Aucun type d'opération, réinitialisation");
      setSelectedOperations([]);
    }
  }, [operationTypes, isOpen]); // Ajouter isOpen comme dépendance pour réinitialiser à chaque ouverture

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedOperations.length === 0) {
      return; // Ne pas soumettre si aucune opération n'est sélectionnée
    }
    
    // Créer une copie des opérations sélectionnées pour éviter toute modification accidentelle
    const operationsToSubmit = [...selectedOperations];
    
    console.log("Soumission des opérations:", operationsToSubmit);
    
    // Appeler la fonction onSubmit avec les opérations sélectionnées
    onSubmit(comment, operationsToSubmit);
    
    // Réinitialiser l'état après la soumission
    setComment('');
    setSelectedOperations([]);
  };

  // Permet de sélectionner plusieurs options simultanément
  const toggleOperation = (operation: 'exchange' | 'give' | 'replacement' | 'both') => {
    console.log("Toggling operation:", operation, "Current selections:", selectedOperations);
    
    setSelectedOperations(prev => {
      // Créer une copie pour éviter de modifier l'état directement
      const newOperations = [...prev];
      
      if (prev.includes(operation)) {
        console.log("Removing operation:", operation);
        // Filtrer pour supprimer l'opération
        return newOperations.filter(op => op !== operation);
      } else {
        console.log("Adding operation:", operation);
        // Ajouter l'opération si elle n'existe pas déjà
        if (!newOperations.includes(operation)) {
          newOperations.push(operation);
        }
        return newOperations;
      }
    });
  };

  // Formater la date au format "JJ Mois" (ex: "18 Mai")
  const formatShortDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM', { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  // Déterminer la classe CSS pour la période
  const getPeriodClass = (period?: string) => {
    if (!period) return '';
    
    switch(period) {
      case 'M': return 'badge-morning';
      case 'AM': return 'badge-afternoon';
      case 'S': return 'badge-evening';
      default: return '';
    }
  };

  // Style pour centrer parfaitement la modale
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: isVisible 
      ? 'translate(-50%, -50%)' 
      : 'translate(-50%, -55%)',
    zIndex: 1000,
    width: '90%',
    maxWidth: '320px',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl overflow-hidden w-full mx-4 sm:mx-0"
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-2 right-2">
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 pt-5">
          {assignment && (
            <div className="mb-4 flex flex-col items-center">
              <div className={`${getPeriodClass(assignment.period)} font-medium text-sm px-3 py-1.5 rounded shadow mb-1.5 transform scale-105`}>
                {assignment.shiftType}
              </div>
              <div className="text-sm font-medium text-gray-700">
                {formatShortDate(assignment.date)}
              </div>
            </div>
          )}

          <div className="mb-3">
            <div className="flex flex-wrap gap-2 mb-1">
              <button
                onClick={() => toggleOperation('give')}
                className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all duration-200 ${
                  selectedOperations.includes('give')
                    ? 'btn-give shadow-sm transform -translate-y-0.5'
                    : 'btn-option-inactive'
                }`}
                style={selectedOperations.includes('give') ? {backgroundColor: '#FEF9C3', color: '#A16207', borderColor: '#FDE047'} : {}}
              >
                <Gift className="h-3.5 w-3.5" />
                <span>Céder</span>
              </button>
              <button
                onClick={() => toggleOperation('exchange')}
                className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all duration-200 ${
                  selectedOperations.includes('exchange')
                    ? 'btn-exchange shadow-sm transform -translate-y-0.5'
                    : 'btn-option-inactive'
                }`}
                style={selectedOperations.includes('exchange') ? {backgroundColor: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC'} : {}}
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Échanger</span>
              </button>
            </div>
            
            {showReplacementOption && (
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => toggleOperation('replacement')}
                  className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all duration-200 ${
                    selectedOperations.includes('replacement')
                      ? 'btn-replacement-option shadow-sm transform -translate-y-0.5'
                      : 'btn-option-inactive'
                  }`}
                  style={selectedOperations.includes('replacement') ? {backgroundColor: '#FEF3C7', color: '#B45309', borderColor: '#FCD34D'} : {}}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Rempla.</span>
                </button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <input
              type="text"
              id="comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-300 focus:border-blue-300 transition-shadow"
              placeholder="Commentaire (optionnel)..."
            />
          </div>

          <div className="flex justify-between">
            {/* Bouton Retirer - Visible lorsqu'il y a un échange existant ou un remplacement */}
            {operationTypes && operationTypes.length > 0 && onRemove && (
              <button
                onClick={onRemove}
                className="px-4 py-1.5 text-xs text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors shadow-sm"
              >
                Retirer tout
              </button>
            )}
            
            {/* Bouton Proposer/Mettre à jour */}
            <button
              onClick={handleSubmit}
              disabled={selectedOperations.length === 0}
              className={`px-4 py-1.5 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm ${
                operationTypes && operationTypes.length > 0 ? 'ml-auto' : 'mx-auto'
              }`}
            >
              {operationTypes && operationTypes.length > 0 ? 'Mettre à jour' : 'Proposer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
