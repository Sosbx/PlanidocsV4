import React, { useState, useEffect } from 'react';
import { Settings, History, BarChart as ChartBar } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { getExchangeHistory, revertToExchange, getShiftExchanges } from '../lib/firebase/shifts';
import { useUsers } from '../context/UserContext';
import Toast from '../components/Toast';
import { useBagPhase } from '../context/BagPhaseContext';
import BagPhaseIndicator from '../components/bag/BagPhaseIndicator';
import BagPhaseConfigModal from '../components/bag/BagPhaseConfigModal';
import BagStatsViz from '../components/bag/BagStatsViz';
import ExchangeList from '../components/admin/exchange/ExchangeList';
import ExchangeHistoryList from '../components/admin/exchange/ExchangeHistory';
import useExchangeManagement from '../hooks/useExchangeManagement';
import useConflictCheck from '../hooks/useConflictCheck';
import useUserAssignments from '../hooks/useUserAssignments';

const AdminShiftExchangePage: React.FC = () => {
  const { user } = useAuth();
  const { users } = useUsers();
  const { config: bagPhaseConfig } = useBagPhase();
  const [showHistory, setShowHistory] = useState(false);
  const [exchangeHistory, setExchangeHistory] = useState<ExchangeHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPhaseConfig, setShowPhaseConfig] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [showExchangeConfirmation, setShowExchangeConfirmation] = useState(false);
  const [exchangeToValidate, setExchangeToValidate] = useState<{
    exchangeId: string;
    interestedUserId: string;
    hasConflict: boolean;
    exchangeUser?: User;
    interestedUser?: User;
  } | null>(null);
  const [showRevertConfirmation, setShowRevertConfirmation] = useState(false);
  const [exchangeToRevert, setExchangeToRevert] = useState<string | null>(null);

  // Utiliser les hooks personnalisés
  const {
    exchanges,
    history,
    setExchanges,
    loading,
    handleValidateExchange,
    handleRejectExchange,
    handleRemoveUser,
    loadExchanges,
    loadHistory
  } = useExchangeManagement(user);

  const { conflictStates, loading: loadingConflicts } = useConflictCheck(exchanges);
  const { userAssignments, loading: loadingAssignments } = useUserAssignments(exchanges);

  useEffect(() => {
    const loadHistoryData = async () => {
      if (!showHistory) return;
      
      try {
        setLoadingHistory(true);
        const historyData = await getExchangeHistory();
        setExchangeHistory(historyData);
      } catch (error) {
        console.error('Error loading exchange history:', error);
        setToast({
          visible: true,
          message: 'Erreur lors du chargement de l\'historique',
          type: 'error'
        });
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistoryData();
  }, [showHistory]);

  // S'assurer que l'historique est rechargé lorsqu'un changement est effectué
  useEffect(() => {
    // Recharger l'historique au premier chargement et à chaque changement de statistics
    loadHistory();
  }, [loadHistory]);

  const handleValidateExchangeClick = async (exchangeId: string, interestedUserId: string, hasConflict: boolean) => {
    if (!user) return;
    
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'La validation des échanges n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }
    
    try {
      await handleValidateExchange(exchangeId, interestedUserId, hasConflict);
      
      // Recharger l'historique pour les statistiques
      await loadHistory();
      
      // Recharger l'historique si on est sur cette vue
      if (showHistory) {
        const updatedHistory = await getExchangeHistory();
        setExchangeHistory(updatedHistory);
      }
      
      setToast({
        visible: true,
        message: 'Échange validé avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error validating exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la validation de l\'échange',
        type: 'error'
      });
    }
  };

  const handleRejectExchangeClick = async (exchangeId: string) => {
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'Le rejet des échanges n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }

    try {
      await handleRejectExchange(exchangeId);
      
      // Recharger l'historique pour les statistiques
      await loadHistory();
      
      setToast({
        visible: true,
        message: 'Échange rejeté avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error rejecting exchange:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du rejet de l\'échange',
        type: 'error'
      });
    }
  };

  const handleRemoveUserClick = async (exchangeId: string, userId: string) => {
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'Le retrait des utilisateurs n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }

    try {
      await handleRemoveUser(exchangeId, userId);
      
      // Recharger l'historique pour les statistiques
      await loadHistory();
      
      setToast({
        visible: true,
        message: 'Utilisateur retiré de l\'échange avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error removing user:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du retrait de l\'utilisateur',
        type: 'error'
      });
    }
  };

  const handleRevertExchange = async (historyId: string) => {
    setExchangeToRevert(historyId);
    setShowRevertConfirmation(true);
  };

  const confirmRevertExchange = async () => {
    if (!exchangeToRevert) return;

    setToast({ visible: false, message: '', type: 'success' });

    const exchange = exchangeHistory.find(h => h.id === exchangeToRevert);
    if (!exchange) {
      setToast({
        visible: true,
        message: 'Échange non trouvé dans l\'historique',
        type: 'error'
      });
      setShowRevertConfirmation(false);
      setExchangeToRevert(null);
      return;
    }

    try {
      // Récupérer les noms des utilisateurs avant l'annulation
      const originalUser = users.find(u => u.id === exchange.originalUserId);
      const newUser = users.find(u => u.id === exchange.newUserId);
      const isPermutation = exchange.isPermutation;
      
      // Effectuer l'annulation
      await revertToExchange(exchangeToRevert);
      
      const userNames = `${originalUser?.lastName || 'Inconnu'} ${isPermutation ? '↔' : '→'} ${newUser?.lastName || 'Inconnu'}`;
      const exchangeType = isPermutation ? 'Permutation' : 'Échange';
      
      setToast({
        visible: true,
        message: `${exchangeType} annulé(e) avec succès (${userNames}). ${isPermutation ? 'Les gardes ont été remises' : 'La garde a été remise'} dans leur état initial.`,
        type: 'success'
      });

      // Recharger l'historique et les échanges
      const [updatedHistory, updatedExchanges] = await Promise.all([
        getExchangeHistory(),
        getShiftExchanges()
      ]);
      
      setExchangeHistory(updatedHistory);
      setExchanges(updatedExchanges);
      
      // Recharger aussi la liste des échanges via le hook
      await loadExchanges();
      
      // Recharger l'historique pour les statistiques
      await loadHistory();
      
    } catch (error) {
      console.error('Error reverting exchange:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setToast({
        visible: true,
        message: `Erreur lors de l'annulation de l'échange : ${errorMessage}. Vérifiez que les plannings des deux médecins existent toujours.`,
        type: 'error'
      });
    } finally {
      setShowRevertConfirmation(false);
      setExchangeToRevert(null);
    }
  };

  const renderStats = () => {
    return (
      <>
        <BagStatsViz
          users={users}
          exchanges={exchanges}
          history={history}
          className="mb-6"
        />
      </>
    );
  };

  if (!user?.roles.isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-medium text-red-800">Accès non autorisé</h2>
          <p className="mt-2 text-sm text-red-700">
            Vous n'avez pas les droits nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  if (loading || loadingConflicts || loadingAssignments) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Gestion des Échanges de Gardes</h1>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowPhaseConfig(true)}
              className="flex items-center px-2 sm:px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              title="Configuration"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Configuration</span>
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={`flex items-center px-2 sm:px-4 py-2 border ${
                showStats
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              title="Statistiques"
            >
              <ChartBar className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Statistiques</span>
            </button>
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                // Recharger les échanges quand on revient à la liste principale
                if (showHistory) {
                  loadExchanges();
                  loadHistory(); // Aussi recharger l'historique pour les statistiques
                }
              }}
              className={`flex items-center px-2 sm:px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                showHistory
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={showHistory ? "Voir les échanges en cours" : "Voir l'historique"}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">
                {showHistory ? 'Échanges en cours' : 'Historique'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <BagPhaseIndicator />
      {showStats && renderStats()}

      <BagPhaseConfigModal
        isOpen={showPhaseConfig}
        onClose={() => setShowPhaseConfig(false)}
      />

      <ConfirmationModal
        isOpen={showRevertConfirmation}
        title="Annuler l'échange"
        message="Êtes-vous sûr de vouloir annuler cet échange ? La garde sera remise dans son état initial et réapparaîtra dans la bourse aux gardes avec tous les utilisateurs intéressés."
        confirmLabel="Annuler l'échange"
        onConfirm={confirmRevertExchange}
        onCancel={() => {
          setShowRevertConfirmation(false);
          setExchangeToRevert(null);
        }}
      />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {showHistory ? (
            loadingHistory ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            ) : (
              <ExchangeHistoryList
                history={exchangeHistory}
                users={users}
                bagPhaseConfig={bagPhaseConfig}
                onRevertExchange={handleRevertExchange}
                onNotify={(historyId) => {
                  setToast({
                    visible: true,
                    message: 'Notification envoyée avec succès',
                    type: 'success'
                  });
                }}
              />
            )
          ) : (
            <ExchangeList
              exchanges={exchanges}
              users={users}
              history={history}
              bagPhaseConfig={bagPhaseConfig}
              conflictStates={conflictStates}
              userAssignments={userAssignments}
              onValidateExchange={handleValidateExchangeClick}
              onRejectExchange={handleRejectExchangeClick}
              onRemoveUser={handleRemoveUserClick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminShiftExchangePage;