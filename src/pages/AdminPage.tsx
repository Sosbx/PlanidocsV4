import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Percent, Save, RotateCcw, Users, CheckSquare, Settings, ChevronDown, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePlanningConfig, ArchivedPeriod } from '../context/planning/PlanningContext';
import ConfigurationDisplay from '../components/ConfigurationDisplay';
import ConfirmationModal from '../components/ConfirmationModal';
import UserStatusList from '../features/users/components/UserStatusList';
import { useUsers } from '../features/auth/hooks';
import { UserExtended, User } from '../features/users/types';
import { UserRole, UserStatus } from '../features/auth/types';
import { ShiftAssignment } from '../types/planning';
import { loadPdfExporter } from '../utils/lazyExporters';
import { getDesiderata, getAllDesiderata } from '../lib/firebase/desiderata';
import Toast from '../components/Toast';
import PlanningPreview from '../features/planning/components/PlanningPreview';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ArchivedPeriodDetails from '../features/planning/components/ArchivedPeriodDetails';

type TabType = 'configuration' | 'validated-plannings' | 'users' | 'archived-periods';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config, updateConfig, resetConfig, archivePlanningPeriod, archivedPeriods, loadArchivedPeriods } = usePlanningConfig();
  const { users } = useUsers();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    deadline: '',
    primaryDesiderataLimit: config.primaryDesiderataLimit || 0,
    secondaryDesiderataLimit: config.secondaryDesiderataLimit || 0,
  });
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showArchiveConfirmation, setShowArchiveConfirmation] = useState(false);
  const [newPeriodData, setNewPeriodData] = useState({
    startDate: '',
    endDate: '',
    deadline: '',
  });
  
  // État pour gérer les onglets
  const [activeTab, setActiveTab] = useState<TabType>('configuration');
  
  // États pour la partie plannings validés
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [planningData, setPlanningData] = useState<{
    selections: Record<string, { type: 'primary' | 'secondary' | null; comment?: string }>;
    validatedAt: string;
  } | null>(null);
  const [loadingPlanning, setLoadingPlanning] = useState(false);
  
  // États pour la partie périodes archivées
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Déterminer l'onglet actif à partir de l'URL lors du chargement initial
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (tab === 'validated-plannings' || tab === 'users' || tab === 'archived-periods') {
      setActiveTab(tab as TabType);
    }
  }, [location]);

  useEffect(() => {
    if (config.isConfigured) {
      const startDate = config.startDate.toISOString().split('T')[0];
      const endDate = config.endDate.toISOString().split('T')[0];
      const deadline = new Date(config.deadline).toISOString().slice(0, 16);
      
      setFormData({
        startDate,
        endDate,
        deadline,
        primaryDesiderataLimit: config.primaryDesiderataLimit,
        secondaryDesiderataLimit: config.secondaryDesiderataLimit,
      });
      
      // Initialiser les données pour la nouvelle période avec des valeurs par défaut
      // Par exemple, commencer la nouvelle période le lendemain de la fin de la période actuelle
      const nextStartDate = new Date(config.endDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      
      const nextEndDate = new Date(nextStartDate);
      nextEndDate.setMonth(nextEndDate.getMonth() + 4); // Par défaut, période de 4 mois
      
      const nextDeadline = new Date(nextStartDate);
      nextDeadline.setDate(nextStartDate.getDate() - 14); // Par défaut, deadline 2 semaines avant le début
      
      setNewPeriodData({
        startDate: nextStartDate.toISOString().split('T')[0],
        endDate: nextEndDate.toISOString().split('T')[0],
        deadline: nextDeadline.toISOString().slice(0, 16),
      });
    }
  }, [config]);

  // Filtrer uniquement les utilisateurs ayant validé leur planning
  const validatedUsers = users.filter(user => user.hasValidatedPlanning);
  const currentUser = validatedUsers.find(user => user.id === selectedUserId);

  // Fonction d'adaptation pour convertir ManagementUser en UserExtended
  const adaptManagementUserToUserExtended = (user: User): UserExtended => {
    return {
      id: user.id,
      email: user.email,
      displayName: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roles.isAdmin ? UserRole.ADMIN : user.roles.isManager ? UserRole.MANAGER : UserRole.USER,
      status: user.hasValidatedPlanning ? UserStatus.ACTIVE : UserStatus.PENDING,
      // Autres propriétés optionnelles
      metadata: {}
    };
  };

  // Filtrer et convertir les utilisateurs
  const usersList = users
    .filter(user => user.roles.isUser)
    .map(adaptManagementUserToUserExtended);
    
  // Sélectionner automatiquement le premier utilisateur au chargement pour l'onglet plannings validés
  useEffect(() => {
    if (validatedUsers.length > 0 && !selectedUserId && activeTab === 'validated-plannings') {
      setSelectedUserId(validatedUsers[0].id);
    }
  }, [validatedUsers, selectedUserId, activeTab]);

  // Charger les données du planning validé
  useEffect(() => {
    const loadPlanning = async () => {
      if (!currentUser || activeTab !== 'validated-plannings') {
        console.log('Pas de chargement des données planning: currentUser=', !!currentUser, 'activeTab=', activeTab);
        setPlanningData(null);
        setLoadingPlanning(false);
        return;
      }

      console.log('Début chargement du planning validé pour utilisateur:', currentUser.id);
      setLoadingPlanning(true);
      
      try {
        // Debug: d'abord voir toutes les données désidératas disponibles (comme dans l'oeil)
        const allDesiderata = await getAllDesiderata(currentUser.id, true);
        console.log('TOUTES les données désidératas (comme oeil):', currentUser.id, 'total:', Object.keys(allDesiderata.selections).length);
        console.log('validatedAt présent?', !!allDesiderata.validatedAt);
        
        // Utiliser getDesiderata directement pour obtenir les données validées
        const directDesiderata = await getDesiderata(currentUser.id);
        console.log('Données directement depuis getDesiderata:', currentUser.id, 'total:', directDesiderata ? Object.keys(directDesiderata.selections || {}).length : 0);
        console.log('validatedAt de getDesiderata:', directDesiderata?.validatedAt);
        
        // Stratégie: utiliser d'abord getDesiderata car il contient les données validées correctes
        if (directDesiderata?.validatedAt) {
          console.log('Utilisation des données directes car validatedAt trouvé dans getDesiderata');
          
          // Examiner le format des données
          if (Object.keys(directDesiderata.selections || {}).length > 0) {
            const firstKey = Object.keys(directDesiderata.selections)[0];
            console.log('Format des sélections avant transformation:', 
              firstKey, directDesiderata.selections[firstKey],
              'type:', typeof directDesiderata.selections[firstKey]
            );
          }
          
          // Transformer les sélections au format attendu par PlanningPreview
          const formattedSelections: Record<string, { type: 'primary' | 'secondary' | null; comment?: string }> = {};
          Object.entries(directDesiderata.selections || {}).forEach(([key, value]) => {
            // Si value est déjà un objet avec une propriété type, l'utiliser tel quel
            if (value && typeof value === 'object' && 'type' in value) {
              formattedSelections[key] = value;
            } 
            // Si value est directement 'primary' ou 'secondary', le transformer en objet
            else if (value === 'primary' || value === 'secondary' || value === null) {
              formattedSelections[key] = { type: value };
            }
          });
          
          console.log('Sélections transformées:', Object.keys(formattedSelections).length);
          if (Object.keys(formattedSelections).length > 0) {
            const firstKey = Object.keys(formattedSelections)[0];
            console.log('Exemple après transformation:', firstKey, formattedSelections[firstKey]);
          }
          
          setPlanningData({
            selections: formattedSelections,
            validatedAt: directDesiderata.validatedAt
          });
        } 
        // Fallback 1: utiliser getAllDesiderata avec includeArchived=true
        else if (allDesiderata?.validatedAt) {
          console.log('Utilisation des données getAllDesiderata avec includeArchived=true');
          setPlanningData({
            selections: allDesiderata.selections,
            validatedAt: allDesiderata.validatedAt
          });
        }
        // Fallback 2: essayer sans filtrage par période
        else {
          // Tester sans le paramètre currentPeriodOnly
          const dataWithoutFilter = await getAllDesiderata(currentUser.id, false, false);
          console.log('Données sans filtre currentPeriodOnly:', Object.keys(dataWithoutFilter.selections).length);
          
          if (dataWithoutFilter?.validatedAt) {
            console.log('Utilisation des données sans filtre car validatedAt trouvé');
            setPlanningData({
              selections: dataWithoutFilter.selections,
              validatedAt: dataWithoutFilter.validatedAt
            });
          } else {
            // Dernier essai avec filtrage par période courante
            const data = await getAllDesiderata(currentUser.id, false, true);
            console.log('Données ACTUELLES des désidératas pour', currentUser.id, 'total:', Object.keys(data.selections).length);
            console.log('Clés des désidératas actuels:', Object.keys(data.selections));
            
            if (data?.validatedAt) {
              console.log('Utilisateur a validé ses désidératas:', currentUser.id, 'date:', data.validatedAt);
              setPlanningData({
                selections: data.selections,
                validatedAt: data.validatedAt
              });
            } else {
              console.log('⚠️ Aucun planning validé trouvé pour', currentUser.id);
              console.log('Statut validé dans user object:', currentUser.hasValidatedPlanning);
            }
          }
        }
      } catch (error) {
        console.error('Error loading planning:', error);
      } finally {
        setLoadingPlanning(false);
      }
    };

    loadPlanning();
  }, [currentUser, activeTab]);

  // Fonctions pour la navigation entre utilisateurs dans l'onglet plannings validés
  const handleUserChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(event.target.value);
  };
  
  const goToPrevious = () => {
    const currentIndex = validatedUsers.findIndex(user => user.id === selectedUserId);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : validatedUsers.length - 1;
    setSelectedUserId(validatedUsers[newIndex].id);
  };

  const goToNext = () => {
    const currentIndex = validatedUsers.findIndex(user => user.id === selectedUserId);
    const newIndex = currentIndex < validatedUsers.length - 1 ? currentIndex + 1 : 0;
    setSelectedUserId(validatedUsers[newIndex].id);
  };

  const handleDownloadPlanning = async (userId: string, format: 'pdf') => {
    try {
      setToast({
        visible: true,
        message: 'Préparation du fichier PDF...',
        type: 'success'
      });
      
      const user = users.find(u => u.id === userId);
      if (!user) {
        setToast({
          visible: true,
          message: 'Utilisateur introuvable',
          type: 'error'
        });
        return;
      }

      const desiderata = await getDesiderata(userId);
      if (!desiderata?.selections || !config.isConfigured) {
        setToast({
          visible: true,
          message: 'Aucune donnée disponible pour ce planning',
          type: 'error'
        });
        return;
      }

      // Afficher les sélections pour débogage
      console.log("Sélections pour PDF (admin):", desiderata.selections);
      console.log("Nombre de sélections:", Object.keys(desiderata.selections).length);
      
      // Afficher les données brutes pour débogage
      console.log("Structure des données de desiderata:", JSON.stringify(desiderata.selections).slice(0, 200) + "...");
      
      // Ne pas transformer les données - conserver la structure complète des objets avec les commentaires
      const exportOptions = {
        userName: `${user.lastName}_${user.firstName}`,
        startDate: config.startDate,
        endDate: config.endDate,
        assignments: {} as Record<string, ShiftAssignment>, // Garder cette propriété vide
        desiderata: desiderata.selections, // Utiliser directement les sélections avec commentaires
        primaryLimit: config.primaryDesiderataLimit,
        secondaryLimit: config.secondaryDesiderataLimit,
        showAssignmentsOnly: false, // Assurer que les desiderata sont affichés
        showComments: true // Activer l'affichage des commentaires
      };

      const exportPlanningToPDF = await loadPdfExporter();
      await exportPlanningToPDF(exportOptions);
      
      setToast({
        visible: true,
        message: 'Fichier PDF généré avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading planning:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la génération du fichier PDF',
        type: 'error'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig({
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        deadline: new Date(formData.deadline),
        primaryDesiderataLimit: formData.primaryDesiderataLimit,
        secondaryDesiderataLimit: formData.secondaryDesiderataLimit,
        isConfigured: true,
      });
      setToast({
        visible: true,
        message: 'Configuration enregistrée avec succès',
        type: 'success'
      });
    } catch (error) {
      setToast({
        visible: true,
        message: 'Erreur lors de l\'enregistrement de la configuration',
        type: 'error'
      });
    }
  };

  const handleReset = async (confirmed: boolean) => {
    if (!confirmed) {
      setShowResetConfirmation(true);
      return;
    }
    
    try {
      await resetConfig();
      setFormData({
        startDate: '',
        endDate: '',
        deadline: '',
        primaryDesiderataLimit: 0,
        secondaryDesiderataLimit: 0,
      });
      setToast({
        visible: true,
        message: 'Configuration réinitialisée avec succès',
        type: 'success'
      });
      setShowResetConfirmation(false);
    } catch (error) {
      setToast({
        visible: true,
        message: 'Erreur lors de la réinitialisation',
        type: 'error'
      });
    }
  };
  
  const handleArchive = async (confirmed: boolean) => {
    if (!confirmed) {
      setShowArchiveConfirmation(true);
      return;
    }
    
    try {
      // Vérifier si des utilisateurs ont validé leur planning
      if (validatedUsers.length === 0) {
        setToast({
          visible: true,
          message: 'Aucun utilisateur n\'a validé son planning. Impossible d\'archiver.',
          type: 'error'
        });
        setShowArchiveConfirmation(false);
        return;
      }
      
      // Créer la nouvelle configuration
      const newConfig = {
        startDate: new Date(newPeriodData.startDate),
        endDate: new Date(newPeriodData.endDate),
        deadline: new Date(newPeriodData.deadline),
        primaryDesiderataLimit: formData.primaryDesiderataLimit,
        secondaryDesiderataLimit: formData.secondaryDesiderataLimit,
      };
      
      // Archiver la période actuelle et créer une nouvelle
      await archivePlanningPeriod(newConfig);
      
      setToast({
        visible: true,
        message: 'Période archivée et nouvelle période créée avec succès',
        type: 'success'
      });
      
      // Recharger les périodes archivées
      await loadArchivedPeriods();
      
      // Fermer la modale
      setShowArchiveConfirmation(false);
      
      // Rediriger vers l'onglet des périodes archivées
      changeTab('archived-periods');
    } catch (error) {
      console.error('Error archiving period:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'archivage de la période',
        type: 'error'
      });
    }
  };

  // Fonction pour changer d'onglet
  const changeTab = (tab: TabType) => {
    setActiveTab(tab);
    // Mettre à jour l'URL sans recharger la page
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', tab);
    navigate({
      pathname: location.pathname,
      search: searchParams.toString()
    }, { replace: true });
    
    // Si on passe à l'onglet des périodes archivées, sélectionner la première période
    if (tab === 'archived-periods' && archivedPeriods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(archivedPeriods[0].id);
    }
  };

  // Rendu conditionnel du contenu de l'onglet Plannings validés
  const renderValidatedPlanningsTab = () => {
    if (!config.isConfigured) {
      return (
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Planning non configuré</h2>
          <p className="text-yellow-700">
            Le planning doit être configuré avant de pouvoir visualiser les desiderata.
          </p>
        </div>
      );
    }

    if (validatedUsers.length === 0) {
      return (
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Aucun planning validé</h2>
          <p className="text-yellow-700">
            Aucun utilisateur n'a encore validé son planning.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Plannings Validés</h2>
          <div className="flex items-center">
            <div className="inline-flex items-center">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Médecin précédent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <select
                value={selectedUserId}
                onChange={handleUserChange}
                className="block w-64 pl-4 pr-10 py-2 mx-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              >
                {validatedUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.lastName} {user.firstName}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-5 w-5 text-gray-400 pointer-events-none absolute right-5" />
              <button
                onClick={goToNext}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Médecin suivant"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {loadingPlanning ? (
          <LoadingSpinner />
        ) : (
          planningData && currentUser && (
            <PlanningPreview
              user={{
                firstName: currentUser.firstName,
                lastName: currentUser.lastName
              }}
              selections={planningData.selections}
              validatedAt={planningData.validatedAt}
              startDate={config.startDate}
              endDate={config.endDate}
              primaryLimit={config.primaryDesiderataLimit}
              secondaryLimit={config.secondaryDesiderataLimit}
            />
          )
        )}
      </div>
    );
  };

  // Rendu conditionnel du contenu de l'onglet Configuration
  const renderConfigurationTab = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Paramètres du Planning</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => handleArchive(false)}
            className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            disabled={!config.isConfigured || validatedUsers.length === 0}
            title={!config.isConfigured ? "Le planning doit être configuré" : validatedUsers.length === 0 ? "Aucun utilisateur n'a validé son planning" : ""}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archiver et créer
          </button>
          <button
            onClick={() => handleReset(false)}
            className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center mb-4">
              <Calendar className="h-6 w-6 text-indigo-600 mr-2" />
              <h2 className="text-xl font-semibold">Paramètres</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Période</label>
                <div className="mt-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Début</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fin</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date limite de réponse
                </label>
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pourcentage Desiderata Primaires ({formData.primaryDesiderataLimit}%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.primaryDesiderataLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryDesiderataLimit: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                  <div className="flex items-center gap-2 min-w-[4rem] px-2 py-1 bg-red-50 rounded-md">
                    <Percent className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">{formData.primaryDesiderataLimit}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pourcentage Desiderata Secondaires ({formData.secondaryDesiderataLimit}%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.secondaryDesiderataLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondaryDesiderataLimit: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex items-center gap-2 min-w-[4rem] px-2 py-1 bg-blue-50 rounded-md">
                    <Percent className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{formData.secondaryDesiderataLimit}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <Save className="h-4 w-4 mr-2" />
                Valider la configuration
              </button>
            </div>
          </form>
        </div>

        <ConfigurationDisplay config={config} />
      </div>
    </>
  );

  // Rendu conditionnel du contenu de l'onglet Utilisateurs
  const renderUsersTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Liste des Utilisateurs</h2>
      <UserStatusList
        users={usersList}
        onDownloadPlanning={handleDownloadPlanning}
        onPreviewPlanning={(userId) => navigate(`/planning/${userId}`)}
      />
    </div>
  );
  
  // Rendu conditionnel du contenu de l'onglet Périodes archivées
  const renderArchivedPeriodsTab = () => {
    if (archivedPeriods.length === 0) {
      return (
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Aucune période archivée</h2>
          <p className="text-yellow-700">
            Aucune période de planning n'a encore été archivée.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Périodes archivées</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4">Liste des périodes</h3>
            <div className="space-y-2">
              {archivedPeriods.map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriodId(period.id)}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    selectedPeriodId === period.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{period.name}</div>
                  <div className="text-sm text-gray-500">
                    {format(period.archivedAt, 'dd/MM/yyyy', { locale: fr })} • 
                    {period.validatedDesiderataCount} réponses
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="col-span-2 bg-white p-4 rounded-lg shadow-md">
            {selectedPeriodId ? (
              <ArchivedPeriodDetails periodId={selectedPeriodId} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Sélectionnez une période pour voir les détails
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <ConfirmationModal
        isOpen={showResetConfirmation}
        title="Réinitialiser la configuration"
        message="Êtes-vous sûr de vouloir réinitialiser la configuration ? Cette action supprimera tous les desiderata existants."
        confirmLabel="Réinitialiser"
        onConfirm={() => handleReset(true)}
        onCancel={() => setShowResetConfirmation(false)}
      />

      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Administration du Planning</h1>
      </div>
      
      {/* Onglets de navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => changeTab('configuration')}
            className={`${
              activeTab === 'configuration'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Settings className="h-5 w-5 mr-2" />
            Configuration
          </button>
          <button
            onClick={() => changeTab('validated-plannings')}
            className={`${
              activeTab === 'validated-plannings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <CheckSquare className="h-5 w-5 mr-2" />
            Plannings Validés
          </button>
          <button
            onClick={() => changeTab('archived-periods')}
            className={`${
              activeTab === 'archived-periods'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Archive className="h-5 w-5 mr-2" />
            Périodes archivées
          </button>
          <button
            onClick={() => changeTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Users className="h-5 w-5 mr-2" />
            Utilisateurs
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="mt-6">
        {activeTab === 'configuration' && renderConfigurationTab()}
        {activeTab === 'validated-plannings' && renderValidatedPlanningsTab()}
        {activeTab === 'archived-periods' && renderArchivedPeriodsTab()}
        {activeTab === 'users' && renderUsersTab()}
      </div>
      
      {/* Modale de confirmation pour l'archivage */}
      <ConfirmationModal
        isOpen={showArchiveConfirmation}
        title="Archiver la période actuelle"
        message={
          <div className="space-y-4">
            <p>Êtes-vous sûr de vouloir archiver la période actuelle et en créer une nouvelle ?</p>
            <p>Les desiderata validés seront conservés dans l'historique.</p>
            
            <div className="mt-4">
              <h3 className="font-medium mb-2">Paramètres de la nouvelle période</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Début</label>
                  <input
                    type="date"
                    value={newPeriodData.startDate}
                    onChange={(e) => setNewPeriodData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fin</label>
                  <input
                    type="date"
                    value={newPeriodData.endDate}
                    onChange={(e) => setNewPeriodData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Date limite</label>
                <input
                  type="datetime-local"
                  value={newPeriodData.deadline}
                  onChange={(e) => setNewPeriodData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        }
        confirmLabel="Archiver et créer"
        onConfirm={() => handleArchive(true)}
        onCancel={() => setShowArchiveConfirmation(false)}
      />
    </div>
  );
};

export default AdminPage;
