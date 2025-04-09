import React, { useCallback, useMemo } from 'react';
import { useAuth } from '../../../features/auth/hooks';
import { useUsers } from '../../../features/auth/hooks';
import { usePlanningPeriod } from '../../../context/planning/PlanningPeriodContext';
import { useComposableExchangeData } from '../hooks';
import { useCalendarNavigation } from '../../shiftExchange/hooks/useCalendarNavigation';
import { addMonths } from 'date-fns';
import { Toast } from '../../../components';
import { DirectExchangeTable, ExchangeModal } from './';
import { ExchangePageTemplate } from '../../shared/exchange/components';
import { useDirectExchangeData } from '../hooks/useDirectExchangeData';
import { useDirectExchangeFilters } from '../hooks/useDirectExchangeFilters';
import { useDirectExchangeModals } from '../hooks/useDirectExchangeModals';
import { useDirectExchangeActions } from '../hooks/useDirectExchangeActions';
import { useDirectProposalActions } from '../hooks/useDirectProposalActions';
import type { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';
import type { OperationType } from '../types';

// Définir un composant fictif pour ExchangeProposalsModal
const ExchangeProposalsModal = (props: any) => <div>ExchangeProposalsModal (Composant fictif)</div>;

/**
 * Composant principal pour la page d'échanges directs
 * Orchestre les différents composants et hooks
 */
const DirectExchangeContainer: React.FC = () => {
  const { user } = useAuth();
  const { users } = useUsers();
  const { currentPeriod } = usePlanningPeriod();
  
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
  
  // Hooks pour la gestion des modals
  const {
    selectedCell,
    setSelectedCell,
    selectedProposedExchange,
    setSelectedProposedExchange,
    selectedExchangeWithProposals,
    setSelectedExchangeWithProposals,
    isLoadingProposals,
    setIsLoadingProposals,
    closeAllModals
  } = useDirectExchangeModals();
  
  // Hook pour les actions sur les échanges
  const {
    toast,
    setToast,
    isProcessing,
    handleModalSubmit,
    updateExchangeOptions,
    removeExchange
  } = useDirectExchangeActions({
    onSuccess: (message) => {
      // Rafraîchir les données immédiatement
      console.log('Action réussie, rafraîchissement des données...');
      loadDirectExchanges();
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
      // Rafraîchir les données immédiatement
      console.log('Action sur proposition réussie, rafraîchissement des données...');
      loadDirectExchanges();
    }
  });
  
  // Fonction pour gérer le clic sur une cellule
  const handleCellClick = async (event: React.MouseEvent, assignment: any, hasIncomingProposals?: boolean, hasUserProposal?: boolean) => {
    if (!assignment) return;
    
    // Normaliser l'assignation pour s'assurer que les données sont au bon format
    const normalizedAssignment = {
      ...assignment,
      // S'assurer que period est défini, sinon utiliser type
      period: assignment.period || assignment.type
    };
    
    console.log('Assignation normalisée pour la recherche d\'échanges:', normalizedAssignment);
    
    // Forcer un rafraîchissement des données avant de continuer
    // pour s'assurer que nous avons les données les plus récentes
    await loadDirectExchanges();
    
    // Vérifier si cette garde a déjà été proposée dans différentes collections
    // en tenant compte de la normalisation des périodes
    const existingExchanges = directExchanges.filter(exchange => {
      const matchesUser = exchange.userId === user?.id;
      const matchesDate = exchange.date === normalizedAssignment.date;
      
      // Vérifier si la période correspond, en tenant compte des deux formats possibles
      const matchesPeriod = exchange.period === normalizedAssignment.period;
      
      return matchesUser && matchesDate && matchesPeriod;
    });
    
    // Récupérer les types d'opération existants
    let existingOperationTypes: OperationType[] = [];
    
    console.log('Échanges existants trouvés:', existingExchanges.length, existingExchanges);
    
    // Parcourir tous les échanges existants
    existingExchanges.forEach(exchange => {
      console.log('Traitement de l\'échange:', exchange.id, 'operationType:', exchange.operationType, 'operationTypes:', exchange.operationTypes);
      
      // Utiliser operationTypes s'il existe
      if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
        console.log('Utilisation de operationTypes:', exchange.operationTypes);
        exchange.operationTypes.forEach((type: OperationType) => {
          if (!existingOperationTypes.includes(type)) {
            existingOperationTypes.push(type);
            console.log('Ajout du type d\'opération:', type);
          }
        });
      } 
      // Sinon, dériver de operationType
      else if (exchange.operationType) {
        console.log('Dérivation à partir de operationType:', exchange.operationType);
        if (exchange.operationType === 'both') {
          if (!existingOperationTypes.includes('exchange')) {
            existingOperationTypes.push('exchange');
            console.log('Ajout du type d\'opération: exchange (from both)');
          }
          if (!existingOperationTypes.includes('give')) {
            existingOperationTypes.push('give');
            console.log('Ajout du type d\'opération: give (from both)');
          }
        } else if (!existingOperationTypes.includes(exchange.operationType)) {
          existingOperationTypes.push(exchange.operationType);
          console.log('Ajout du type d\'opération:', exchange.operationType);
        }
      }
    });
    
    console.log('Types d\'opération existants après traitement:', existingOperationTypes);
    
    // Vérifier également si un remplacement existe pour cette garde
    // en utilisant une requête directe à Firestore pour avoir les données les plus récentes
    const checkReplacement = async () => {
      try {
        // Importer dynamiquement la fonction pour éviter les dépendances circulaires
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase/config');
        
        // Vérifier dans la collection direct_replacements
        const replacementsQuery = query(
          collection(db, 'direct_replacements'),
          where('originalUserId', '==', user?.id),
          where('date', '==', normalizedAssignment.date),
          where('period', '==', normalizedAssignment.period),
          where('status', '==', 'pending')
        );
        
        const replacementSnapshot = await getDocs(replacementsQuery);
        
        if (!replacementSnapshot.empty && !existingOperationTypes.includes('replacement')) {
          console.log('Remplacement trouvé pour cette garde dans direct_replacements');
          existingOperationTypes.push('replacement');
        } else {
          // Vérifier aussi dans la collection remplacements (ancienne collection)
          const oldReplacementsQuery = query(
            collection(db, 'remplacements'),
            where('originalUserId', '==', user?.id),
            where('date', '==', normalizedAssignment.date),
            where('period', '==', normalizedAssignment.period),
            where('status', '==', 'pending')
          );
          
          const oldReplacementSnapshot = await getDocs(oldReplacementsQuery);
          
          if (!oldReplacementSnapshot.empty && !existingOperationTypes.includes('replacement')) {
            console.log('Remplacement trouvé pour cette garde dans remplacements');
            existingOperationTypes.push('replacement');
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des remplacements:', error);
      }
    };
    
    await checkReplacement();
    
    // Vérifier également dans la collection direct_exchanges pour avoir les données les plus récentes
    const checkDirectExchanges = async () => {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase/config');
        
        const exchangesQuery = query(
          collection(db, 'direct_exchanges'),
          where('userId', '==', user?.id),
          where('date', '==', normalizedAssignment.date),
          where('period', '==', normalizedAssignment.period),
          where('status', 'in', ['pending', 'unavailable'])
        );
        
        const exchangeSnapshot = await getDocs(exchangesQuery);
        
        if (!exchangeSnapshot.empty) {
          // Mettre à jour existingExchanges avec les données les plus récentes
          exchangeSnapshot.docs.forEach(doc => {
            const exchange = doc.data();
            const existingIndex = existingExchanges.findIndex(ex => ex.id === doc.id);
            
            // Créer un objet correctement typé en tant que ShiftExchange
            const typedExchange = {
              id: doc.id,
              ...exchange,
              // S'assurer que toutes les propriétés requises sont présentes
              exchangeType: exchange.exchangeType || 'direct',
              operationTypes: exchange.operationTypes || [],
              status: exchange.status || 'pending',
              userId: exchange.userId || user?.id || '',
              date: exchange.date || normalizedAssignment.date,
              period: exchange.period || normalizedAssignment.period,
              createdAt: exchange.createdAt || new Date().toISOString(),
              lastModified: exchange.lastModified || new Date().toISOString()
            } as ExchangeShiftExchange;
            
            if (existingIndex >= 0) {
              // Mettre à jour l'échange existant
              existingExchanges[existingIndex] = typedExchange;
            } else {
              // Ajouter le nouvel échange
              existingExchanges.push(typedExchange);
            }
            
            // Mettre à jour existingOperationTypes
            if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
              exchange.operationTypes.forEach((type: OperationType) => {
                if (!existingOperationTypes.includes(type)) {
                  existingOperationTypes.push(type);
                  console.log('Ajout du type d\'opération depuis Firestore:', type);
                }
              });
            } else if (exchange.operationType) {
              if (exchange.operationType === 'both') {
                if (!existingOperationTypes.includes('exchange')) {
                  existingOperationTypes.push('exchange');
                }
                if (!existingOperationTypes.includes('give')) {
                  existingOperationTypes.push('give');
                }
              } else if (!existingOperationTypes.includes(exchange.operationType)) {
                existingOperationTypes.push(exchange.operationType);
              }
            }
          });
          
          console.log('Échanges mis à jour depuis Firestore:', existingExchanges);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des échanges directs:', error);
      }
    };
    
    await checkDirectExchanges();
    
    // Utiliser le premier échange trouvé comme référence (pour l'ID et le commentaire)
    const primaryExchange = existingExchanges.length > 0 ? existingExchanges[0] : undefined;
    
    // Si la garde a des propositions en attente, ouvrir le modal des propositions
    if (hasIncomingProposals && primaryExchange) {
      try {
        setIsLoadingProposals(true);
        
        // Importer dynamiquement la fonction pour éviter les dépendances circulaires
        const { getProposalsForExchange } = await import('../../../lib/firebase/directExchange');
        
        // Récupérer les propositions pour cet échange
        const directProposals = await getProposalsForExchange(primaryExchange.id);
        
        // Convertir les DirectExchangeProposal en ExchangeProposal
        const proposals = directProposals.map(p => {
          // Gérer les dates de manière sécurisée
          let createdAtString = new Date().toISOString();
          let lastModifiedString = new Date().toISOString();
          
          try {
            if (p.createdAt) {
              if (typeof p.createdAt === 'object' && 'toDate' in p.createdAt && typeof p.createdAt.toDate === 'function') {
                createdAtString = p.createdAt.toDate().toISOString();
              } else if (p.createdAt instanceof Date) {
                createdAtString = p.createdAt.toISOString();
              } else if (typeof p.createdAt === 'string') {
                createdAtString = p.createdAt;
              }
            }
            
            if (p.lastModified) {
              if (typeof p.lastModified === 'object' && 'toDate' in p.lastModified && typeof p.lastModified.toDate === 'function') {
                lastModifiedString = p.lastModified.toDate().toISOString();
              } else if (p.lastModified instanceof Date) {
                lastModifiedString = p.lastModified.toISOString();
              } else if (typeof p.lastModified === 'string') {
                lastModifiedString = p.lastModified;
              }
            }
          } catch (error) {
            console.error('Erreur lors de la conversion des dates:', error);
          }
          
          // S'assurer que proposedShifts est toujours un tableau
          const proposedShifts = Array.isArray(p.proposedShifts) ? p.proposedShifts : [];
          
          return {
            id: p.id || '',
            userId: p.proposingUserId, // Ajouter userId qui est obligatoire dans ExchangeProposal
            targetExchangeId: p.targetExchangeId,
            targetUserId: p.targetUserId,
            proposingUserId: p.proposingUserId,
            proposalType: p.proposalType || 'exchange', // Valeur par défaut
            targetShift: p.targetShift || {
              date: '',
              period: 'M',
              shiftType: '',
              timeSlot: ''
            },
            proposedShifts: proposedShifts,
            comment: p.comment || '',
            status: p.status || 'pending',
            createdAt: createdAtString,
            lastModified: lastModifiedString
          };
        });
        
        // Ouvrir le modal des propositions
        setSelectedExchangeWithProposals({
          exchange: primaryExchange,
          proposals
        });
      } catch (error) {
        console.error('Erreur lors de la récupération des propositions:', error);
        setToast({
          visible: true,
          message: `Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue lors de la récupération des propositions'}`,
          type: 'error'
        });
      } finally {
        setIsLoadingProposals(false);
      }
    } else {
      // Sinon, ouvrir le modal d'échange normal
      setSelectedCell({
        assignment: normalizedAssignment, // Utiliser l'assignation normalisée
        position: { x: 0, y: 0 }, // Valeurs par défaut, ne seront pas utilisées
        existingExchanges: existingExchanges, // Stocker tous les échanges existants
        existingExchange: primaryExchange,
        operationTypes: existingOperationTypes
      });
    }
  };
  
  // Fonction pour gérer la soumission du modal pour ses propres gardes
  const onModalSubmit = (comment: string, operationTypes: OperationType[]) => {
    handleModalSubmit(selectedCell, comment, operationTypes, () => {
      setSelectedCell(null);
    });
  };
  
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
  
  // Fonction pour gérer l'annulation d'une proposition
  // Utilisation de useCallback pour stabiliser la référence de la fonction
  const onCancelProposal = useCallback((exchangeId: string) => {
    // Créer un wrapper pour removeExchange qui accepte un operationType de type string
    const removeExchangeWrapper = (id: string, operationType: string) => {
      return removeExchange(id, operationType as OperationType);
    };
    
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
        // Fermer le modal si nécessaire
        // Note: cette logique pourrait être déplacée dans le hook
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
  const handleToggleInterest = async (exchange: PlanningShiftExchange) => {
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
    let existingOperationTypes: OperationType[] = [];
    
    // Si l'échange a une propriété operationTypes, l'utiliser en priorité
    if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
      existingOperationTypes = [...exchange.operationTypes];
    }
    // Sinon, dériver de operationType
    else {
      // Si l'échange est de type 'both', ajouter les deux types
      if (exchange.operationType === 'both') {
        existingOperationTypes = ['exchange', 'give'];
      }
      // Sinon, ajouter le type d'opération de l'échange
      else if (exchange.operationType === 'exchange' || exchange.operationType === 'give') {
        existingOperationTypes = [exchange.operationType];
      }
      // Par défaut, permettre au moins la reprise
      else {
        existingOperationTypes = ['give'];
      }
    }
    
    console.log('Types d\'opération disponibles pour cet échange:', existingOperationTypes);
    
    // Ouvrir le modal pour proposer un échange ou une reprise
    setSelectedProposedExchange({
      exchange,
      position: { x: e.clientX, y: e.clientY },
      operationTypes: existingOperationTypes
    });
  }, [userProposals, setSelectedProposedExchange]);
  
  // Wrapper pour onCancelProposal qui n'attend pas de paramètres
  const handleCancelProposalWrapper = useCallback(() => {
    if (!selectedProposedExchange) return;
    onCancelProposal(selectedProposedExchange.exchange.id || '');
  }, [onCancelProposal, selectedProposedExchange]);
  
  // Wrappers pour les fonctions passées à ExchangeProposalsModal
  const handleAcceptProposalWrapper = useCallback(async (proposalId: string) => {
    onAcceptProposal(proposalId);
  }, [onAcceptProposal]);
  
  const handleRejectProposalWrapper = useCallback(async (proposalId: string) => {
    onRejectProposal(proposalId);
  }, [onRejectProposal]);
  
  const handleAcceptShiftProposalWrapper = useCallback(async (proposalId: string, shiftIndex: number) => {
    onAcceptShiftProposal(proposalId, shiftIndex);
  }, [onAcceptShiftProposal]);
  
  const handleRejectShiftProposalWrapper = useCallback(async (proposalId: string, shiftIndex: number) => {
    onRejectShiftProposal(proposalId, shiftIndex);
  }, [onRejectShiftProposal]);
  
  const handleUpdateOptionsWrapper = useCallback(async (operationTypes: string[]) => {
    onUpdateExchangeOptions(operationTypes as OperationType[]);
  }, [onUpdateExchangeOptions]);
  
  // Rendu du contenu personnalisé
  const renderCustomContent = () => {
    if (!user) return null;
    
    return (
      <div className="w-full bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="p-4">
          <DirectExchangeTable
            startDate={new Date()}
            endDate={addMonths(new Date(), 3)}
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
        bagPhaseConfig={{ phase: 'submission', submissionDeadline: new Date(), isConfigured: true }}
        isInteractionDisabled={false}
        onToggleInterest={handleToggleInterest}
        onRetry={loadDirectExchanges}
        filterOptions={filterProps}
        renderCustomContent={renderCustomContent}
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
          onSubmit={onModalSubmit}
          initialComment={selectedCell.existingExchange?.comment || ""}
          position={selectedCell.position}
          assignment={selectedCell.assignment}
          exchangeType="direct"
          showReplacementOption={true}
          operationTypes={selectedCell.operationTypes || []}
          existingExchangeId={selectedCell.existingExchange?.id}
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
