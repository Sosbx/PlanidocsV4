import React, { useState, useEffect } from 'react';
import { getProposalsForExchange } from '../../lib/firebase/directExchange/directProposalOperations';
import { acceptProposal, rejectProposal } from '../../lib/firebase/directExchange/directProposalOperations';
import { DirectExchangeProposal } from '../../lib/firebase/directExchange/types';
import { User } from '../../types/users';
import ProposalsList from './ProposalsList';

interface ExchangeProposalsManagerProps {
  exchangeId: string;
  users: User[];
  onProposalStatusChange?: () => void;
}

/**
 * Composant pour gérer les propositions d'échange et de reprise
 * Récupère les propositions et gère les actions d'acceptation et de rejet
 */
const ExchangeProposalsManager: React.FC<ExchangeProposalsManagerProps> = ({
  exchangeId,
  users,
  onProposalStatusChange
}) => {
  const [proposals, setProposals] = useState<DirectExchangeProposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

  // Charger les propositions au chargement du composant et lorsque l'ID d'échange change
  useEffect(() => {
    const loadProposals = async () => {
      if (!exchangeId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const fetchedProposals = await getProposalsForExchange(exchangeId);
        setProposals(fetchedProposals);
      } catch (err) {
        console.error('Erreur lors du chargement des propositions:', err);
        setError('Impossible de charger les propositions. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    
    loadProposals();
  }, [exchangeId]);

  // Gérer l'acceptation d'une proposition
  const handleAcceptProposal = async (proposalId: string) => {
    if (!proposalId || processingProposalId) return;
    
    setProcessingProposalId(proposalId);
    
    try {
      await acceptProposal(proposalId);
      
      // Mettre à jour la liste des propositions localement
      const updatedProposals = proposals.filter(p => p.id !== proposalId);
      setProposals(updatedProposals);
      
      // Notifier le composant parent si nécessaire
      if (onProposalStatusChange) {
        onProposalStatusChange();
      }
    } catch (err) {
      console.error('Erreur lors de l\'acceptation de la proposition:', err);
      setError('Impossible d\'accepter la proposition. Veuillez réessayer.');
    } finally {
      setProcessingProposalId(null);
    }
  };

  // Gérer le rejet d'une proposition
  const handleRejectProposal = async (proposalId: string) => {
    if (!proposalId || processingProposalId) return;
    
    setProcessingProposalId(proposalId);
    
    try {
      await rejectProposal(proposalId);
      
      // Mettre à jour la liste des propositions localement
      const updatedProposals = proposals.filter(p => p.id !== proposalId);
      setProposals(updatedProposals);
      
      // Notifier le composant parent si nécessaire
      if (onProposalStatusChange) {
        onProposalStatusChange();
      }
    } catch (err) {
      console.error('Erreur lors du rejet de la proposition:', err);
      setError('Impossible de rejeter la proposition. Veuillez réessayer.');
    } finally {
      setProcessingProposalId(null);
    }
  };

  // Afficher un message de chargement
  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Chargement des propositions...
      </div>
    );
  }

  // Afficher un message d'erreur
  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-800 mb-4">
        Propositions pour cette garde
      </h2>
      
      {processingProposalId && (
        <div className="mb-4 p-2 bg-blue-50 text-blue-700 rounded-md text-sm">
          Traitement en cours...
        </div>
      )}
      
      <ProposalsList
        proposals={proposals}
        users={users}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />
    </div>
  );
};

export default ExchangeProposalsManager;
