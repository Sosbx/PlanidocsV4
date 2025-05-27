import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ShiftExchange, OperationType } from '../../../types/exchange';
import { User } from '../../../types/users';
import { formatPeriod } from '../../../utils/dateUtils';

// Interface pour les propositions d'échange
export interface ExchangeProposal {
  id: string;
  targetExchangeId: string;        // ID de l'échange cible
  targetUserId: string;            // ID de l'utilisateur qui a proposé la garde initialement
  proposingUserId: string;         // ID de l'utilisateur qui propose l'échange/reprise
  proposalType: 'take' | 'exchange' | 'both' | 'replacement' | 'all' | 'take_replacement' | 'exchange_replacement'; // Type de proposition étendu
  isCombinedProposal?: boolean;      // Indique si la proposition combine plusieurs types
  includesReplacement?: boolean;     // Indique si la proposition inclut un remplacement
  targetShift: {                   // Garde ciblée
    date: string;
    period: 'M' | 'AM' | 'S';
    shiftType: string;
    timeSlot: string;
  };
  proposedShifts: Array<{         // Gardes proposées en échange (vide pour une reprise)
    date: string;
    period: string;
    shiftType: string;
    timeSlot: string;
  }>;
  comment: string;                // Commentaire de l'utilisateur proposant
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  lastModified: string;
}

interface ExchangeProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchange: ShiftExchange;
  proposals: ExchangeProposal[];
  users: User[];
  onAccept: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => Promise<void>;
  onAcceptShift?: (proposalId: string, shiftIndex: number) => Promise<void>;
  onRejectShift?: (proposalId: string, shiftIndex: number) => Promise<void>;
  onUpdateOptions: (operationTypes: OperationType[]) => Promise<void>;
}

/**
 * Modal pour afficher et gérer les propositions reçues pour une garde
 */
