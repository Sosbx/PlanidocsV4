import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DirectExchangeProposal } from '../../lib/firebase/directExchange/types';
import { User } from '../../types/users';
import { formatPeriod } from '../../utils/dateUtils';

interface ProposalsListProps {
  proposals: DirectExchangeProposal[];
  users: User[];
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

/**
 * Composant pour afficher la liste des propositions d'échange et de reprise
 * avec des boutons d'action indépendants pour chaque proposition
 */
const ProposalsList: React.FC<ProposalsListProps> = ({
  proposals,
  users,
  onAccept,
  onReject
}) => {
  // Grouper les propositions par utilisateur et par type
  const groupProposalsByUser = () => {
    const grouped: Record<string, {
      user: User | null;
      takeProposals: DirectExchangeProposal[];
      exchangeProposals: DirectExchangeProposal[];
    }> = {};

    proposals.forEach(proposal => {
      const userId = proposal.proposingUserId;
      
      // Initialiser l'entrée pour cet utilisateur s'il n'existe pas encore
      if (!grouped[userId]) {
        const user = users.find(u => u.id === userId) || null;
        grouped[userId] = {
          user,
          takeProposals: [],
          exchangeProposals: []
        };
      }
      
      // Ajouter la proposition au bon groupe selon son type
      if (proposal.proposalType === 'take') {
        grouped[userId].takeProposals.push(proposal);
      } else if (proposal.proposalType === 'exchange') {
        grouped[userId].exchangeProposals.push(proposal);
      } else if (proposal.proposalType === 'both') {
        // Pour les propositions de type 'both', les ajouter aux deux groupes
        grouped[userId].takeProposals.push(proposal);
        grouped[userId].exchangeProposals.push(proposal);
      }
    });
    
    return grouped;
  };
  
  const groupedProposals = groupProposalsByUser();
  
  // Rendu d'une proposition de reprise
  const renderTakeProposal = (proposal: DirectExchangeProposal, user: User | null) => {
    if (!proposal.targetShift) return null;
    
    return (
      <div key={`take-${proposal.id}`} className="mb-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-sm font-medium text-gray-800">
              Propose de reprendre votre garde:
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              {user?.lastName || 'Utilisateur'} 
            </p>
            <div className="mt-2 text-xs text-gray-700">
              <p>
                {format(new Date(proposal.targetShift.date), 'EEE d MMM yyyy', { locale: fr })} - {formatPeriod(proposal.targetShift.period)}
              </p>
              {proposal.comment && (
                <p className="mt-1 italic text-gray-500">
                  "{proposal.comment}"
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onAccept(proposal.id || '')}
              className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs hover:bg-green-100 transition-colors"
            >
              Accepter
            </button>
            <button
              onClick={() => onReject(proposal.id || '')}
              className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs hover:bg-red-100 transition-colors"
            >
              Rejeter
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Rendu d'une proposition d'échange
  const renderExchangeProposal = (proposal: DirectExchangeProposal, user: User | null) => {
    if (!proposal.targetShift || !proposal.proposedShifts || proposal.proposedShifts.length === 0) return null;
    
    return (
      <div key={`exchange-${proposal.id}`} className="mb-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-sm font-medium text-gray-800">
              Propose un échange avec:
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              {user?.lastName || 'Utilisateur'} 
            </p>
            <div className="mt-2 text-xs text-gray-700">
              <p className="font-medium">Votre garde:</p>
              <p>
                {format(new Date(proposal.targetShift.date), 'EEE d MMM yyyy', { locale: fr })} - {formatPeriod(proposal.targetShift.period)}
              </p>
              
              <p className="font-medium mt-2">Contre:</p>
              <ul className="list-disc list-inside">
                {proposal.proposedShifts.map((shift, index) => (
                  <li key={index} className="ml-2">
                    {format(new Date(shift.date), 'EEE d MMM yyyy', { locale: fr })} - {formatPeriod(shift.period)}
                  </li>
                ))}
              </ul>
              
              {proposal.comment && (
                <p className="mt-1 italic text-gray-500">
                  "{proposal.comment}"
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onAccept(proposal.id || '')}
              className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs hover:bg-green-100 transition-colors"
            >
              Accepter
            </button>
            <button
              onClick={() => onReject(proposal.id || '')}
              className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs hover:bg-red-100 transition-colors"
            >
              Rejeter
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Si aucune proposition, afficher un message
  if (Object.keys(groupedProposals).length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Aucune proposition pour cette garde
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {Object.entries(groupedProposals).map(([userId, { user, takeProposals, exchangeProposals }]) => (
        <div key={userId} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Propositions de {user?.lastName || 'Utilisateur'}
          </h3>
          
          {/* Propositions de reprise */}
          {takeProposals.length > 0 && (
            <div className="mb-2">
              {takeProposals.map(proposal => renderTakeProposal(proposal, user))}
            </div>
          )}
          
          {/* Propositions d'échange */}
          {exchangeProposals.length > 0 && (
            <div>
              {exchangeProposals.map(proposal => renderExchangeProposal(proposal, user))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProposalsList;
