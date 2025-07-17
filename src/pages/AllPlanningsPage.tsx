import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanningPeriod } from '../context/planning';
import { useUsers } from '../features/auth/hooks/useUsers';
import { useAssociation } from '../context/association/AssociationContext';
import { useOptimizedPlannings, useUserAssignments } from '../features/planning/hooks/useOptimizedPlannings';
import { LoadingSpinner } from '../components/common';
import Toast from '../components/common/Toast';
import { AdminPlanningContainer, GlobalPlanningView, ShiftTypeStatisticsTable } from '../features/planning/components/admin';
import { PlanningViewProvider } from '../features/planning/context';
import type { User } from '../types/users';
import { createParisDate, subMonthsParis, toParisTime } from '../utils/timezoneUtils';

// États memoizés pour éviter les re-renders
const DEFAULT_START_DATE = subMonthsParis(createParisDate(), 4);
const DEFAULT_END_DATE = createParisDate();

/**
 * Page pour consulter tous les plannings (accessible à tous les utilisateurs)
 */
const AllPlanningsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentAssociation } = useAssociation();
  const { users, loading: isLoadingUsers } = useUsers();
  const { allPeriods, isLoading: isLoadingPeriods, getActivePeriod, getFuturePeriod } = usePlanningPeriod();
  const activePeriod = getActivePeriod();
  
  // États principaux
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'individual' | 'global' | 'statistics'>('individual');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // États pour les dates avec valeurs par défaut memoizées
  const [startDate, setStartDate] = useState<Date>(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState<Date>(DEFAULT_END_DATE);
  const [datesAdjusted, setDatesAdjusted] = useState<boolean>(false);

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
    error: planningsError
  } = useOptimizedPlannings({
    users,
    includeArchived: false,
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
      setStartDate(toParisTime(futurePeriod.startDate));
      setEndDate(toParisTime(futurePeriod.endDate));
      setDatesAdjusted(true);
      return;
    }
    
    // 2. Sinon, utiliser la période active si elle existe
    if (activePeriod && activePeriod.startDate && activePeriod.endDate) {
      setStartDate(toParisTime(activePeriod.startDate));
      setEndDate(toParisTime(activePeriod.endDate));
      setDatesAdjusted(true);
      return;
    }
  }, [activePeriod, getFuturePeriod, datesAdjusted]);

  // Rendu du contenu de l'onglet actif (memoizé)
  const renderActiveTab = useMemo(() => {
    switch (activeTab) {
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
      
      case 'individual':
      default:
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
              desiderata={{}} // Pas de désiderata
              receivedShifts={{}}
              showDesiderata={false} // Forcer à false
              onToggleDesiderata={() => {}} // Fonction vide
              bagPhaseConfig={{ phase: 'completed' }}
              onCellClick={(event, cellKey, assignment) => {
                event.preventDefault(); // Empêcher toute interaction
              }}
              uploadPeriodId=""
              plannings={generatedPlannings}
              startDate={startDate}
              endDate={endDate}
              showImportZone={false} // Pas d'import
            />
          </PlanningViewProvider>
        );
    }
  }, [
    activeTab, sortedUsers, generatedPlannings, selectedUserId, 
    currentAssignments, startDate, endDate, handlePreviousUser, 
    handleNextUser, currentAssociation
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header avec bouton retour */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Retour au tableau de bord</span>
          </button>
        </div>

        {/* Titre de la page */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tous les plannings</h1>
        </div>
        
        {/* Onglets de navigation */}
        <div className="flex flex-wrap justify-between mb-6">
          <div className="flex flex-wrap space-x-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('individual')}
              className={`py-2 px-4 ${activeTab === 'individual' ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Plannings individuels
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
          </div>
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
        {(isLoadingUsers || isLoadingPeriods || isLoadingPlannings) ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : (
          <Suspense fallback={<div className="flex justify-center items-center h-64"><LoadingSpinner /></div>}>
            {renderActiveTab}
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default AllPlanningsPage;