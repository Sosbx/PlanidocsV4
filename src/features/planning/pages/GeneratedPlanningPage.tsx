import React, { useState, useEffect, Suspense, lazy } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { usePlanningPeriod } from '../../../context/planning';
import { useUsers } from '../../auth/hooks';
import { 
  saveGeneratedPlanning, 
  deletePlanning, 
  validateBagAndMergePeriods,
  exportUserPlanningHistoryToCsv,
  getAllPlanningsByPeriod
} from '../../../lib/firebase/planning';
import { getAllDesiderata } from '../../../lib/firebase/desiderata';
import { LoadingSpinner } from '../../../components/common';
import { ConfirmationModal } from '../../../components/modals';
import Toast from '../../../components/Toast';
import { loadGeneratedPlanningExporters as loadOriginalExporters } from '../../../utils/lazyExporters';
import { format } from 'date-fns';
import type { User } from '../../../types/users';

// Wrapper pour adapter les types retournés par loadGeneratedPlanningExporters
const loadGeneratedPlanningExporters = () => loadOriginalExporters().then(exporters => ({
  toPdf: async (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date) => {
    const doc = exporters.toPdf(assignments, userName, startDate, endDate);
    doc.save(`Planning_${userName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  },
  toCsv: async (assignments: Record<string, ShiftAssignment>, userName: string) => {
    exporters.toCsv(assignments, userName);
  },
  allToPdf: async (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date) => {
    await exporters.allToPdf(users, planningsMap, startDate, endDate);
  },
  allToCsv: async (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => {
    await exporters.allToCsv(users, planningsMap, startDate);
  }
}));
import type { ShiftAssignment, GeneratedPlanning, PlanningPeriod } from '../../../types/planning';
import { PlanningViewProvider } from '../context';
import { 
  AdminPlanningContainer,
  PeriodManagement,
  HistoryExport,
  ImportedPlanningsManager 
} from '../components/admin';

// Import dynamique du composant lourd
const GeneratedPlanningTable = lazy(() => import('../components/GeneratedPlanningTable'));

/**
 * Page d'administration du planning généré
 */
const GeneratedPlanningPage: React.FC = () => {
  // Hooks Firebase
  const { users, loading: isLoadingUsers } = useUsers();
  const { allPeriods, isLoading: isLoadingPeriods, refreshPeriods, getActivePeriod } = usePlanningPeriod();
  const activePeriod = getActivePeriod();
  const activePeriodId = activePeriod?.id || '';
  const { config } = usePlanningConfig();
  
  // États pour les gardes générées
  const [generatedPlannings, setGeneratedPlannings] = useState<Record<string, Record<string, GeneratedPlanning>>>({});
  const [isLoadingPlannings, setIsLoadingPlannings] = useState<boolean>(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [planningToDelete, setPlanningToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);

  // États pour l'import et l'export
  const [uploadPeriodId, setUploadPeriodId] = useState<string>(activePeriodId);
  const [uploadedPlannings, setUploadedPlannings] = useState<Record<string, Record<string, GeneratedPlanning>>>({});
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() + 3))
  );
  
  // État pour suivre si les dates ont été ajustées en fonction des postes
  const [datesAdjusted, setDatesAdjusted] = useState<boolean>(false);
  
  // États pour le chargement progressif
  const [isLoadingArchivedData, setIsLoadingArchivedData] = useState<boolean>(false);
  const [loadedArchiveQuarters, setLoadedArchiveQuarters] = useState<string[]>([]);
  const [viewStartDate, setViewStartDate] = useState<Date | null>(null);

  // États pour l'affichage
  const [showDesiderata, setShowDesiderata] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'plannings' | 'history' | 'import'>('plannings');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Chargement des plannings générés
  useEffect(() => {
    const loadGeneratedPlannings = async () => {
      console.log(`[PLANNING_PAGE] Début du chargement des plannings générés`);
      console.log(`[PLANNING_PAGE] Nombre d'utilisateurs: ${users.length}`);
      console.log(`[PLANNING_PAGE] Nombre de périodes: ${allPeriods.length}`);
      console.log(`[PLANNING_PAGE] État actuel: uploadPeriodId=${uploadPeriodId}, activePeriodId=${activePeriodId}`);
      
      setIsLoadingPlannings(true);
      try {
        const planningsMap: Record<string, Record<string, GeneratedPlanning>> = {};
        
        // Récupérer tous les plannings pour tous les utilisateurs et toutes les périodes
        for (const user of users) {
          const userId = user.id;
          
          console.log(`[PLANNING_PAGE] Chargement des plannings pour l'utilisateur: ${user.lastName} ${user.firstName} (ID: ${userId})`);
          
          // Récupérer tous les plannings de l'utilisateur par période, y compris les périodes archivées
          const userPlannings = await getAllPlanningsByPeriod(userId, {
            includeArchived: true // Inclure explicitement les périodes archivées
          });
          console.log(`[PLANNING_PAGE] Nombre de périodes trouvées pour ${user.lastName}: ${Object.keys(userPlannings).length}`);
          
          // Ajouter les plannings à la map
          Object.entries(userPlannings).forEach(([periodId, planning]: [string, GeneratedPlanning]) => {
            // Créer l'objet pour la période si nécessaire
            if (!planningsMap[periodId]) {
              planningsMap[periodId] = {};
            }
            
            // Convertir les timestamps en dates pour les assignments
            if (planning && planning.assignments) {
              const assignments = planning.assignments;
              Object.keys(assignments).forEach((key) => {
                const assignment = assignments[key];
                if (assignment && assignment.date) {
                  if (typeof assignment.date === 'string') {
                    // Conserver le format de date en chaîne
                  } else if (typeof assignment.date === 'object' && 'seconds' in assignment.date) {
                    // Convertir le timestamp Firestore en chaîne de date
                    const timestamp = assignment.date as unknown as { seconds: number };
                    assignments[key].date = new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
                  }
                }
              });
            }
            
            // Ajouter le planning à la map
            planningsMap[periodId][userId] = planning;
          });
        }
        
        setGeneratedPlannings(planningsMap);
        
        // Initialiser également uploadedPlannings avec les plannings existants
        setUploadedPlannings(planningsMap);
        
        // Sélectionner le premier utilisateur s'il n'y en a pas de sélectionné
        if (users.length > 0 && !selectedUserId) {
          setSelectedUserId(users[0].id);
        }
        
        // Forcer l'ajustement des dates
        setDatesAdjusted(false);
      } catch (error) {
        console.error('Error loading generated plannings:', error);
        showToast('Erreur lors du chargement des plannings', 'error');
      } finally {
        setIsLoadingPlannings(false);
      }
    };

    if (allPeriods.length > 0 && users.length > 0) {
      console.log(`[PLANNING_PAGE] Conditions remplies pour charger les plannings: ${allPeriods.length} périodes, ${users.length} utilisateurs`);
      loadGeneratedPlannings();
    } else {
      console.log(`[PLANNING_PAGE] Impossible de charger les plannings: ${allPeriods.length} périodes, ${users.length} utilisateurs`);
      if (allPeriods.length === 0) {
        console.log(`[PLANNING_PAGE] ⚠️ ATTENTION: Aucune période trouvée. La collection planning_periods existe-t-elle?`);
      }
    }
  }, [allPeriods, users, selectedUserId, uploadPeriodId]);

  // Sélectionner le premier utilisateur quand les utilisateurs sont chargés
  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  // Supprimer un planning généré
  const handleDeletePlanning = async () => {
    if (!planningToDelete || !uploadPeriodId) {
      return;
    }

    try {
      // Supprimer le planning (la fonction n'accepte qu'un seul argument)
      await deletePlanning(planningToDelete);
      
      // Mettre à jour l'état local
      setGeneratedPlannings((prev) => {
        const updatedPlannings = { ...prev };
        if (updatedPlannings[uploadPeriodId]) {
          delete updatedPlannings[uploadPeriodId][planningToDelete];
        }
        return updatedPlannings;
      });
      
      showToast('Planning supprimé avec succès', 'success');
    } catch (error) {
      console.error('Error deleting planning:', error);
      showToast('Erreur lors de la suppression du planning', 'error');
    } finally {
      setPlanningToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Navigation entre les utilisateurs
  const handlePreviousUser = () => {
    const userIndex = users.findIndex(user => user.id === selectedUserId);
    if (userIndex > 0) {
      setSelectedUserId(users[userIndex - 1].id);
    }
  };

  const handleNextUser = () => {
    const userIndex = users.findIndex(user => user.id === selectedUserId);
    if (userIndex < users.length - 1) {
      setSelectedUserId(users[userIndex + 1].id);
    }
  };

  // Afficher un message toast
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Sélectionner les assignments du planning actuel (combinés de toutes les périodes)
  const currentAssignments = React.useMemo(() => {
    if (!selectedUserId || !generatedPlannings || Object.keys(generatedPlannings).length === 0) {
      return {};
    }
    
    // Combiner les assignments de toutes les périodes pour l'utilisateur sélectionné
    const combinedAssignments: Record<string, ShiftAssignment> = {};
    
    Object.values(generatedPlannings).forEach(periodPlannings => {
      if (periodPlannings[selectedUserId]) {
        const assignments = periodPlannings[selectedUserId].assignments;
        if (assignments) {
          Object.entries(assignments).forEach(([key, assignment]) => {
            combinedAssignments[key] = assignment;
          });
        }
      }
    });
    
    return combinedAssignments;
  }, [selectedUserId, generatedPlannings]);

  // Comparer avec les désiderata
  const [desiderata, setDesiderata] = useState<Record<string, { type: 'primary' | 'secondary' | null }>>({});
  
    // Ajuster les dates pour afficher les 4 mois précédant la dernière garde, plus le mois de la dernière garde
    useEffect(() => {
      // Ne pas ajuster les dates si elles ont déjà été ajustées ou si les plannings ne sont pas encore chargés
      if (datesAdjusted || isLoadingPlannings || Object.keys(generatedPlannings).length === 0) {
        return;
      }
      
      console.log("Ajustement des dates en cours...");
      console.log("Nombre de périodes:", Object.keys(generatedPlannings).length);
      
      // Collecter toutes les dates de postes
      const allDates: Date[] = [];
      
      // Parcourir tous les plannings pour toutes les périodes et tous les utilisateurs
      Object.values(generatedPlannings).forEach(periodPlannings => {
        Object.values(periodPlannings).forEach(planning => {
          // Vérifier que planning et planning.assignments ne sont pas undefined
          if (planning && planning.assignments) {
            Object.values(planning.assignments).forEach(assignment => {
              if (assignment && assignment.date && typeof assignment.date === 'string') {
                allDates.push(new Date(assignment.date));
              }
            });
          }
        });
      });
      
      // Si aucune date n'est trouvée, ne pas ajuster les dates
      if (allDates.length === 0) {
        setDatesAdjusted(true);
        return;
      }
      
      // Trier les dates par ordre chronologique (décroissant pour trouver la plus récente)
      allDates.sort((a, b) => b.getTime() - a.getTime());
      
      // Trouver la date la plus récente avec une garde
      const latestDate = allDates[0];
      
      // Calculer la date exactement 4 mois avant la date la plus récente
      const fourMonthsBeforeLatest = new Date(latestDate);
      fourMonthsBeforeLatest.setMonth(latestDate.getMonth() - 4);
      
      // Déterminer le premier jour du mois de la date calculée (4 mois avant)
      // Pour garantir l'affichage du mois complet, même si la garde est en milieu de mois
      const startYear = fourMonthsBeforeLatest.getFullYear();
      const startMonth = fourMonthsBeforeLatest.getMonth(); // 0-11
      const newStartDate = new Date(startYear, startMonth, 1);
      
      // Déterminer le dernier jour du mois de la date la plus récente
      // Pour garantir l'affichage du mois complet de la dernière garde
      const endYear = latestDate.getFullYear();
      const endMonth = latestDate.getMonth(); // 0-11
      const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
      const newEndDate = new Date(endYear, endMonth, lastDay);
      
      console.log(`Date la plus récente: ${latestDate.toISOString().split('T')[0]}`);
      console.log(`4 mois avant (jour exact): ${fourMonthsBeforeLatest.toISOString().split('T')[0]}`);
      console.log(`Premier jour du mois (4 mois avant): ${newStartDate.toISOString().split('T')[0]}`);
      console.log(`Dernier jour du mois (date la plus récente): ${newEndDate.toISOString().split('T')[0]}`);
      console.log(`Période affichée: ${newStartDate.toISOString().split('T')[0]} - ${newEndDate.toISOString().split('T')[0]}`);
      
      // Mettre à jour les dates
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      
      // Marquer les dates comme ajustées
      setDatesAdjusted(true);
      
      // La vue quadrimester est définie par défaut dans PlanningViewProvider
    }, [generatedPlannings, datesAdjusted, isLoadingPlannings]);
  
  useEffect(() => {
    if (!selectedUserId) return;
    
    const fetchDesiderata = async () => {
      try {
        // Spécifier explicitement que nous voulons inclure les desiderata archivés
        const userDesiderata = await getAllDesiderata(selectedUserId, true);
        if (userDesiderata && userDesiderata.selections) {
          // Transformer les données pour correspondre au format attendu
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
        console.error('Error fetching desiderata:', error);
        setDesiderata({});
      }
    };
    
    fetchDesiderata();
  }, [selectedUserId]);

  // Fonction pour charger les données archivées
  const loadArchivedData = async (startDate: Date) => {
    if (isLoadingArchivedData || !selectedUserId) return;
    
    setIsLoadingArchivedData(true);
    
    try {
      // Calculer les trimestres à charger
      const today = new Date();
      const defaultStartDate = new Date(today);
      defaultStartDate.setMonth(today.getMonth() - 3);
      
      // Déterminer le trimestre de la date de début
      const startYear = startDate.getFullYear();
      const startQuarter = Math.floor(startDate.getMonth() / 3) + 1;
      const quarterKey = `${startYear}Q${startQuarter}`;
      
      // Vérifier si ce trimestre a déjà été chargé
      if (loadedArchiveQuarters.includes(quarterKey)) {
        console.log(`Le trimestre ${quarterKey} a déjà été chargé`);
        setIsLoadingArchivedData(false);
        return;
      }
      
      console.log(`Chargement des données archivées pour le trimestre ${quarterKey}...`);
      
      // Charger les plannings archivés pour l'utilisateur sélectionné
      const archivedPlannings = await getAllPlanningsByPeriod(selectedUserId, {
        startDate,
        endDate: defaultStartDate,
        includeArchived: true
      });
      
      // Mettre à jour les plannings générés
      setGeneratedPlannings(prev => {
        const updated = { ...prev };
        
        // Fusionner les plannings archivés
        Object.entries(archivedPlannings).forEach(([periodId, planning]) => {
          if (!updated[periodId]) {
            updated[periodId] = { [selectedUserId]: planning };
          } else if (!updated[periodId][selectedUserId]) {
            updated[periodId][selectedUserId] = planning;
          } else {
            // Fusionner les assignments
            const existingAssignments = updated[periodId][selectedUserId].assignments || {};
            const newAssignments = planning.assignments || {};
            
            updated[periodId][selectedUserId] = {
              ...updated[periodId][selectedUserId],
              assignments: { ...existingAssignments, ...newAssignments }
            };
          }
        });
        
        return updated;
      });
      
      // Marquer ce trimestre comme chargé
      setLoadedArchiveQuarters(prev => [...prev, quarterKey]);
      
      showToast(`Données archivées du trimestre ${quarterKey} chargées avec succès`, 'success');
    } catch (error) {
      console.error('Error loading archived data:', error);
      showToast('Erreur lors du chargement des données archivées', 'error');
    } finally {
      setIsLoadingArchivedData(false);
    }
  };
  
  // Détecter quand l'utilisateur navigue vers des périodes plus anciennes
  useEffect(() => {
    if (!viewStartDate) return;
    
    // Calculer la date limite (3 mois avant aujourd'hui)
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setMonth(today.getMonth() - 3);
    
    // Si la date de début de la vue est antérieure à 3 mois, charger les données archivées
    if (viewStartDate < defaultStartDate) {
      loadArchivedData(viewStartDate);
    }
  }, [viewStartDate, selectedUserId]);
  
  // Fonction pour archiver les plannings anciens
  const handleArchiveOldPlannings = async () => {
    try {
      setIsLoadingPlannings(true);
      
      // Importer la fonction d'archivage
      const { archiveOldPlannings } = await import('../../../lib/firebase/planning');
      
      // Archiver les plannings
      const archivedCount = await archiveOldPlannings();
      
      // Recharger les plannings
      setDatesAdjusted(false);
      
      showToast(`${archivedCount} plannings archivés avec succès`, 'success');
    } catch (error) {
      console.error('Error archiving old plannings:', error);
      showToast('Erreur lors de l\'archivage des plannings', 'error');
    } finally {
      setIsLoadingPlannings(false);
    }
  };
  
  // Rendu conditionnel selon l'onglet actif
  const renderActiveTab = () => {
    // Si les périodes sont en chargement mais qu'aucune n'est encore disponible, afficher un message
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
    
    // Si on est sur l'onglet "import", toujours afficher l'interface d'importation quelle que soit la présence de périodes
    if (activeTab === 'import') {
      return (
        <ImportedPlanningsManager
          users={users}
          uploadPeriodId={uploadPeriodId}
          allPeriods={allPeriods}
          setUploadPeriodId={(id) => {
            console.log(`[PLANNING_PAGE] Mise à jour de uploadPeriodId: ${uploadPeriodId} -> ${id}`);
            setUploadPeriodId(id);
          }}
          uploadedPlannings={uploadedPlannings}
          setUploadedPlannings={(plannings) => {
            console.log(`[PLANNING_PAGE] Mise à jour des plannings importés`);
            setUploadedPlannings(plannings);
            setDatesAdjusted(false);
          }}
          onSuccess={(message) => {
            console.log(`[PLANNING_PAGE] Succès: ${message}`);
            showToast(message, 'success');
            if (message.includes('période') && refreshPeriods) {
              console.log(`[PLANNING_PAGE] Rechargement des périodes après création/importation`);
              refreshPeriods().catch(error => {
                console.error('[PLANNING_PAGE] Erreur lors du rechargement des périodes:', error);
              });
            }
          }}
          onError={(message) => {
            console.error(`[PLANNING_PAGE] Erreur: ${message}`);
            showToast(message, 'error');
          }}
          refreshPeriods={async () => {
            console.log(`[PLANNING_PAGE] Rechargement des périodes (via ImportPlannings)`);
            if (refreshPeriods) {
              await refreshPeriods();
              console.log(`[PLANNING_PAGE] Périodes rechargées: ${allPeriods.length} périodes`);
            }
          }}
          onPlanningImported={(userId, planning, periodId) => {
            console.log(`[PLANNING_PAGE] Planning importé pour l'utilisateur ${userId} dans la période ${periodId}`);
            if (periodId !== uploadPeriodId) {
              console.log(`[PLANNING_PAGE] Mise à jour de uploadPeriodId après importation: ${uploadPeriodId} -> ${periodId}`);
              setUploadPeriodId(periodId);
            }
          }}
        />
      );
    }
    
    // Si le chargement est terminé mais qu'aucune période n'est disponible pour les autres onglets
    if (!isLoadingPeriods && allPeriods.length === 0) {
      // Retourner un élément vide si aucune période n'est disponible
      return <div></div>;
    }
    
    // Pour les autres onglets avec des périodes disponibles
    switch (activeTab) {
      case 'history':
        return (
          <HistoryExport
            users={users}
            onSuccess={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
          />
        );
      
      // L'onglet "import" est déjà géré en dehors du switch
      
      case 'plannings':
      default:
        // Si aucune période n'est disponible, ne rien afficher dans l'onglet plannings
        if (allPeriods.length === 0) {
          return <div></div>;
        }
        
        return (
          <PlanningViewProvider 
            initialView="quadrimester"
            initialDateRange={{ startDate, endDate }}
            onViewChange={(newStartDate: Date) => {
              // Mettre à jour la date de début de la vue
              setViewStartDate(newStartDate);
            }}
          >
            <AdminPlanningContainer
              users={users}
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
                // Logique de gestion des clics sur les cellules
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
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Administration des plannings générés</h1>
      
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
              onClick={() => setDatesAdjusted(false)}
              className="px-3 py-1.5 text-xs rounded-md transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="Recalculer la période affichée en fonction des plannings importés"
            >
              Actualiser la période
            </button>
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
      
      {/* Indicateur de chargement des données archivées */}
      {isLoadingArchivedData && (
        <div className="mb-4 p-2 bg-blue-50 text-blue-700 rounded-md flex items-center">
          <div className="w-4 h-4 mr-2">
            <LoadingSpinner />
          </div>
          <span>Chargement des données archivées en cours...</span>
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
      
      {/* Contenu principal basé sur l'onglet actif */}
      {(activeTab !== 'import' && (isLoadingUsers || isLoadingPeriods || isLoadingPlannings)) ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><LoadingSpinner /></div>}>
          {renderActiveTab()}
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

// Les composants pour les différents onglets ont été extraits vers des fichiers séparés
// dans le répertoire src/features/planning/components/admin

export default GeneratedPlanningPage;
