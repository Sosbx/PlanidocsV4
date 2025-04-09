import React from 'react';
import { UserPlus, X } from 'lucide-react';
import type { ShiftExchange } from '../types';
import type { User } from '../../../types/users';

interface CompletedPhaseExchangeItemProps {
  exchange: ShiftExchange;
  exchangeUser?: User;
  proposingShift: string | null;
  removingShift: string | null;
  onProposeToReplacements: (exchange: ShiftExchange) => void;
  onRemoveFromExchange: (exchange: ShiftExchange) => void;
}

/**
 * Composant qui affiche une garde en phase "completed" avec les boutons d'action
 */
const CompletedPhaseExchangeItem: React.FC<CompletedPhaseExchangeItemProps> = ({
  exchange,
  exchangeUser,
  proposingShift,
  removingShift,
  onProposeToReplacements,
  onRemoveFromExchange
}) => {
  return (
    <div className="flex flex-col w-full relative">
      {/* Indicateur de proposition aux remplaçants */}
      {exchange.proposedToReplacements && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
      )}
      
      {/* Informations sur l'échange et le médecin */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[11px] sm:text-sm font-medium text-gray-800 truncate max-w-[60%]">
          {exchangeUser ? exchangeUser.lastName : 'Médecin'}
        </span>
      </div>
      
      {/* Commentaire sur deux lignes */}
      {exchange.comment && (
        <div className="text-[9px] sm:text-xs text-gray-500 line-clamp-2 overflow-hidden w-full break-words">
          {exchange.comment}
        </div>
      )}
      
      {/* Boutons d'action */}
      <div className="mt-2 flex flex-col gap-2 w-full">
        {/* Bouton "Garder cette garde" */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromExchange(exchange);
          }}
          disabled={removingShift === exchange.id}
          className="w-full px-2 py-1 text-[10px] sm:text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
        >
          <X className="h-3 w-3" />
          <span className="truncate">
            {removingShift === exchange.id ? 'En cours...' : 'Garder cette garde'}
          </span>
        </button>
        
        {/* Bouton "Proposer aux remplaçants" */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            try {
              onProposeToReplacements(exchange);
            } catch (error) {
              console.error('Erreur lors de la proposition aux remplaçants:', error);
              alert('Une erreur est survenue lors de la proposition aux remplaçants: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
            }
          }}
          disabled={proposingShift === exchange.id}
          className={`w-full px-2 py-1 text-[10px] sm:text-xs font-medium rounded flex items-center justify-center gap-1
            ${exchange.proposedToReplacements 
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
        >
          <UserPlus className="h-3 w-3" />
          <span className="truncate">
            {proposingShift === exchange.id 
              ? 'En cours...' 
              : exchange.proposedToReplacements 
                ? 'Annuler proposition' 
                : 'Proposer aux remplaçants'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default CompletedPhaseExchangeItem;