const ExchangeProposalsModal: React.FC<ExchangeProposalsModalProps> = ({
  isOpen,
  onClose,
  exchange,
  proposals,
  users,
  onAccept,
  onReject,
  onAcceptShift,
  onRejectShift,
  onUpdateOptions
}) => {
  const [selectedOperationTypes, setSelectedOperationTypes] = useState<OperationType[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ExchangeProposal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeDetails, setExchangeDetails] = useState<{
    sourceShift: any;
    targetShift: any;
  }>({ sourceShift: null, targetShift: null });
  
  // État local pour suivre les propositions et permettre une mise à jour immédiate de l'UI
  const [localProposals, setLocalProposals] = useState<ExchangeProposal[]>(proposals);
  
  // Mettre à jour l'état local quand les props changent
  useEffect(() => {
    setLocalProposals(proposals);
  }, [proposals]);
  
  // Initialiser les types d'opération sélectionnés
  useEffect(() => {
    if (exchange && exchange.operationTypes && Array.isArray(exchange.operationTypes) && exchange.operationTypes.length > 0) {
      // Si operationTypes est défini, l'utiliser en priorité
      setSelectedOperationTypes([...exchange.operationTypes] as OperationType[]);
    } else if (exchange && exchange.operationType) {
      // Sinon, utiliser operationType
      if (exchange.operationType === 'both') {
        setSelectedOperationTypes(['exchange', 'give']);
      } else {
        setSelectedOperationTypes([exchange.operationType as OperationType]);
      }
    } else {
      // Valeur par défaut
      setSelectedOperationTypes([]);
    }
  }, [exchange]);
  
  // Formater la date à la française
  const formattedDate = exchange?.date ? 
    format(new Date(exchange.date), 'EEEE d MMMM yyyy', { locale: fr })
      .replace(/^\w/, c => c.toUpperCase()) : '';
  
  // Fonction pour gérer l'acceptation d'une proposition
  const handleAccept = async (proposalId: string) => {
    // Trouver la proposition correspondante dans l'état local
    const proposal = localProposals.find(p => p.id === proposalId);
    if (proposal) {
      setSelectedProposal(proposal);
      setIsConfirmModalOpen(true);
    }
  };
  
  // Fonction pour confirmer l'acceptation
  const confirmAccept = async () => {
    if (!selectedProposal) return;
    
    setIsProcessing(true);
    try {
      // Stocker les détails de l'échange pour la confirmation
      setExchangeDetails({
        sourceShift: exchange,
        targetShift: selectedProposal.proposedShifts && selectedProposal.proposedShifts.length > 0 
          ? selectedProposal.proposedShifts[0] 
          : { date: exchange.date, period: exchange.period, shiftType: exchange.shiftType, timeSlot: exchange.timeSlot }
      });
      
      await onAccept(selectedProposal.id);
      
      // Fermer la fenêtre de confirmation
      setIsConfirmModalOpen(false);
      
      // Ouvrir la fenêtre de succès
      setIsSuccessModalOpen(true);
      
      // Fermer la fenêtre principale après un délai
      setTimeout(() => {
        setIsSuccessModalOpen(false);
        onClose();
      }, 5000);
    } catch (error) {
      console.error('Error accepting proposal:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fonction pour gérer le rejet d'une proposition complète
  const handleReject = async (proposalId: string) => {
    setIsProcessing(true);
    try {
      await onReject(proposalId);
      
      // Mettre à jour l'état local en filtrant la proposition rejetée
      setLocalProposals(prevProposals => 
        prevProposals.filter(p => p.id !== proposalId)
      );
    } catch (error) {
      console.error('Error rejecting proposal:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fonction pour gérer l'acceptation d'une garde spécifique dans une proposition d'échange
  const handleAcceptShift = async (proposalId: string, shiftIndex: number) => {
    if (!onAcceptShift) {
      console.warn('onAcceptShift not provided, falling back to accepting entire proposal');
      handleAccept(proposalId);
      return;
    }
    
    setIsProcessing(true);
    try {
      await onAcceptShift(proposalId, shiftIndex);
    } catch (error) {
      console.error('Error accepting individual shift:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fonction pour gérer le rejet d'une garde spécifique dans une proposition d'échange
  const handleRejectShift = async (proposalId: string, shiftIndex: number) => {
    if (!onRejectShift) {
      console.warn('onRejectShift not provided, falling back to rejecting entire proposal');
      handleReject(proposalId);
      return;
    }
    
    setIsProcessing(true);
    try {
      await onRejectShift(proposalId, shiftIndex);
      
      // Mettre à jour l'état local en modifiant la proposition concernée
      setLocalProposals(prevProposals => {
        return prevProposals.map(proposal => {
          if (proposal.id === proposalId) {
            // Créer une copie de la proposition avec les gardes mises à jour
            const updatedProposal = { ...proposal };
            
            // Créer une copie du tableau des gardes proposées
            const updatedShifts = [...proposal.proposedShifts];
            
            // Supprimer la garde à l'index spécifié
            updatedShifts.splice(shiftIndex, 1);
            
            // Si plus aucune garde n'est proposée, supprimer la proposition entière
            if (updatedShifts.length === 0) {
              return null; // Cette proposition sera filtrée ci-dessous
            }
            
            // Sinon, mettre à jour les gardes proposées
            updatedProposal.proposedShifts = updatedShifts;
            return updatedProposal;
          }
          return proposal;
        }).filter(Boolean) as ExchangeProposal[]; // Filtrer les propositions nulles
      });
    } catch (error) {
      console.error('Error rejecting individual shift:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fonction pour mettre à jour les options
  const handleUpdateOptions = async () => {
    setIsProcessing(true);
    try {
      await onUpdateOptions(selectedOperationTypes);
      onClose();
    } catch (error) {
      console.error('Error updating options:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isOpen || !exchange) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-2 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div 
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full mx-auto"
        >
          <div className="bg-white p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Propositions pour votre garde
            </h3>
            
            {/* Informations de la garde */}
            <div className="mb-4 p-2 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-700">
                  {exchange.shiftType}
                </p>
                <p className="text-xs text-gray-500">
                  {formatPeriod(exchange.period)}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {formattedDate}
              </p>
              
              {exchange.comment && (
                <div className="mt-1 pt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-600 italic">{exchange.comment}</p>
                </div>
              )}
            </div>
            
            {/* Bouton d'annulation de la proposition */}
            <div className="mb-4">
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                onClick={() => {
                  setSelectedOperationTypes([]);
                  handleUpdateOptions();
                }}
                disabled={isProcessing}
              >
                {isProcessing ? 'Annulation...' : 'Annuler la proposition'}
              </button>
            </div>
            
            {/* Liste des propositions - Version réorganisée */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Propositions reçues ({localProposals.length})
              </h4>
              
              {localProposals.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune proposition reçue</p>
              ) : (
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  
                  {/* Section des propositions de reprise */}
                  {localProposals.some(p => p.proposalType === 'take' || p.proposalType === 'both') && (
                    <div className="rounded-md border border-blue-200 overflow-hidden">
                      <div className="bg-blue-50 p-2 border-b border-blue-200">
                        <h5 className="text-sm font-medium text-blue-700">
                          Propositions de reprise de votre garde
                        </h5>
                      </div>
                      
                      <div className="divide-y divide-gray-100">
                        {localProposals
                          .filter(p => p.proposalType === 'take' || p.proposalType === 'both')
                          .map(proposal => {
                            const proposingUser = users.find(u => u.id === proposal.proposingUserId);
                            
                            return (
                              <div 
                                key={`take-${proposal.id}`}
                                className="p-2 bg-white hover:bg-gray-50 flex justify-between items-center"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-700">
                                    {proposingUser?.lastName || 'Utilisateur inconnu'}
                                  </p>
                                  {proposal.comment && (
                                    <p className="text-xs text-gray-600 italic mt-0.5">
                                      "{proposal.comment}"
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex space-x-2">
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                                    onClick={() => handleReject(proposal.id)}
                                    disabled={isProcessing}
                                  >
                                    Rejeter
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
                                    onClick={() => handleAccept(proposal.id)}
                                    disabled={isProcessing}
                                  >
                                    Accepter
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  
                  {/* Section des propositions d'échange */}
                  {localProposals.some(p => p.proposalType === 'exchange' || p.proposalType === 'both') && (
                    <div className="rounded-md border border-indigo-200 overflow-hidden">
                      <div className="bg-indigo-50 p-2 border-b border-indigo-200">
                        <h5 className="text-sm font-medium text-indigo-700">
                          Propositions d'échange contre votre garde
                        </h5>
                      </div>
                      
                      <div className="divide-y divide-gray-100">
                        {localProposals
                          .filter(p => p.proposalType === 'exchange' || p.proposalType === 'both')
                          .map(proposal => {
                            const proposingUser = users.find(u => u.id === proposal.proposingUserId);
                            const userName = proposingUser?.lastName || 'Utilisateur inconnu';
                            
                            // Si aucune garde n'est proposée, afficher un message spécial
                            if (!proposal.proposedShifts || proposal.proposedShifts.length === 0) {
                              return (
                                <div 
                                  key={`exchange-${proposal.id}-empty`}
                                  className="p-2 bg-white hover:bg-gray-50"
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-700">
                                        {userName} <span className="text-xs text-gray-500">(aucune garde proposée)</span>
                                      </p>
                                      {proposal.comment && (
                                        <p className="text-xs text-gray-600 italic mt-0.5">
                                          "{proposal.comment}"
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="flex space-x-2">
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                                        onClick={() => handleReject(proposal.id)}
                                        disabled={isProcessing}
                                      >
                                        Rejeter
                                      </button>
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
                                        onClick={() => handleAccept(proposal.id)}
                                        disabled={isProcessing}
                                      >
                                        Accepter
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Pour les propositions avec des gardes, créer une entrée individuelle pour CHAQUE garde proposée
                            return proposal.proposedShifts.map((shift, index) => {
                              // Vérifier si la garde existe bien (pour éviter les erreurs sur les données incomplètes)
                              if (!shift || !shift.date || !shift.period) {
                                console.error("Données de garde incomplètes:", shift);
                                return null;
                              }
                              
                              const shiftDate = new Date(shift.date);
                              const formattedDate = format(shiftDate, 'dd/MM', { locale: fr });
                              const periodText = formatPeriod(shift.period);
                              
                              // Définir la couleur du badge en fonction de la période
                              const periodColors: Record<string, string> = {
                                'M': 'bg-blue-50 text-blue-700 border-blue-200',
                                'AM': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                'S': 'bg-purple-50 text-purple-700 border-purple-200'
                              };
                              
                              const colorClass = periodColors[shift.period] || 'bg-gray-50 text-gray-700 border-gray-200';
                              
                              return (
                                <div 
                                  key={`exchange-${proposal.id}-shift-${index}`}
                                  className="p-2 bg-white hover:bg-gray-50"
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-gray-700">
                                          {userName} propose :
                                        </p>
                                        <div className={`px-2 py-1 rounded-md border ${colorClass} text-xs`}>
                                          {formattedDate} - {shift.shiftType} ({periodText})
                                        </div>
                                      </div>
                                      {proposal.comment && index === 0 && (
                                        <p className="text-xs text-gray-600 italic mt-0.5">
                                          "{proposal.comment}"
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="flex space-x-2">
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                                        onClick={() => handleRejectShift(proposal.id, index)}
                                        disabled={isProcessing}
                                      >
                                        Rejeter
                                      </button>
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
                                        onClick={() => handleAcceptShift(proposal.id, index)}
                                        disabled={isProcessing}
                                      >
                                        Accepter
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }).filter(Boolean); // Filtrer les entrées null en cas de données incomplètes
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
              onClick={onClose}
              disabled={isProcessing}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmation avant acceptation */}
      {isConfirmModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-60 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-2 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-sm w-full mx-auto">
              <div className="bg-white p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Confirmer l'acceptation
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  {selectedProposal?.proposalType === 'take'
                    ? 'Êtes-vous sûr de vouloir accepter cette proposition de reprise ? Cette action est définitive et la garde ne sera plus disponible pour les autres propositions.'
                    : selectedProposal?.proposalType === 'both'
                      ? 'Êtes-vous sûr de vouloir accepter cette proposition combinée (reprise ET échange) ? Cette action est définitive.'
                      : 'Êtes-vous sûr de vouloir accepter cette proposition d\'échange ? Vous pourrez encore accepter d\'autres propositions d\'échange ou de reprise pour cette garde.'}
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsConfirmModalOpen(false)}
                    disabled={isProcessing}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded border border-transparent bg-green-600 text-sm font-medium text-white hover:bg-green-700"
                    onClick={confirmAccept}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Traitement...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmation de succès */}
      {isSuccessModalOpen && exchangeDetails.sourceShift && exchangeDetails.targetShift && (
        <div className="fixed inset-0 z-70 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-2 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full mx-auto">
              <div className="bg-green-50 p-4 border-b border-green-100">
                <div className="flex items-center">
                  <svg className="h-6 w-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="text-lg font-medium text-green-900">
                    Échange effectué avec succès !
                  </h3>
                </div>
              </div>
              
              <div className="bg-white p-4">
                <p className="text-sm text-gray-700 mb-4">
                  L'échange a été effectué avec succès. Les plannings ont été mis à jour.
                </p>
                
                <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Votre garde cédée :</p>
                    <p className="text-xs text-gray-600">
                      {format(new Date(exchangeDetails.sourceShift.date), 'EEEE d MMMM yyyy', { locale: fr })}
                      {' - '}
                      {exchangeDetails.sourceShift.shiftType}
                      {' ('}
                      {formatPeriod(exchangeDetails.sourceShift.period)}
                      {')'}
                    </p>
                  </div>
                  <svg className="h-5 w-5 text-blue-500 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Garde reçue :</p>
                    <p className="text-xs text-gray-600">
                      {format(new Date(exchangeDetails.targetShift.date), 'EEEE d MMMM yyyy', { locale: fr })}
                      {' - '}
                      {exchangeDetails.targetShift.shiftType}
                      {' ('}
                      {formatPeriod(exchangeDetails.targetShift.period)}
                      {')'}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded border border-transparent bg-green-600 text-sm font-medium text-white hover:bg-green-700"
                    onClick={onClose}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExchangeProposalsModal;
