import React, { useState, useEffect } from 'react';
import { Settings, History, BarChart as ChartBar } from 'lucide-react';
import ConfirmationModal from '../../../components/ConfirmationModal';
import { useAuth } from '../../../features/auth/hooks';
import { getExchangeHistory, revertToExchange } from '../../../lib/firebase/exchange';
import { useUsers } from '../../../features/auth/hooks';
import Toast from '../../../components/Toast';
import { useBagPhase } from '../../../context/shiftExchange';
import type { ExchangeHistory } from '../types';
// Import depuis le fichier index.ts
import { ValidatePlanningButton } from '../../../features/planning/components/admin';
import { useUserAssignments } from '../../../features/users/hooks';
import '../../../styles/BadgeStyles.css';

// Import des hooks migrés
import { useExchangeManagement, useConflictCheck } from '../hooks';

// Import des composants migrés
import { 
  BagPhaseIndicator,
  BagPhaseConfigModal,
  BagStatsViz
} from '../components';

// Import des composants d'administration migrés
import {
  ExchangeList,
  ExchangeHistoryList
} from '../components/admin';

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
  // Variables d'état pour la confirmation d'annulation d'échange
  const [showRevertConfirmation, setShowRevertConfirmation] = useState(false);
  const [exchangeToRevert, setExchangeToRevert] = useState<string | null>(null);

  // Utiliser les hooks personnalisés
  const {
    exchanges,
    history,
    loading,
    handleValidateExchange,
    handleRejectExchange,
    handleRemoveUser,
    loadExchanges,
    loadHistory,
    refreshData
  } = useExchangeManagement(user);

  const { checkUserConflict } = useConflictCheck(exchanges);
  const [conflictStates, setConflictStates] = useState<Record<string, Record<string, boolean>>>({});
  const [conflictShiftTypes, setConflictShiftTypes] = useState<Record<string, Record<string, string>>>({});
  
  // Effet pour vérifier manuellement les conflits pour chaque utilisateur intéressé
  useEffect(() => {
    const checkConflicts = async () => {
      if (!exchanges.length) return;
      
      const newConflictStates: Record<string, Record<string, boolean>> = {};
      const newConflictShiftTypes: Record<string, Record<string, string>> = {};
      
      for (const exchange of exchanges) {
        if (!exchange.interestedUsers?.length) continue;
        
        newConflictStates[exchange.id] = {};
        newConflictShiftTypes[exchange.id] = {};
        
        for (const userId of exchange.interestedUsers) {
          // Utiliser un cast pour résoudre le problème de type
          const result = await checkUserConflict(userId, exchange as any);
          newConflictStates[exchange.id][userId] = result.hasConflict;
          
          if (result.hasConflict && result.shiftType) {
            newConflictShiftTypes[exchange.id][userId] = result.shiftType;
          }
          
          console.log(`Conflit vérifié pour ${userId} sur ${exchange.date}-${exchange.period}:`, result);
        }
      }
      
      setConflictStates(newConflictStates);
      setConflictShiftTypes(newConflictShiftTypes);
    };
    
    checkConflicts();
  }, [exchanges, checkUserConflict]);
  const { userAssignments } = useUserAssignments(exchanges);

  // Utiliser directement l'historique du hook qui utilise un abonnement temps réel
  useEffect(() => {
    if (showHistory) {
      setExchangeHistory(history);
      setLoadingHistory(false);
    }
  }, [showHistory, history]);

  // L'historique est maintenant géré par le hook avec un abonnement temps réel
  // Pas besoin de chargement supplémentaire

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
      // Utiliser un try-catch pour capturer l'erreur spécifique
      await handleValidateExchange(exchangeId, interestedUserId, hasConflict);
      
      // L'historique est déjà rechargé par handleValidateExchange via useExchangeManagement
      
      // Recharger l'historique si on est sur cette vue
      if (showHistory) {
        try {
          const updatedHistory = await getExchangeHistory();
          setExchangeHistory(updatedHistory);
        } catch (historyError) {
          console.warn('Failed to refresh history view:', historyError);
          // Continue même en cas d'erreur car ce n'est pas critique
        }
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
      
      // L'historique est déjà rechargé par handleRejectExchange
      
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
      
      // L'historique est déjà rechargé par handleRemoveUser
      
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

  const handleRevertExchange = async (historyId: string): Promise<void> => {
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
      
      console.log('Début de l\'annulation de l\'échange:', {
        exchangeId: exchangeToRevert,
        originalUser: originalUser?.lastName,
        newUser: newUser?.lastName,
        isPermutation
      });
      
      // Effectuer l'annulation
      await revertToExchange(exchangeToRevert);
      
      const userNames = `${originalUser?.lastName || 'Inconnu'} ${isPermutation ? '↔' : '→'} ${newUser?.lastName || 'Inconnu'}`;
      const exchangeType = isPermutation ? 'Permutation' : 'Échange';
      
      console.log('Annulation réussie, mise à jour des données...');
      
      // Attendre un court délai pour s'assurer que Firestore a eu le temps de propager les changements
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // Utiliser la fonction refreshData pour recharger toutes les données
        // Cette fonction a été améliorée pour contourner le cache et forcer le rechargement
        console.log('Rechargement forcé des données...');
        const refreshSuccess = await refreshData();
        console.log('Rechargement des données terminé:', refreshSuccess);
        
        // Recharger aussi l'historique spécifiquement pour la vue actuelle
        if (showHistory) {
          console.log('Rechargement spécifique de l\'historique pour la vue actuelle...');
          const updatedHistory = await getExchangeHistory();
          setExchangeHistory(updatedHistory);
          console.log('Historique rechargé:', updatedHistory.length, 'entrées');
        }
        
        setToast({
          visible: true,
          message: `${exchangeType} annulé(e) avec succès (${userNames}). ${isPermutation ? 'Les gardes ont été remises' : 'La garde a été remise'} dans leur état initial.`,
          type: 'success'
        });
      } catch (refreshError) {
        console.error('Error refreshing data after revert:', refreshError);
        
        // Même en cas d'erreur de rafraîchissement, afficher un message de succès
        // car l'annulation a réussi, c'est juste le rafraîchissement qui a échoué
        setToast({
          visible: true,
          message: `${exchangeType} annulé(e) avec succès (${userNames}), mais le rafraîchissement des données a échoué. Veuillez rafraîchir la page manuellement.`,
          type: 'success'
        });
      }
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

  // Calculer ou recalculer les statistiques à chaque fois
  const renderStats = () => {
    return (
      <>
        <BagStatsViz
          users={users}
          exchanges={exchanges as any}
          history={history as any}
          className="mb-6"
          key={`stats-${Date.now()}`} // Forcer un remontage du composant à chaque affichage
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

  // Affichage pendant le chargement initial uniquement
  if (loading && exchanges.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Gestion des Échanges de Gardes</h1>
          <div className="flex gap-2">
            <ValidatePlanningButton 
              onSuccess={(message) => setToast({ visible: true, message, type: 'success' })}
              onError={(message) => setToast({ visible: true, message, type: 'error' })}
            />
            <button
              onClick={() => setShowPhaseConfig(true)}
              className="flex items-center px-2 sm:px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Configuration</span>
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center px-2 sm:px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ChartBar className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Statistiques</span>
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center px-2 sm:px-4 py-2 border rounded-md text-sm font-medium transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Historique</span>
            </button>
          </div>
        </div>

        <BagPhaseIndicator />
        
        <div className="animate-pulse mt-6">
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
            <ValidatePlanningButton 
              onSuccess={(message) => setToast({ visible: true, message, type: 'success' })}
              onError={(message) => setToast({ visible: true, message, type: 'error' })}
            />
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
                onNotify={(historyId: string) => {
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
              exchanges={exchanges as any}
              users={users}
              history={history as any}
              bagPhaseConfig={bagPhaseConfig}
              conflictStates={conflictStates}
              conflictShiftTypes={conflictShiftTypes}
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
