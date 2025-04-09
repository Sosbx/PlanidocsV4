import React, { useState } from 'react';
import { OperationType } from '../../../features/directExchange/types';
import { ShiftAssignment } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPeriod } from '../../../utils/dateUtils';

interface ExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string, operationTypes: OperationType[]) => void;
  onRemove?: () => void;
  initialComment: string;
  position: { x: number; y: number };
  assignment: ShiftAssignment;
  exchangeType: 'bag' | 'direct';
  readOnly?: boolean;
  showReplacementOption?: boolean;
  existingOperationTypes?: OperationType[]; // Nouveau prop pour les types d'opération existants
  existingExchangeId?: string; // ID de l'échange existant si applicable
}

/**
 * Modal pour proposer une garde à l'échange
 * Permet de choisir entre "Échange", "Cède" et optionnellement "Remplaçant"
 * L'utilisateur peut sélectionner plusieurs options simultanément
 */
const ExchangeModal: React.FC<ExchangeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onRemove,
  initialComment,
  position,
  assignment,
  exchangeType,
  readOnly = false,
  showReplacementOption = false,
  existingOperationTypes = [], // Valeur par défaut: tableau vide
  existingExchangeId
}) => {
  const [comment, setComment] = useState(initialComment);
  // Initialisation des types d'opération sélectionnés
  // Si un échange existant a des types d'opération, les utiliser
  // Note: Dans l'UI, nous utilisons 'both' comme un type spécial qui englobe 'exchange' et 'give'
  const [selectedOperationTypes, setSelectedOperationTypes] = useState<OperationType[]>(() => {
    // Vérifier si la garde a des types d'opération existants
    if (existingOperationTypes.length > 0) {
      console.log('Types d\'opération existants trouvés pour l\'initialisation:', existingOperationTypes);
      
      // Créer un tableau pour stocker les types à initialiser
      let initialTypes: OperationType[] = [];
      
      // Si both est présent, inclure à la fois exchange et give
      if (existingOperationTypes.includes('both')) {
        initialTypes.push('exchange', 'give');
        console.log('Initialisation avec exchange et give (both)');
      } 
      // Si exchange et give sont tous deux présents, les inclure
      else if (existingOperationTypes.includes('exchange') && existingOperationTypes.includes('give')) {
        initialTypes.push('exchange', 'give');
        console.log('Initialisation avec exchange et give (les deux présents)');
      }
      // Sinon, initialiser avec les types existants
      else {
        initialTypes = [...existingOperationTypes];
      }
      
      // Ajouter le type replacement s'il existe
      if (existingOperationTypes.includes('replacement')) {
        initialTypes.push('replacement');
        console.log('Ajout du type replacement aux types initiaux');
      }
      
      return initialTypes;
    }
    
    // Aucun type existant, initialiser avec un tableau vide
    return [];
  });
  
  // Formater la date à la française
  const formattedDate = (() => {
    if (!assignment.date) return '';
    try {
      return format(new Date(assignment.date), 'EEEE d MMMM yyyy', { locale: fr })
        .replace(/^\w/, c => c.toUpperCase());
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      return '';
    }
  })();
  
  // Fonction pour gérer la sélection/désélection des types d'opération
  const toggleOperationType = (type: OperationType) => {
    if (selectedOperationTypes.includes(type)) {
      // Si déjà sélectionné, on le retire (même s'il ne reste qu'un seul type)
      setSelectedOperationTypes(selectedOperationTypes.filter(t => t !== type));
    } else {
      // Sinon on l'ajoute
      setSelectedOperationTypes([...selectedOperationTypes, type]);
    }
  };
  
  // Vérifier si un type d'opération est sélectionné
  const isOperationTypeSelected = (type: OperationType) => {
    return selectedOperationTypes.includes(type);
  };
  
  if (!isOpen) return null;
  
  // Déterminer le texte du bouton de soumission
  const getSubmitButtonText = () => {
    if (exchangeType === 'bag') {
      return 'Ajouter à la bourse';
    }
    
    // Pour les échanges directs, on affiche un texte en fonction des options sélectionnées
    const operations = [];
    if (isOperationTypeSelected('exchange')) operations.push('échange');
    if (isOperationTypeSelected('give')) operations.push('cession');
    if (isOperationTypeSelected('replacement')) operations.push('remplaçant');
    
    // Si aucune option n'est sélectionnée, afficher "Retirer la garde"
    if (operations.length === 0) {
      return 'Retirer la garde';
    }
    
    if (operations.length === 1) {
      if (operations[0] === 'échange') return 'Proposer un échange';
      if (operations[0] === 'cession') return 'Proposer une cession';
      if (operations[0] === 'remplaçant') return 'Proposer aux remplaçants';
    }
    
    return `Proposer (${operations.join(', ')})`;
  };
  
  const submitButtonText = getSubmitButtonText();
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-2 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div 
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-sm w-full mx-auto"
          style={{ 
            minWidth: '280px',
            maxWidth: '450px'
          }}
        >
          <div className="bg-white p-3">
            {/* Informations de la garde - Format compact */}
            <div className="mb-2 p-1.5 bg-gray-50 rounded-md border border-gray-100">
              <div className="flex justify-between items-center">
                <p className="text-xs font-medium text-gray-700">
                  {assignment.shiftType}
                </p>
                <p className="text-[10px] text-gray-500">
                  {assignment.period ? formatPeriod(assignment.period) : ''}
                </p>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formattedDate}
              </p>
            </div>
            
            {/* Options d'échange - Boutons plus compacts */}
            <div className="mb-2">
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Type d'opération</label>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    isOperationTypeSelected('exchange')
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleOperationType('exchange')}
                  disabled={readOnly}
                >
                  Échange
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    isOperationTypeSelected('give')
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleOperationType('give')}
                  disabled={readOnly}
                >
                  Cède
                </button>
                
                {/* Option de remplacement */}
                {showReplacementOption && (
                  <button
                    type="button"
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      isOperationTypeSelected('replacement')
                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                        : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                    }`}
                    onClick={() => toggleOperationType('replacement')}
                    disabled={readOnly}
                  >
                    Remplaçant
                  </button>
                )}
              </div>
            </div>
            
            {/* Champ de commentaire - Plus compact */}
            <div className="mb-2">
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Commentaire (optionnel)</label>
              <textarea
                className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
                rows={1}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={readOnly}
                placeholder="Ajoutez un commentaire..."
              />
            </div>
          </div>
          
          {/* Barre d'actions - Plus compacte */}
          <div className="bg-gray-50 px-3 py-2 flex justify-end gap-1 border-t border-gray-100">
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
              onClick={onClose}
            >
              Annuler
            </button>
            
            {onRemove && (
              <button
                type="button"
                className="px-2 py-1 rounded border border-red-200 text-[11px] font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-300"
                onClick={onRemove}
              >
                Retirer
              </button>
            )}
            
            <button
              type="button"
              className="px-2 py-1 rounded border border-transparent bg-indigo-500 text-[11px] font-medium text-white hover:bg-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onClick={() => onSubmit(comment, selectedOperationTypes)}
              disabled={readOnly}
            >
              {submitButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
