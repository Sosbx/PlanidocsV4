import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { createParisDate, firebaseTimestampToParisDate, addMonthsParis } from '@/utils/timezoneUtils';
import { useAuth } from '../../../features/auth/hooks';
import { useUsers } from '../../../features/auth/hooks/useUsers';
import { usePlanningPeriod } from '../../../context/planning/PlanningPeriodContext';
import { useComposableExchangeData, useDirectExchangeCallbacks, useExchangeModal } from '../hooks';
import { useCalendarNavigation } from '../../shiftExchange/hooks/useCalendarNavigation';
import { addMonths } from 'date-fns';
import Toast from '../../../components/common/Toast';
import { DirectExchangeTable, ExchangeModal, ProposedShiftModal, ExchangeProposalsModal } from './';
import { ExchangePageTemplate } from '../../shared/exchange/components';
import { useDirectExchangeData } from '../hooks/useDirectExchangeData';
import { useDirectExchangeFilters } from '../hooks/useDirectExchangeFilters';
import { useDirectExchangeModals } from '../hooks/useDirectExchangeModals';
import { useDirectExchangeActions } from '../hooks/useDirectExchangeActions';
import { useDirectProposalActions } from '../hooks/useDirectProposalActions';
import { useBottomNavPadding } from '../../../hooks/useBottomNavPadding';
import { useDebounce } from '../../../hooks/useDebounce';
import { 
  validateOperationTypes, 
  sanitizeOperationTypes, 
  fetchExchangeDataForCellWithCache, 
  invalidateExchangeDataCache, 
  invalidateAllExchangeDataCache,
  prepareModalData,
  determineAvailableOperationTypes,
  normalizeAssignment,
  createExchangeSubmissionHandlers,
  createRemoveExchangeWrapper
} from '../utils';
import type { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';
import type { OperationType } from '../types';

/**
 * Composant principal pour la page d'échanges directs
 * Orchestre les différents composants et hooks
 */
const DirectExchangeContainer: React.FC = () => {
  const { user } = useAuth();
  const { users } = useUsers();
  const { } = usePlanningPeriod();
  const bottomNavPadding = useBottomNavPadding();
  
  // Hooks pour la gestion des données et des filtres
  const { filterOptions, filterProps } = useDirectExchangeFilters();
  
  // Hook pour la navigation du calendrier
  const {
    currentMonth,
    setCurrentMonth,
    calendarViewMode,
    isMobile,
    isSmallScreen,
    calendarContainerRef,
    initializeCalendarFromDateString
  } = useCalendarNavigation('list');
  
  // Hook pour les données des échanges
  const { 
    directExchanges,
    receivedProposals,
    userProposals,
    loading,
    error,
    loadDirectExchanges
  } = useDirectExchangeData(null); // Initialement null, sera mis à jour après le chargement de userAssignments
  
  // Hook pour les données composables des échanges
  const { 
    userAssignments,
    conflictStates: rawConflictStates,
    conflictPeriodsMap: rawConflictPeriodsMap,
    interestedPeriodsMap: rawInterestedPeriodsMap,
    receivedShifts: exchangeReceivedShifts
  } = useComposableExchangeData(users, {
    ...filterOptions,
    setToast: () => {} // Placeholder, sera remplacé par le setToast du hook d'actions
  });
  
  // Convertir les états de conflit au format attendu par ExchangePageTemplate
  const conflictStates = useMemo(() => {
    const result: Record<string, boolean> = {};
    Object.entries(rawConflictStates || {}).forEach(([key, value]) => {
      result[key] = Boolean(value);
    });
    return result;
  }, [rawConflictStates]);
  
  // Convertir les périodes de conflit au format attendu par ExchangePageTemplate
  const conflictPeriodsMap = useMemo(() => {
    const result: Record<string, boolean> = {};
    Object.entries(rawConflictPeriodsMap || {}).forEach(([key, value]) => {
      result[key] = Array.isArray(value) && value.length > 0;
    });
    return result;
  }, [rawConflictPeriodsMap]);
  
  // Convertir les périodes intéressées au format attendu par ExchangePageTemplate
  const interestedPeriodsMap = useMemo(() => {
    const result: Record<string, boolean> = {};
    Object.entries(rawInterestedPeriodsMap || {}).forEach(([key, value]) => {
      result[key] = Array.isArray(value) && value.length > 0;
    });
    return result;
  }, [rawInterestedPeriodsMap]);
  
  // Hook unifié pour gérer le modal d'échange
  const {
    selectedCell,
    setSelectedCell,
    handleSubmit: handleModalSubmit,
    handleRemove,
    isProcessing
  } = useExchangeModal(user?.id, {
    onSuccess: (message) => {
      setToast({
        visible: true,
        message,
        type: 'success'
      });
    },
    onError: (message) => {
      setToast({
        visible: true,
        message,
        type: 'error'
      });
    },
    refreshData: loadDirectExchanges,
    removeExchange: async (id: string, operationType?: OperationType) => {
      // Utiliser la fonction removeExchange existante
      const { removeExchange: removeExchangeFn } = await import('../../../lib/firebase/directExchange');
      await removeExchangeFn(id, operationType);
    }
  });

  // Hooks pour la gestion des autres modals
  const {
    selectedProposedExchange,
    setSelectedProposedExchange,
    selectedExchangeWithProposals,
    setSelectedExchangeWithProposals,
    isLoadingProposals,
    setIsLoadingProposals,
    closeAllModals
  } = useDirectExchangeModals();
  
  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  // Hook pour les actions supplémentaires (updateExchangeOptions, removeExchange)
  const { updateExchangeOptions, removeExchange } = useDirectExchangeActions({
    onSuccess: () => {
      invalidateAllExchangeDataCache();
      loadDirectExchanges();
      window.dispatchEvent(new CustomEvent('directExchangeUpdated'));
    }
  });
  
  // Hook pour les actions sur les propositions
  const {
    handleAcceptProposal,
    handleRejectProposal,
    handleProposedExchangeSubmit,
    handleCancelProposal,
    handleAcceptShiftProposal,
    handleRejectShiftProposal
  } = useDirectProposalActions(userProposals, userAssignments, {
    onSuccess: (message) => {
      // Invalider le cache et rafraîchir les données
      console.log('Action sur proposition réussie, invalidation du cache...');
      invalidateAllExchangeDataCache();
      loadDirectExchanges();
      
      // Émettre l'événement global pour synchroniser avec les autres composants
      window.dispatchEvent(new CustomEvent('directExchangeUpdated'));
    }
  });
  
  // Fonction de base pour gérer le clic sur une cellule
  const handleCellClickBase = useCallback(async (event: React.MouseEvent, assignment: any, hasIncomingProposals?: boolean, hasUserProposal?: boolean) => {
    if (!assignment || !user?.id) return;
    
    // Normaliser l'assignation
    const normalizedAssignment = normalizeAssignment(assignment);
    
    console.log('🔍 Récupération optimisée des données pour la cellule:', normalizedAssignment);
    
    try {
      // Utiliser notre nouvelle fonction optimisée qui combine toutes les requêtes
      const { directExchanges: existingExchanges, operationTypes: existingOperationTypes } = await fetchExchangeDataForCellWithCache({
        userId: user.id,
        date: normalizedAssignment.date,
        period: normalizedAssignment.period
      });
      
      console.log('✅ Données récupérées:', {
        exchanges: existingExchanges.length,
        operationTypes: existingOperationTypes
      });
      // Les requêtes Firebase ont déjà été effectuées de manière optimisée
      const primaryExchange = existingExchanges.length > 0 ? existingExchanges[0] : undefined;
      
      // Préparer les données pour le modal approprié
      setIsLoadingProposals(true);
      
      try {
        const modalData = await prepareModalData(
          primaryExchange,
          normalizedAssignment,
          existingExchanges,
          existingOperationTypes
        );
        
        // Ouvrir le modal approprié selon le type
        if (modalData.type === 'proposals') {
          setSelectedExchangeWithProposals({
            exchange: modalData.data.exchange!,
            proposals: modalData.data.proposals!
          });
        } else {
          setSelectedCell({
            assignment: modalData.data.assignment!,
            position: { x: 0, y: 0 },
            existingExchanges: modalData.data.existingExchanges!,
            existingExchange: modalData.data.exchange,
            operationTypes: modalData.data.operationTypes as OperationType[]
          });
        }
      } catch (error) {
        console.error('Erreur lors de la préparation du modal:', error);
        setToast({
          visible: true,
          message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
          type: 'error'
        });
        
        // En cas d'erreur, ouvrir le modal d'échange standard
        setSelectedCell({
          assignment: normalizedAssignment,
          position: { x: 0, y: 0 },
          existingExchanges: existingExchanges,
          existingExchange: primaryExchange,
          operationTypes: existingOperationTypes
        });
      } finally {
        setIsLoadingProposals(false);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la récupération des données. Veuillez réessayer.',
        type: 'error'
      });
      return;
    }
  }, [user, setToast, setIsLoadingProposals, setSelectedExchangeWithProposals, setSelectedCell]);

  // Version débouncée de handleCellClick pour éviter les doubles clics
  const handleCellClick = useDebounce(handleCellClickBase, 1000);
  
  // Le hook unifié gère maintenant la soumission du modal
  // handleModalSubmit est directement utilisé depuis le hook
  
  // Fonction pour gérer la soumission du modal pour les gardes proposées
  const onProposedExchangeSubmit = (exchangeId: string, userShiftKeys?: string, comment?: string, operationType?: string) => {
    if (!selectedProposedExchange) return;
    
    handleProposedExchangeSubmit(
      exchangeId,
      selectedProposedExchange.exchange,
      userShiftKeys,
      comment,
      operationType,
      () => {
        setSelectedProposedExchange(null);
      }
    );
  };
  
  // Créer les handlers pour les soumissions d'échange
  const { handleCessionSubmit, handleExchangeSubmit } = createExchangeSubmissionHandlers(
    selectedProposedExchange,
    handleProposedExchangeSubmit,
    setSelectedProposedExchange
  );
  
  // Fonction pour gérer l'annulation d'une proposition
  const onCancelProposal = useCallback((exchangeId: string) => {
    const removeExchangeWrapper = createRemoveExchangeWrapper(removeExchange);
    
    handleCancelProposal(
      exchangeId,
      directExchanges,
      removeExchangeWrapper,
      () => {
        setSelectedProposedExchange(null);
      }
    );
  }, [directExchanges, handleCancelProposal, removeExchange, setSelectedProposedExchange]);
  
  // Fonction pour gérer l'acceptation d'une proposition
  const onAcceptProposal = (proposalId: string) => {
    if (!selectedExchangeWithProposals) return;
    
    handleAcceptProposal(
      proposalId,
      selectedExchangeWithProposals.exchange,
      () => {
        // Fermer le modal après l'acceptation réussie
        setSelectedExchangeWithProposals(null);
        
        // Afficher une confirmation
        setToast({
          visible: true,
          message: 'Échange effectué avec succès ! Les plannings ont été mis à jour.',
          type: 'success'
        });
        
        // Invalider le cache et rafraîchir les données
        invalidateAllExchangeDataCache();
        loadDirectExchanges();
      }
    );
  };
  
  // Fonction pour gérer le rejet d'une proposition
  const onRejectProposal = (proposalId: string) => {
    handleRejectProposal(
      proposalId,
      () => {
        // Fermer le modal si nécessaire
        // Note: cette logique pourrait être déplacée dans le hook
      }
    );
  };
  
  // Fonction pour gérer l'acceptation d'une garde spécifique
  const onAcceptShiftProposal = (proposalId: string, shiftIndex: number) => {
    if (!selectedExchangeWithProposals) return;
    
    handleAcceptShiftProposal(
      proposalId,
      shiftIndex,
      selectedExchangeWithProposals.exchange,
      () => {
        // Fermer le modal si nécessaire
        // Note: cette logique pourrait être déplacée dans le hook
      }
    );
  };
  
  // Fonction pour gérer le rejet d'une garde spécifique
  const onRejectShiftProposal = (proposalId: string, shiftIndex: number) => {
    if (!selectedExchangeWithProposals) return;
    
    handleRejectShiftProposal(
      proposalId,
      shiftIndex,
      selectedExchangeWithProposals.exchange,
      () => {
        // Fermer le modal si nécessaire
        // Note: cette logique pourrait être déplacée dans le hook
      }
    );
  };
  
  // Fonction pour gérer la mise à jour des options d'échange
  const onUpdateExchangeOptions = (operationTypes: OperationType[]) => {
    if (!selectedExchangeWithProposals) return;
    
    updateExchangeOptions(
      selectedExchangeWithProposals.exchange.id,
      operationTypes,
      () => {
        setSelectedExchangeWithProposals(null);
      }
    );
  };
  
  // Simuler un handleToggleInterest pour la compatibilité avec ExchangePageTemplate
  const handleToggleInterest = async (exchange: any) => {
    // Cette fonction est un placeholder pour la compatibilité avec ExchangePageTemplate
    // Dans DirectExchangePage, nous n'utilisons pas cette fonctionnalité
    console.log('Toggle interest not implemented for DirectExchangePage');
    return Promise.resolve();
  };
  
  // Définir les callbacks au niveau supérieur du composant
  const handleProposedShiftClick = useCallback((e: React.MouseEvent, exchange: any) => {
    // Vérifier si l'utilisateur a déjà fait une proposition pour cet échange
    const hasProposal = userProposals.some(p => p.targetExchangeId === exchange.id);
    
    // Déterminer les types d'opération disponibles
    const existingOperationTypes = determineAvailableOperationTypes(exchange);
    
    // Ouvrir le modal pour proposer un échange ou une reprise avec notre nouveau composant
    setSelectedProposedExchange({
      exchange,
      position: { x: e.clientX, y: e.clientY },
      operationTypes: existingOperationTypes
    });
  }, [userProposals, setSelectedProposedExchange]);
  
  // Utiliser le hook pour gérer tous les wrappers de callbacks
  const {
    handleCancelProposalWrapper,
    handleAcceptProposalWrapper,
    handleRejectProposalWrapper,
    handleAcceptShiftProposalWrapper,
    handleRejectShiftProposalWrapper,
    handleUpdateOptionsWrapper
  } = useDirectExchangeCallbacks({
    onCancelProposal,
    onAcceptProposal,
    onRejectProposal,
    onAcceptShiftProposal,
    onRejectShiftProposal,
    onUpdateExchangeOptions,
    selectedProposedExchange
  });
  
  // Écouter l'événement global pour rafraîchir les données
  useEffect(() => {
    const handleDirectExchangeUpdate = () => {
      console.log('Événement directExchangeUpdated reçu, rafraîchissement des données...');
      invalidateAllExchangeDataCache();
      loadDirectExchanges();
    };
    
    window.addEventListener('directExchangeUpdated', handleDirectExchangeUpdate);
    
    return () => {
      window.removeEventListener('directExchangeUpdated', handleDirectExchangeUpdate);
    };
  }, [loadDirectExchanges]);
  
  // Rendu du contenu personnalisé
  const renderCustomContent = () => {
    if (!user) return null;
    
    return (
      <div className="w-full bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="p-4">
          <DirectExchangeTable
            startDate={createParisDate()}
            endDate={addMonthsParis(createParisDate(), 3)}
            userAssignments={userAssignments || {}}
            directExchanges={directExchanges}
            receivedProposals={receivedProposals}
            userProposals={userProposals}
            user={user}
            users={users}
            onUserShiftClick={handleCellClick}
            onProposedShiftClick={handleProposedShiftClick}
            onAcceptProposal={async () => Promise.resolve()}
            onRejectProposal={async () => Promise.resolve()}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Utilisation du template de page d'échange */}
      <ExchangePageTemplate
        title="Échanges Directs"
        description="Cette page vous permet d'échanger directement vos gardes avec d'autres médecins. Ces échanges concernent le planning validé et ne sont pas soumis aux phases de la bourse aux gardes."
        user={user}
        users={users}
        exchanges={directExchanges as unknown as PlanningShiftExchange[]}
        filteredExchanges={directExchanges as unknown as PlanningShiftExchange[]}
        loading={loading}
        error={error}
        userAssignments={userAssignments || {}}
        receivedShifts={exchangeReceivedShifts}
        conflictStates={conflictStates}
        conflictPeriodsMap={conflictPeriodsMap}
        interestedPeriodsMap={interestedPeriodsMap}
        bagPhaseConfig={{ phase: 'submission', submissionDeadline: createParisDate(), isConfigured: true }}
        isInteractionDisabled={false}
        onToggleInterest={handleToggleInterest}
        onRetry={loadDirectExchanges}
        filterOptions={filterProps}
        renderCustomContent={renderCustomContent}
        className={bottomNavPadding}
        isMobile={isMobile}
        isSmallScreen={isSmallScreen}
      />
      
      {/* Toast pour les notifications */}
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.visible}
          onClose={() => setToast({ ...toast, visible: false })}
        />
      )}
      
      {/* Modal pour proposer un échange direct */}
      {selectedCell && (
        <ExchangeModal
          isOpen={true}
          onClose={() => setSelectedCell(null)}
          onSubmit={handleModalSubmit}
          onRemove={handleRemove}
          initialComment={selectedCell.existingExchange?.comment || ""}
          position={selectedCell.position}
          assignment={selectedCell.assignment}
          exchangeType="direct"
          showReplacementOption={true}
          operationTypes={selectedCell.operationTypes || []}
          existingExchangeId={selectedCell.existingExchange?.id}
        />
      )}
      
      {/* Nouveau modal pour les gardes proposées */}
      {selectedProposedExchange && (
        <ProposedShiftModal
          isOpen={true}
          onClose={() => setSelectedProposedExchange(null)}
          exchange={selectedProposedExchange.exchange}
          userAssignments={userAssignments || {}}
          onSubmitExchange={handleExchangeSubmit}
          onSubmitCession={handleCessionSubmit}
          onCancel={userProposals.some(p => p.targetExchangeId === selectedProposedExchange.exchange.id) ? handleCancelProposalWrapper : undefined}
        />
      )}
      
      {/* Modal pour afficher et gérer les propositions reçues */}
      {selectedExchangeWithProposals && (
        <ExchangeProposalsModal
          isOpen={true}
          onClose={() => setSelectedExchangeWithProposals(null)}
          exchange={selectedExchangeWithProposals.exchange}
          proposals={selectedExchangeWithProposals.proposals}
          users={users}
          onAccept={handleAcceptProposalWrapper}
          onReject={handleRejectProposalWrapper}
          onAcceptShift={handleAcceptShiftProposalWrapper}
          onRejectShift={handleRejectShiftProposalWrapper}
          onUpdateOptions={handleUpdateOptionsWrapper}
        />
      )}
    </>
  );
};

export default DirectExchangeContainer;
