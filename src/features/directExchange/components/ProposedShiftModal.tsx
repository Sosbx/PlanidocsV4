import React, { useState, useEffect } from 'react';
import { X, Repeat, Gift, Calendar, Clock, User } from 'lucide-react';
import { useAuth } from '../../auth/hooks';
import { format } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { parseParisDate, formatParisDate } from '../../../utils/timezoneUtils';
import { standardizePeriod } from '../../../utils/periodUtils';
import { ShiftExchange } from '../../../types/exchange';
import type { ShiftAssignment } from '../../../types/planning';
import '../../../styles/BadgeStyles.css';

interface ProposedShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchange: ShiftExchange;
  userAssignments: Record<string, ShiftAssignment>;
  onSubmitExchange: (exchangeId: string, userShiftKeys: string[], comment: string) => void;
  onSubmitCession: (exchangeId: string, comment: string) => void;
  onCancel?: () => void;
}

/**
 * Modal pour afficher les détails d'une garde proposée et permettre
 * de faire une proposition d'échange ou une reprise de cession
 */
const ProposedShiftModal: React.FC<ProposedShiftModalProps> = ({
  isOpen,
  onClose,
  exchange,
  userAssignments,
  onSubmitExchange,
  onSubmitCession,
  onCancel
}) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [selectedUserShifts, setSelectedUserShifts] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  
  // Déterminer les types d'opérations possibles
  const hasExchange = exchange.operationTypes?.includes('exchange') || exchange.operationType === 'exchange' || exchange.operationType === 'both';
  const hasCession = exchange.operationTypes?.includes('give') || exchange.operationType === 'give' || exchange.operationType === 'both';
  
  // Animation d'entrée
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);
  
  // Réinitialisation à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setComment('');
      setSelectedUserShifts([]);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  // Formatage de la date au format "Jour JJ Mois"
  const formatDate = (dateString: string) => {
    try {
      return formatParisDate(dateString, 'EEEE d MMMM', { locale: frLocale });
    } catch (e) {
      return dateString;
    }
  };
  
  // Formatage de la période (M, AM, S)
  const formatPeriod = (period: string) => {
    const standardPeriod = standardizePeriod(period);
    switch (standardPeriod) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return period;
    }
  };
  
  // Déterminer la classe de style pour la période
  const getPeriodClass = (period?: string) => {
    if (!period) return '';
    
    switch(standardizePeriod(period)) {
      case 'M': return 'badge-morning';
      case 'AM': return 'badge-afternoon';
      case 'S': return 'badge-evening';
      default: return '';
    }
  };
  
  // Traitement de la soumission de reprise (cession)
  const handleCessionSubmit = () => {
    onSubmitCession(exchange.id || '', comment);
  };
  
  // Traitement de la soumission d'échange
  const handleExchangeSubmit = () => {
    if (selectedUserShifts.length === 0) return;
    onSubmitExchange(exchange.id || '', selectedUserShifts, comment);
  };
  
  // Gestion de la sélection/désélection d'une garde
  const toggleShiftSelection = (key: string) => {
    setSelectedUserShifts(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };
  
  // Filtrer les gardes de l'utilisateur (exclure celles à la même date/période)
  const availableUserShifts = Object.entries(userAssignments).filter(([key, assignment]) => {
    // Ne pas proposer une garde à la même date et période que celle qu'on veut échanger
    return !(assignment.date === exchange.date && standardizePeriod(assignment.period) === standardizePeriod(exchange.period));
  });
  
  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl overflow-hidden max-w-md mx-auto mt-20 w-11/12"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
        }}
      >
        <div className="relative p-4">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-lg font-semibold mb-4 pr-8">Garde proposée</h2>
          
          {/* Informations sur la garde proposée */}
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-blue-700 font-medium">{formatDate(exchange.date)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-blue-700">
                  {formatPeriod(exchange.period)} - {exchange.timeSlot}
                </span>
              </div>
              <div className="flex items-center">
                <User className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-blue-700">{exchange.shiftType}</span>
              </div>
              
              {/* Types d'opérations disponibles */}
              <div className="flex gap-2 mt-1">
                {hasCession && (
                  <div className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                    Cession
                  </div>
                )}
                {hasExchange && (
                  <div className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                    Échange
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Options disponibles */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Options disponibles
            </label>
            
            {/* Section pour la cession */}
            {hasCession && (
              <div className="mb-4 border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors">
                <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                  <Gift className="h-4 w-4 text-yellow-600 mr-1.5" />
                  Reprendre cette garde
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Vous souhaitez récupérer cette garde sans céder l'une des vôtres.
                </p>
                <button
                  onClick={handleCessionSubmit}
                  className="w-full px-3 py-1.5 text-xs text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors shadow-sm"
                >
                  Reprendre cette garde
                </button>
              </div>
            )}
            
            {/* Section pour l'échange */}
            {hasExchange && (
              <div className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors">
                <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                  <Repeat className="h-4 w-4 text-green-600 mr-1.5" />
                  Proposer un échange
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Sélectionnez une ou plusieurs de vos gardes à échanger contre celle-ci.
                </p>
                
                {/* Liste des gardes de l'utilisateur */}
                {availableUserShifts.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto mb-3 border border-gray-200 rounded-md">
                    {availableUserShifts.map(([key, assignment]) => (
                      <div 
                        key={key}
                        className={`
                          p-2 border-b last:border-b-0 flex items-center gap-2
                          ${selectedUserShifts.includes(key) ? 'bg-green-50' : 'hover:bg-gray-50'}
                          transition-colors cursor-pointer
                        `}
                        onClick={() => toggleShiftSelection(key)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserShifts.includes(key)}
                          onChange={() => {}}
                          className="h-4 w-4 text-green-600 border-gray-300 rounded cursor-pointer"
                        />
                        <div className={`${getPeriodClass(assignment.period)} px-2 py-0.5 rounded text-xs`}>
                          {assignment.shiftType}
                        </div>
                        <div className="text-xs text-gray-700">
                          {formatParisDate(assignment.date, 'EEE d MMM', { locale: frLocale })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic mb-3 px-2 py-3 bg-gray-50 rounded-md">
                    Vous n'avez aucune garde disponible pour un échange.
                  </div>
                )}
                
                <button
                  onClick={handleExchangeSubmit}
                  disabled={selectedUserShifts.length === 0}
                  className="w-full px-3 py-1.5 text-xs text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Proposer l'échange
                </button>
              </div>
            )}
          </div>
          
          {/* Commentaire */}
          <div className="mb-4">
            <label htmlFor="comment" className="block text-xs font-medium text-gray-700 mb-1">
              Commentaire (facultatif)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-300 focus:border-blue-300 transition-shadow"
              placeholder="Ajouter un commentaire..."
              rows={2}
            />
          </div>
          
          {/* Bouton d'annulation si l'utilisateur a déjà fait une proposition */}
          {onCancel && (
            <div className="text-center">
              <button
                onClick={onCancel}
                className="text-xs text-red-600 hover:text-red-800 transition-colors"
              >
                Annuler ma proposition
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposedShiftModal;