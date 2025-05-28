import React, { useState, useEffect } from 'react';
import { CalendarClock, User, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useReplacementService } from '../hooks/useReplacementService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { standardizePeriod } from '../../../utils/periodUtils';

interface ReplacementProposalsListProps {
  onActionComplete?: () => void;
}

/**
 * Composant affichant la liste des propositions de remplacement pour un remplaçant
 */
export const ReplacementProposalsList: React.FC<ReplacementProposalsListProps> = ({
  onActionComplete
}) => {
  const { 
    getReplacementProposals, 
    respondToReplacement,
    isReplacementUser,
    loading: serviceLoading 
  } = useReplacementService();
  
  interface Proposal {
    id: string;
    shiftDate: string;
    period: string;
    shiftType: string;
    timeSlot: string;
    proposingUser: {
      id: string;
      name: string;
    };
    comment?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
  }
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [responseComment, setResponseComment] = useState('');
  const [responseAction, setResponseAction] = useState<'accept' | 'reject' | null>(null);
  
  // Charger les propositions de remplacement
  const loadProposals = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getReplacementProposals();
      
      if (result.error) {
        setError(result.error);
      } else {
        setProposals(result.proposals);
      }
    } catch (err) {
      setError('Erreur lors du chargement des propositions');
      console.error('Error loading replacement proposals:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Charger les propositions au montage du composant
  useEffect(() => {
    if (isReplacementUser) {
      loadProposals();
    }
  }, [isReplacementUser]);
  
  // Formater la période pour l'affichage
  const formatPeriod = (period: string) => {
    const standardPeriod = standardizePeriod(period);
    switch (standardPeriod) {
      case 'M': return 'Matin';
      case 'AM': return 'Après-midi';
      case 'S': return 'Soir';
      default: return period;
    }
  };
  
  // Formater la date pour l'affichage
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'EEE d MMM yyyy', { locale: fr });
    } catch (e) {
      return dateString;
    }
  };
  
  // Ouvrir le modal de commentaire
  const openCommentModal = (proposal: any, action: 'accept' | 'reject') => {
    setCurrentProposal(proposal);
    setResponseAction(action);
    setResponseComment('');
    setCommentModalOpen(true);
  };
  
  // Fermer le modal de commentaire
  const closeCommentModal = () => {
    setCommentModalOpen(false);
    setCurrentProposal(null);
    setResponseAction(null);
    setResponseComment('');
  };
  
  // Soumettre la réponse
  const submitResponse = async () => {
    if (!currentProposal || !responseAction) return;
    
    setActionInProgress(currentProposal.id);
    
    try {
      const result = await respondToReplacement({
        proposalId: currentProposal.id,
        response: responseAction,
        comment: responseComment
      });
      
      if (result.success) {
        // Recharger les propositions après une action réussie
        await loadProposals();
        
        // Notifier le composant parent
        if (onActionComplete) {
          onActionComplete();
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Erreur lors du traitement de la proposition');
      console.error('Error processing proposal response:', err);
    } finally {
      setActionInProgress(null);
      closeCommentModal();
    }
  };
  
  // Si l'utilisateur n'est pas un remplaçant
  if (!isReplacementUser) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-center">
        <p className="text-amber-800">
          Vous n'avez pas accès aux propositions de remplacement. Seuls les utilisateurs ayant le statut de remplaçant peuvent voir cette section.
        </p>
      </div>
    );
  }
  
  // Affichage pendant le chargement
  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-2 text-gray-600">Chargement des propositions...</span>
      </div>
    );
  }
  
  // Affichage en cas d'erreur
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={loadProposals}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
        >
          Réessayer
        </button>
      </div>
    );
  }
  
  // Affichage si aucune proposition
  if (proposals.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
        <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-gray-700 text-lg font-medium mb-1">Aucune proposition de remplacement</h3>
        <p className="text-gray-500">
          Vous n'avez pas de propositions de remplacement en attente pour le moment.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Titre et compteur */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Propositions de remplacement
        </h3>
        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
          {proposals.length} proposition{proposals.length > 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Liste des propositions */}
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div 
            key={proposal.id} 
            className="border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          >
            {/* En-tête avec la date */}
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex justify-between items-center">
              <div className="flex items-center">
                <CalendarClock className="h-4 w-4 text-amber-600 mr-2" />
                <span className="font-medium text-amber-800">
                  {formatDate(proposal.targetShift.date)}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">
                {proposal.isTargeted ? 'Proposition pour vous' : 'Proposition générale'}
              </span>
            </div>
            
            {/* Détails de la garde */}
            <div className="px-4 py-3 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Médecin</div>
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-500 mr-1.5" />
                    <span className="text-sm font-medium text-gray-800">
                      {proposal.targetUser?.firstName} {proposal.targetUser?.lastName || 'N/A'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Horaire</div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-500 mr-1.5" />
                    <span className="text-sm text-gray-700">
                      {formatPeriod(proposal.targetShift.period)} - {proposal.targetShift.timeSlot}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Commentaire s'il existe */}
              {proposal.comment && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-start">
                    <MessageSquare className="h-4 w-4 text-gray-500 mr-1.5 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Commentaire</div>
                      <p className="text-sm text-gray-700">{proposal.comment}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => openCommentModal(proposal, 'accept')}
                disabled={serviceLoading || actionInProgress === proposal.id}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Accepter
              </button>
              <button
                onClick={() => openCommentModal(proposal, 'reject')}
                disabled={serviceLoading || actionInProgress === proposal.id}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Décliner
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Modal de commentaire */}
      {commentModalOpen && currentProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {responseAction === 'accept' ? 'Accepter' : 'Décliner'} la proposition
            </h3>
            
            <div className="mb-4">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                Commentaire (facultatif)
              </label>
              <textarea
                id="comment"
                value={responseComment}
                onChange={(e) => setResponseComment(e.target.value)}
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                placeholder={responseAction === 'accept' 
                  ? "Informations supplémentaires pour le médecin" 
                  : "Raison du refus (facultatif)"
                }
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={closeCommentModal}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={serviceLoading}
              >
                Annuler
              </button>
              <button
                onClick={submitResponse}
                className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  responseAction === 'accept'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                }`}
                disabled={serviceLoading}
              >
                {serviceLoading 
                  ? 'Traitement...' 
                  : responseAction === 'accept' 
                    ? 'Confirmer l\'acceptation' 
                    : 'Confirmer le refus'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};