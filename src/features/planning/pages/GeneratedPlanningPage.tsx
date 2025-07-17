import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import logger from '../../../utils/logger';
import { format } from 'date-fns';
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { usePlanningPeriod } from '../../../context/planning';
import { useUsers } from '../../auth/hooks/useUsers';
import { useBagPhase } from '../../../context/shiftExchange';
import { useOptimizedPlannings, useUserAssignments } from '../hooks/useOptimizedPlannings';
import { 
  saveGeneratedPlanning, 
  deletePlanning, 
  exportUserPlanningHistoryToCsv
} from '../../../lib/firebase/planning';
import { getAllDesiderata } from '../../../lib/firebase/desiderata';
import { useAssociation } from '../../../context/association/AssociationContext';
import { LoadingSpinner } from '../../../components/common';
import { ConfirmationModal } from '../../../components/modals';
import Toast from '../../../components/common/Toast';
import { loadGeneratedPlanningExporters as loadOriginalExporters } from '../../../utils/lazyExporters';
import type { User } from '../../../types/users';
import type { ShiftAssignment, GeneratedPlanning } from '../../../types/planning';
import { PlanningViewProvider } from '../context';
import { 
  AdminPlanningContainer,
  PeriodManagement,
  HistoryExport,
  ImportedPlanningsManager,
  GlobalPlanningView,
  ShiftTypeStatisticsTable 
} from '../components/admin';

// Import dynamique du composant lourd
const GeneratedPlanningTable = lazy(() => import('../components/GeneratedPlanningTable'));

