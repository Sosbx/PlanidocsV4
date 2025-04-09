import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ShiftExchange } from '../../types/exchange';
import { User } from '../../types/users';
import { formatPeriod } from '../../utils/dateUtils';
import { acceptDirectExchange, rejectDirectExchange } from '../../lib/firebase/directExchange';

interface ReceivedProposalsProps {
  proposals: ShiftExchange[];
  users: User[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
}

/**
 * Composant pour afficher les propositions reçues sur les gardes de l'utilisateur
 */
const ReceivedProposals: React.FC<ReceivedProposalsProps> = ({
  proposals,
  users,
  onSuccess,
  onError,
  onRefresh
}) => {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleAcceptProposal = async (proposal: ShiftExchange) => {
    try {
      setIsProcessing(proposal.id);
      await acceptDirectExchange(proposal.id, proposal.userId);
      await onRefresh();
      onSuccess('Proposition acceptée avec succès');
    } catch (error) {
      console.error('Error accepting proposal:', error);
      onError(`Erreur lors de l'acceptation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectProposal = async (proposal: ShiftExchange) => {
    try {
      setIsProcessing(proposal.id);
      await rejectDirectExchange(proposal.id);
      await onRefresh();
      onSuccess('Proposition refusée');
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      onError(`Erreur lors du refus: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  if (proposals.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        Propositions reçues sur vos gardes ({proposals.length})
      </h2>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-yellow-700 text-sm">
          Ces propositions concernent vos gardes. Vous pouvez les accepter ou les refuser.
        </p>
      </div>
      
      <div className="space-y-2">
        {proposals.map(proposal => {
          const proposingUser = users.find(u => u.id === proposal.userId);
          
          return (
            <div key={proposal.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {format(new Date(proposal.date), 'EEEE d MMMM yyyy', { locale: fr })}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatPeriod(proposal.period)} - {proposal.shiftType}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium">Type:</span> {proposal.operationType === 'exchange' ? 'Échange' : proposal.operationType === 'give' ? 'Cession' : 'Remplacement'}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Proposé par:</span> {proposingUser ? `${proposingUser.lastName} ${proposingUser.firstName}` : 'Inconnu'}
                  </p>
                  {proposal.comment && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      "{proposal.comment}"
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAcceptProposal(proposal)}
                    disabled={isProcessing === proposal.id}
                    className={`px-3 py-1 text-xs font-medium rounded-md ${
                      isProcessing === proposal.id
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isProcessing === proposal.id ? 'En cours...' : 'Accepter'}
                  </button>
                  <button
                    onClick={() => handleRejectProposal(proposal)}
                    disabled={isProcessing === proposal.id}
                    className={`px-3 py-1 text-xs font-medium rounded-md ${
                      isProcessing === proposal.id
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReceivedProposals;
