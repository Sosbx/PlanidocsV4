import React from 'react';

export interface ExchangeProposal {
  id: string;
  userId: string;
  targetExchangeId: string;
  targetUserId: string;
  proposedShifts: Array<{
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }>;
  comment: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface ExchangeProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposals: ExchangeProposal[];
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

/**
 * Modal pour afficher et gérer les propositions d'échange
 * Note: Ce composant est un placeholder pour résoudre les erreurs d'importation
 * Il sera implémenté complètement dans une future mise à jour
 */
const ExchangeProposalsModal: React.FC<ExchangeProposalsModalProps> = ({
  isOpen,
  onClose,
  proposals,
  onAccept,
  onReject
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Propositions d'échange</h2>
        
        <div className="mt-4 max-h-96 overflow-y-auto">
          {proposals.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Aucune proposition pour le moment</p>
          ) : (
            <div className="space-y-4">
              {proposals.map(proposal => (
                <div key={proposal.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">Proposition de {proposal.userId}</h3>
                      <p className="text-sm text-gray-600 mt-1">{proposal.comment}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onAccept(proposal.id)}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-sm hover:bg-green-200"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => onReject(proposal.id)}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-sm hover:bg-red-200"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700">Gardes proposées:</h4>
                    <ul className="mt-1 space-y-1">
                      {proposal.proposedShifts.map((shift, index) => (
                        <li key={index} className="text-sm">
                          {shift.date} - {shift.period} - {shift.shiftType}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeProposalsModal;