// Wrapper pour adapter les types retournés par loadGeneratedPlanningExporters
const loadGeneratedPlanningExporters = () => loadOriginalExporters().then(exporters => ({
  toPdf: async (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date, desiderata?: any, showAssignmentsOnly?: boolean) => {
    // La fonction gère déjà le téléchargement en interne
    await exporters.toPdf(assignments, userName, startDate, endDate, desiderata, showAssignmentsOnly);
  },
  toCsv: async (assignments: Record<string, ShiftAssignment>, userName: string) => {
    exporters.toCsv(assignments, userName);
  },
  allToPdf: async (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date, desiderataMap?: any, showAssignmentsOnly?: boolean) => {
    await exporters.allToPdf(users, planningsMap, startDate, endDate, desiderataMap, showAssignmentsOnly);
  },
  allToCsv: async (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => {
    await exporters.allToCsv(users, planningsMap, startDate);
  }
}));

// États memoizés pour éviter les re-renders
const DEFAULT_START_DATE = new Date(createParisDate().setMonth(createParisDate().getMonth() - 4));
const DEFAULT_END_DATE = createParisDate();

/**
 * Page d'administration du planning généré - Version Optimisée
 */
const GeneratedPlanningPage: React.FC = () => {
  const { currentAssociation } = useAssociation();
  const { users, loading: isLoadingUsers } = useUsers();
  const { allPeriods, isLoading: isLoadingPeriods, refreshPeriods, getActivePeriod, getFuturePeriod } = usePlanningPeriod();
  const activePeriod = getActivePeriod();
  const activePeriodId = activePeriod?.id || '';
  const { config } = usePlanningConfig();
  const { config: bagPhaseConfig } = useBagPhase();
  
  // États principaux
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [planningToDelete, setPlanningToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [uploadPeriodId, setUploadPeriodId] = useState<string>(activePeriodId);
  const [activeTab, setActiveTab] = useState<'plannings' | 'history' | 'import' | 'global' | 'statistics'>('plannings');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // États pour les dates avec valeurs par défaut memoizées
  const [startDate, setStartDate] = useState<Date>(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState<Date>(DEFAULT_END_DATE);
  const [datesAdjusted, setDatesAdjusted] = useState<boolean>(false);
  
  // États pour l'affichage
  const [showDesiderata, setShowDesiderata] = useState<boolean>(true);
  const [desiderata, setDesiderata] = useState<Record<string, { type: 'primary' | 'secondary' | null }>>({});

  // Filtrer et trier les utilisateurs par ordre alphabétique
  const sortedUsers = useMemo(() => {
    return [...users]
      .filter(user => {
        // Un utilisateur doit avoir au moins un rôle non-administratif pour apparaître
        if (!user.roles) return true; // Si pas de rôles définis, on inclut l'utilisateur
        
        const hasAdminRole = user.roles.isAdmin || user.roles.isSuperAdmin;
        const hasOtherRole = user.roles.isUser || 
                            user.roles.isManager || 
                            user.roles.isPartTime || 
                            user.roles.isCAT || 
                            user.roles.isReplacement;
        
        // Exclure seulement si l'utilisateur est admin ET n'a aucun autre rôle
        if (hasAdminRole && !hasOtherRole) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const nameA = `${a.lastName} ${a.firstName}`;
        const nameB = `${b.lastName} ${b.firstName}`;
        return nameA.localeCompare(nameB);
      });
  }, [users]);

  // Utiliser le hook optimisé pour charger les plannings
  const { 
    plannings: generatedPlannings, 
    isLoading: isLoadingPlannings, 
    error: planningsError,
    refreshPlannings,
    metadata
  } = useOptimizedPlannings({
    users,
    includeArchived: true,
    associationId: currentAssociation
  });

  // Utiliser le hook pour obtenir les assignments de l'utilisateur sélectionné
  const currentAssignments = useUserAssignments(selectedUserId, generatedPlannings);

  // Sélectionner le premier utilisateur quand les utilisateurs sont chargés
  useEffect(() => {
    if (sortedUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(sortedUsers[0].id);
    }
  }, [sortedUsers, selectedUserId]);

  // Callback pour afficher un toast (memoizé)
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Callback pour supprimer un planning (memoizé)
  const handleDeletePlanning = useCallback(async () => {
    if (!planningToDelete || !uploadPeriodId) {
      return;
    }

    try {
      await deletePlanning(planningToDelete);
      
      // Rafraîchir les plannings
      await refreshPlannings();
      
      showToast('Planning supprimé avec succès', 'success');
    } catch (error) {
      logger.error('Error deleting planning:', error);
      showToast('Erreur lors de la suppression du planning', 'error');
    } finally {
      setPlanningToDelete(null);
      setShowDeleteConfirmation(false);
    }
  }, [planningToDelete, uploadPeriodId, refreshPlannings, showToast]);

  // Navigation entre les utilisateurs (memoizée)
  const handlePreviousUser = useCallback(() => {
    const userIndex = sortedUsers.findIndex(user => user.id === selectedUserId);
    if (userIndex > 0) {
      setSelectedUserId(sortedUsers[userIndex - 1].id);
    }
  }, [sortedUsers, selectedUserId]);

  const handleNextUser = useCallback(() => {
    const userIndex = sortedUsers.findIndex(user => user.id === selectedUserId);
    if (userIndex < sortedUsers.length - 1) {
      setSelectedUserId(sortedUsers[userIndex + 1].id);
    }
  }, [sortedUsers, selectedUserId]);

  // Définir les dates par défaut basées sur la BàG ou les plannings existants
  useEffect(() => {
    // Si les dates ont déjà été ajustées, ne pas les recalculer
    if (datesAdjusted) return;
    
    // 1. Priorité à la période future (BàG) si elle existe
    const futurePeriod = getFuturePeriod();
    if (futurePeriod && futurePeriod.startDate && futurePeriod.endDate) {
      setStartDate(new Date(futurePeriod.startDate));
      setEndDate(new Date(futurePeriod.endDate));
      setDatesAdjusted(true);
      return;
    }
    
    // 2. Sinon, utiliser la période active si elle existe
    if (activePeriod && activePeriod.startDate && activePeriod.endDate) {
      setStartDate(new Date(activePeriod.startDate));
      setEndDate(new Date(activePeriod.endDate));
      setDatesAdjusted(true);
      return;
    }
    
    // 3. Sinon, laisser le useEffect suivant gérer les dates depuis les plannings
  }, [activePeriod, getFuturePeriod, datesAdjusted]);

  // Ajuster les dates basées sur les plannings chargés (fallback)
  useEffect(() => {
    if (datesAdjusted || isLoadingPlannings || Object.keys(generatedPlannings).length === 0) {
      return;
    }
    
    // Collecter toutes les dates de postes
    const allDates: Date[] = [];
    
    Object.values(generatedPlannings).forEach(periodPlannings => {
      Object.values(periodPlannings).forEach(planning => {
        if (planning && planning.assignments) {
          Object.values(planning.assignments).forEach(assignment => {
            if (assignment && assignment.date && typeof assignment.date === 'string') {
              allDates.push(new Date(assignment.date));
            }
          });
        }
      });
    });
    
    if (allDates.length === 0) {
      setDatesAdjusted(true);
      return;
    }
    
    // Trier et ajuster les dates
    allDates.sort((a, b) => b.getTime() - a.getTime());
    const latestDate = allDates[0];
    const fourMonthsBeforeLatest = new Date(latestDate);
    fourMonthsBeforeLatest.setMonth(latestDate.getMonth() - 4);
    
    const startYear = fourMonthsBeforeLatest.getFullYear();
    const startMonth = fourMonthsBeforeLatest.getMonth();
    const newStartDate = new Date(startYear, startMonth, 1);
    
    const endYear = latestDate.getFullYear();
    const endMonth = latestDate.getMonth();
    const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
    const newEndDate = new Date(endYear, endMonth, lastDay);
    
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setDatesAdjusted(true);
  }, [generatedPlannings, datesAdjusted, isLoadingPlannings]);

  // Charger les desiderata pour l'utilisateur sélectionné
  useEffect(() => {
    if (!selectedUserId) return;
    
    const fetchDesiderata = async () => {
      try {
        const userDesiderata = await getAllDesiderata(selectedUserId, true, false, currentAssociation);
        if (userDesiderata && userDesiderata.selections) {
          const formattedDesiderata: Record<string, { type: 'primary' | 'secondary' | null }> = {};
          
          Object.entries(userDesiderata.selections).forEach(([key, value]) => {
            if (value && typeof value === 'object' && 'type' in value) {
              const typedValue = value as { type: 'primary' | 'secondary' | null };
              formattedDesiderata[key] = { type: typedValue.type };
            }
          });
          
          setDesiderata(formattedDesiderata);
        } else {
          setDesiderata({});
        }
      } catch (error) {
        logger.error('Error fetching desiderata:', error);
        setDesiderata({});
      }
    };
    
    fetchDesiderata();
  }, [selectedUserId, currentAssociation]);

  // Callback pour archiver les plannings anciens (memoizé)
  const handleArchiveOldPlannings = useCallback(async () => {
    try {
      const { archiveOldPlannings } = await import('../../../lib/firebase/planning');
      const archivedCount = await archiveOldPlannings();
      
      await refreshPlannings();
      setDatesAdjusted(false);
      
      showToast(`${archivedCount} plannings archivés avec succès`, 'success');
    } catch (error) {
      logger.error('Error archiving old plannings:', error);
      showToast('Erreur lors de l\'archivage des plannings', 'error');
    }
  }, [refreshPlannings, showToast]);

  // Rendu du contenu de l'onglet actif (memoizé)
  const renderActiveTab = useMemo(() => {
    if (isLoadingPeriods && allPeriods.length === 0) {
      return (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <p className="text-gray-700 mb-4">Chargement des périodes de planning...</p>
          <div className="flex justify-center">
            <LoadingSpinner />
          </div>
        </div>
      );
    }
    
    if (activeTab === 'import') {
      return (
        <ImportedPlanningsManager
          users={sortedUsers}
          uploadPeriodId={uploadPeriodId}
          allPeriods={allPeriods}
          setUploadPeriodId={setUploadPeriodId}
          uploadedPlannings={generatedPlannings}
          setUploadedPlannings={async () => {
            await refreshPlannings();
            setDatesAdjusted(false);
          }}
          onSuccess={async (message) => {
            showToast(message, 'success');
            if (message.includes('période') && refreshPeriods) {
              await refreshPeriods();
            }
          }}
          onError={(message) => showToast(message, 'error')}
          refreshPeriods={refreshPeriods}
          onPlanningImported={(userId, planning, periodId) => {
            if (periodId !== uploadPeriodId) {
              setUploadPeriodId(periodId);
            }
          }}
        />
      );
    }
    
    if (!isLoadingPeriods && allPeriods.length === 0 && activeTab !== 'import') {
      return <div></div>;
    }
    
    switch (activeTab) {
      case 'history':
        return (
          <HistoryExport
            users={sortedUsers}
            onSuccess={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
          />
        );
      
      case 'global':
        return (
          <GlobalPlanningView
            users={sortedUsers}
            plannings={generatedPlannings}
            startDate={startDate}
            endDate={endDate}
            associationId={currentAssociation || 'RD'}
            onDateChange={(newStartDate, newEndDate) => {
              setStartDate(newStartDate);
              setEndDate(newEndDate);
            }}
          />
        );
      
      case 'statistics':
        return (
          <ShiftTypeStatisticsTable
            users={sortedUsers}
            plannings={generatedPlannings}
            startDate={startDate}
            endDate={endDate}
            associationId={currentAssociation || 'RD'}
          />
        );
      
      case 'plannings':
      default:
        if (allPeriods.length === 0) {
          return <div></div>;
        }
        
        return (
          <PlanningViewProvider 
            initialView="quadrimester"
            initialDateRange={{ startDate, endDate }}
            onViewChange={() => {}}
          >
            <AdminPlanningContainer
              users={sortedUsers}
              selectedUserId={selectedUserId}
              onUserChange={setSelectedUserId}
              onPreviousUser={handlePreviousUser}
              onNextUser={handleNextUser}
              assignments={currentAssignments}
              exchanges={{}}
              directExchanges={{}}
              replacements={{}}
              desiderata={desiderata}
              receivedShifts={{}}
              showDesiderata={showDesiderata}
              onToggleDesiderata={() => setShowDesiderata(!showDesiderata)}
              bagPhaseConfig={{ phase: 'completed' }}
              onCellClick={(event, cellKey, assignment) => {
                event.preventDefault();
              }}
              uploadPeriodId={uploadPeriodId}
              plannings={generatedPlannings}
              saveGeneratedPlanning={saveGeneratedPlanning}
              loadExporters={loadGeneratedPlanningExporters}
              startDate={startDate}
              endDate={endDate}
              showImportZone={false}
            />
          </PlanningViewProvider>
        );
    }
  }, [
    activeTab, allPeriods, isLoadingPeriods, sortedUsers, uploadPeriodId, generatedPlannings,
    selectedUserId, currentAssignments, desiderata, showDesiderata, startDate, endDate,
    handlePreviousUser, handleNextUser, showToast, refreshPlannings, refreshPeriods,
    setUploadPeriodId, currentAssociation
  ]);

  // Afficher les statistiques si disponibles
  const statsInfo = metadata && (
    <div className="text-xs text-gray-500">
      {metadata.totalUsers} utilisateurs • {metadata.activePeriods.length} périodes actives
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des plannings</h1>
        {statsInfo}
      </div>
      
      {/* Onglets de navigation */}
      <div className="flex flex-wrap justify-between mb-6">
        <div className="flex flex-wrap space-x-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('plannings')}
            className={`py-2 px-4 ${activeTab === 'plannings' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Plannings
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`py-2 px-4 ${activeTab === 'global' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Vue globale
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`py-2 px-4 ${activeTab === 'statistics' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Répartition
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-2 px-4 ${activeTab === 'import' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-4 ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Historique
          </button>
        </div>
        
        {activeTab === 'plannings' && (
          <div className="flex space-x-2">
            <button
              onClick={handleArchiveOldPlannings}
              className="px-3 py-1.5 text-xs rounded-md transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
              title="Archiver les plannings plus anciens que 3 mois"
              disabled={isLoadingPlannings}
            >
              Archiver les plannings anciens
            </button>
          </div>
        )}
      </div>
      
      {/* Message d'erreur */}
      {planningsError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {planningsError}
        </div>
      )}
      
      {/* Message toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Contenu principal */}
      {(activeTab !== 'import' && (isLoadingUsers || isLoadingPeriods || isLoadingPlannings)) ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><LoadingSpinner /></div>}>
          {renderActiveTab}
        </Suspense>
      )}
      
      {/* Modal de confirmation de suppression */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Supprimer le planning"
        message="Êtes-vous sûr de vouloir supprimer ce planning ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDeletePlanning}
        onCancel={() => {
          setShowDeleteConfirmation(false);
          setPlanningToDelete(null);
        }}
      />
    </div>
  );
};

export default GeneratedPlanningPage;