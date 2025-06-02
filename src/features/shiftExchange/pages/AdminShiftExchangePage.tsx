import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, History, BarChart as ChartBar, BarChart3 } from 'lucide-react';
import ConfirmationModal from '../../../components/ConfirmationModal';
import Toast from '../../../components/Toast';
import { useShiftExchangeCore } from '../hooks';
import { revertToExchange } from '../../../lib/firebase/exchange';
import type { ExchangeHistory } from '../types';
import { ValidatePlanningButton } from '../../../features/planning/components/admin';
import { useUserAssignments } from '../../../features/users/hooks';
import '../../../styles/BadgeStyles.css';

// Import des composants migrés
import { 
  BagPhaseIndicator,
  BagPhaseConfigModal,
  BagStatsViz
} from '../components';

// Import des composants d'administration
import {
  ExchangeList,
  ExchangeHistoryList,
  ParticipationPanel
} from '../components/admin';

/**
 * Page d'administration de la bourse aux gardes - Version optimisée
 * Utilise le hook centralisé pour éviter les duplications
 */
const AdminShiftExchangePage: React.FC = () => {
  // Hook principal optimisé avec historique activé
  const {
    user,
    users,
    bagPhaseConfig,
    exchanges,
    history,
    loading,
    conflictStates,
    conflictDetails,
    validateExchange,
    rejectExchange,
    removeUser,
    checkForConflict,
    refreshData
  } = useShiftExchangeCore({
    enableHistory: true,
    enableConflictCheck: true,
    limitResults: 200 // Plus de résultats pour l'admin
  });

  // États locaux pour l'interface admin
  const [showHistory, setShowHistory] = useState(false);
  const [showPhaseConfig, setShowPhaseConfig] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showParticipationPanel, setShowParticipationPanel] = useState(false);
  const [selectedForReplacements, setSelectedForReplacements] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ 
    visible: false, 
    message: '', 
    type: 'success' as 'success' | 'error' | 'info' 
  });
  
  // États pour la confirmation d'annulation
  const [showRevertConfirmation, setShowRevertConfirmation] = useState(false);
  const [exchangeToRevert, setExchangeToRevert] = useState<string | null>(null);
  
  // États pour les conflits détaillés par utilisateur
  const [conflictShiftTypes, setConflictShiftTypes] = useState<Record<string, Record<string, string>>>({});
  
  // Hook pour les assignations utilisateur
  const { userAssignments } = useUserAssignments(exchanges);

  // Vérification optimisée des conflits pour chaque utilisateur intéressé
  useEffect(() => {
    const checkAllConflicts = async () => {
      if (!exchanges.length) return;
      
      const newConflictShiftTypes: Record<string, Record<string, string>> = {};
      
      // Utiliser Promise.all pour paralléliser les vérifications
      await Promise.all(
        exchanges.map(async (exchange) => {
          if (!exchange.interestedUsers?.length) return;
          
          newConflictShiftTypes[exchange.id] = {};
          
          // Vérifier les conflits pour tous les utilisateurs intéressés en parallèle
          await Promise.all(
            exchange.interestedUsers.map(async (userId) => {
              const result = await checkForConflict(exchange, userId);
              
              if (result.hasConflict && result.shiftType) {
                newConflictShiftTypes[exchange.id][userId] = result.shiftType;
              }
            })
          );
        })
      );
      
      setConflictShiftTypes(newConflictShiftTypes);
    };
    
    checkAllConflicts();
  }, [exchanges, checkForConflict]);

  // Calcul mémorisé des conflits par échange et utilisateur
  const adminConflictStates = useMemo(() => {
    const states: Record<string, Record<string, boolean>> = {};
    
    exchanges.forEach(exchange => {
      if (!exchange.interestedUsers?.length) return;
      
      states[exchange.id] = {};
      exchange.interestedUsers.forEach(userId => {
        // Vérifier si un conflit existe pour cet utilisateur
        const hasConflict = Boolean(conflictShiftTypes[exchange.id]?.[userId]);
        states[exchange.id][userId] = hasConflict;
      });
    });
    
    return states;
  }, [exchanges, conflictShiftTypes]);

  // Gestion optimisée de la validation d'échange
  const handleValidateExchangeClick = useCallback(async (
    exchangeId: string, 
    interestedUserId: string, 
    hasConflict: boolean
  ) => {
    if (!user?.roles.isAdmin) return;
    
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'La validation des échanges n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }
    
    try {
      await validateExchange(exchangeId, interestedUserId, hasConflict);
      
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
  }, [user, bagPhaseConfig.phase, validateExchange]);

  // Gestion du rejet d'échange
  const handleRejectExchangeClick = useCallback(async (exchangeId: string) => {
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'Le rejet des échanges n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }

    try {
      await rejectExchange(exchangeId);
      
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
  }, [bagPhaseConfig.phase, rejectExchange]);

  // Gestion du retrait d'utilisateur
  const handleRemoveUserClick = useCallback(async (exchangeId: string, userId: string) => {
    if (bagPhaseConfig.phase !== 'distribution') {
      setToast({
        visible: true,
        message: 'Le retrait des utilisateurs n\'est possible qu\'en phase de distribution',
        type: 'error'
      });
      return;
    }

    try {
      await removeUser(exchangeId, userId);
      
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
  }, [bagPhaseConfig.phase, removeUser]);

  // Gestion de l'annulation d'échange
  const handleRevertExchange = useCallback(async (historyId: string) => {
    setExchangeToRevert(historyId);
    setShowRevertConfirmation(true);
  }, []);

  const confirmRevertExchange = useCallback(async () => {
    if (!exchangeToRevert) return;

    const exchange = history.find(h => h.id === exchangeToRevert);
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
      const originalUser = users.find(u => u.id === exchange.originalUserId);
      const newUser = users.find(u => u.id === exchange.newUserId);
      const isPermutation = exchange.isPermutation;
      
      await revertToExchange(exchangeToRevert);
      
      const userNames = `${originalUser?.lastName || 'Inconnu'} ${isPermutation ? '↔' : '→'} ${newUser?.lastName || 'Inconnu'}`;
      const exchangeType = isPermutation ? 'Permutation' : 'Échange';
      
      // Attendre un peu pour la propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Rafraîchir les données
      await refreshData();
      
      setToast({
        visible: true,
        message: `${exchangeType} annulé(e) avec succès (${userNames})`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error reverting exchange:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setToast({
        visible: true,
        message: `Erreur lors de l'annulation : ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setShowRevertConfirmation(false);
      setExchangeToRevert(null);
    }
  }, [exchangeToRevert, history, users, refreshData]);

  // Rendu optimisé des statistiques
  const renderStats = useMemo(() => {
    if (!showStats) return null;
    
    return (
      <BagStatsViz
        users={users}
        exchanges={exchanges as any}
        history={history as any}
        className="mb-6"
      />
    );
  }, [showStats, users, exchanges, history]);

  // Vérification des droits admin
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

  // État de chargement initial
  if (loading && exchanges.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
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
          <ValidatePlanningButton 
            onSuccess={(message) => setToast({ visible: true, message, type: 'success' })}
            onError={(message) => setToast({ visible: true, message, type: 'error' })}
          />
          <button
            onClick={() => setShowPhaseConfig(true)}
            className={`flex items-center px-2 sm:px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
              bagPhaseConfig.phase === 'closed' 
                ? 'border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:ring-gray-500'
                : bagPhaseConfig.phase === 'submission' 
                ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500'
                : bagPhaseConfig.phase === 'matching' 
                ? 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 focus:ring-purple-500'
                : bagPhaseConfig.phase === 'distribution' 
                ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
            }`}
            title="Cliquer pour configurer les phases"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">
              Phase: {
                bagPhaseConfig.phase === 'closed' ? 'Fermée' :
                bagPhaseConfig.phase === 'submission' ? 'Position' :
                bagPhaseConfig.phase === 'matching' ? 'Appariement' :
                bagPhaseConfig.phase === 'distribution' ? 'Distribution' :
                'Terminée'
              }
            </span>
            <span className="sm:hidden ml-1 text-xs font-bold">
              {
                bagPhaseConfig.phase === 'closed' ? 'F' :
                bagPhaseConfig.phase === 'submission' ? 'P' :
                bagPhaseConfig.phase === 'matching' ? 'A' :
                bagPhaseConfig.phase === 'distribution' ? 'D' :
                'T'
              }
            </span>
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
            onClick={() => setShowHistory(!showHistory)}
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

      <BagPhaseIndicator />
      {renderStats}

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

      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
        <div className="overflow-x-auto">
          {showHistory ? (
            <ExchangeHistoryList
              history={history}
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
          ) : (
            <ExchangeList
              exchanges={exchanges as any}
              users={users}
              history={history as any}
              bagPhaseConfig={bagPhaseConfig}
              conflictStates={adminConflictStates}
              conflictShiftTypes={conflictShiftTypes}
              userAssignments={userAssignments}
              onValidateExchange={handleValidateExchangeClick}
              onRejectExchange={handleRejectExchangeClick}
              onRemoveUser={handleRemoveUserClick}
              selectedForReplacements={selectedForReplacements}
              onSelectedForReplacementsChange={setSelectedForReplacements}
            />
          )}
        </div>
      </div>

      {/* Panneau flottant de participation */}
      <ParticipationPanel
        exchanges={exchanges as any}
        users={users}
        history={history as any}
        isOpen={showParticipationPanel}
        onToggle={() => setShowParticipationPanel(!showParticipationPanel)}
        onClose={() => setShowParticipationPanel(false)}
      />

      {/* Bouton flottant pour ouvrir le panneau de participation */}
      <button
        onClick={() => setShowParticipationPanel(!showParticipationPanel)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 ${
          showParticipationPanel
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-indigo-600 hover:bg-indigo-700'
        } text-white flex items-center justify-center`}
        title="Taux de participation"
      >
        <BarChart3 className="h-6 w-6" />
      </button>
    </div>
  );
};

export default AdminShiftExchangePage;