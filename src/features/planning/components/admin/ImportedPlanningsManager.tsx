import React, { useState, useRef } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { saveGeneratedPlanning, createPlanningPeriod, deletePlanningPeriod, updatePlanningPeriod, deletePlanningForPeriod, validateBagAndMergePeriods } from '../../../../lib/firebase/planning';
import { useImportExport } from '../../hooks';
import { usePlanningPeriod } from '../../../../context/planning';
import { useBagPhase } from '../../../../context/shiftExchange';
import { X, Upload, Trash2, Check, X as XIcon, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlanningPeriod, GeneratedPlanning } from '../../../../types/planning';
import type { User } from '../../../../types/users';
import { ConfirmationModal } from '../../../../components/modals';

interface ImportedPlanningsManagerProps {
  users: User[];
  uploadPeriodId: string;
  allPeriods: PlanningPeriod[];
  setUploadPeriodId: (id: string) => void;
  uploadedPlannings: Record<string, Record<string, GeneratedPlanning>>;
  setUploadedPlannings: React.Dispatch<React.SetStateAction<Record<string, Record<string, GeneratedPlanning>>>>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  refreshPeriods?: () => Promise<void>;
  onPlanningImported?: (userId: string, planning: GeneratedPlanning, periodId: string) => void;
}

type PeriodStatus = 'active' | 'future' | 'archived';
type BagPhase = 'submission' | 'distribution' | 'completed';

/**
 * Composant pour l'import et la gestion des plannings
 */
const ImportedPlanningsManager: React.FC<ImportedPlanningsManagerProps> = ({ 
  users, 
  uploadPeriodId, 
  allPeriods, 
  setUploadPeriodId,
  uploadedPlannings,
  setUploadedPlannings,
  onSuccess, 
  onError,
  refreshPeriods,
  onPlanningImported
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États pour la gestion des périodes et des plannings
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(uploadPeriodId || '');
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [isBagEnabled, setIsBagEnabled] = useState<boolean>(true);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const periodsPerPage = 4; // Nombre de périodes visibles à la fois
  
  // États pour les modals de confirmation
  const [showDeletePeriodConfirmation, setShowDeletePeriodConfirmation] = useState<boolean>(false);
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [showDeleteUserPlanningConfirmation, setShowDeleteUserPlanningConfirmation] = useState<boolean>(false);
  const [userPlanningToDelete, setUserPlanningToDelete] = useState<{userId: string, periodId: string} | null>(null);
  
  // Utiliser le hook d'import/export
  const { 
    isProcessing, 
    error,
    handleFileUpload,
    lastImportResult
  } = useImportExport({
    uploadPeriodId: selectedPeriodId || uploadPeriodId,
    users,
    onSuccess,
    onError,
    saveGeneratedPlanning,
    allPeriods,
    createPlanningPeriod,
    setUploadPeriodId: (id) => {
      setSelectedPeriodId(id);
      setUploadPeriodId(id);
    },
    refreshPeriods,
    newPeriodName,
    isBagEnabled,
    onImportComplete: (result) => {
      // Mettre à jour les plannings importés
      if (result.successfulImports.length > 0) {
        result.successfulImports.forEach(({ user }) => {
          if (onPlanningImported && user.id) {
            // Parcourir toutes les périodes pour trouver les plannings de cet utilisateur
            allPeriods.forEach(period => {
              const periodId = period.id;
              
              // Vérifier si ce planning existe dans uploadedPlannings
              if (uploadedPlannings[periodId] && uploadedPlannings[periodId][user.id]) {
                const planning = uploadedPlannings[periodId][user.id];
                
                // Notifier le composant parent pour cette période
                onPlanningImported(user.id, planning, periodId);
              }
            });
            
            // Si nous avons créé de nouvelles périodes qui ne sont pas encore dans allPeriods
            Object.keys(uploadedPlannings).forEach(periodId => {
              if (!allPeriods.some(p => p.id === periodId) && 
                  uploadedPlannings[periodId] && 
                  uploadedPlannings[periodId][user.id]) {
                const planning = uploadedPlannings[periodId][user.id];
                
                // Notifier le composant parent pour cette période
                onPlanningImported(user.id, planning, periodId);
              }
            });
          }
        });
      }
    }
  });

  // Handler pour la sélection de fichiers
  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files));
    }
  };
  
  /**
   * Fonction pour supprimer une période
   */
  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    
    try {
      await deletePlanningPeriod(periodToDelete);
      
      // Si la période supprimée était sélectionnée, réinitialiser la sélection
      if (periodToDelete === selectedPeriodId) {
        setSelectedPeriodId('');
        setUploadPeriodId('');
      }
      
      // Rafraîchir les périodes
      if (refreshPeriods) {
        await refreshPeriods();
      }
      
      onSuccess('Période supprimée avec succès');
      
      // Réinitialiser
      setPeriodToDelete(null);
      setShowDeletePeriodConfirmation(false);
    } catch (error) {
      console.error('Error deleting period:', error);
      onError('Erreur lors de la suppression de la période');
    }
  };
  
  /**
   * Fonction pour supprimer le planning d'un utilisateur pour une période spécifique
   */
  const handleDeleteUserPlanning = async () => {
    if (!userPlanningToDelete) return;
    
    try {
      // Supprimer le planning de l'utilisateur
      await deletePlanningForPeriod(userPlanningToDelete.userId, userPlanningToDelete.periodId);
      
      // Mettre à jour l'état local
      setUploadedPlannings(prev => {
        const newState = { ...prev };
        
        // Vérifier si la période existe
        if (newState[userPlanningToDelete.periodId]) {
          // Supprimer le planning de l'utilisateur
          const { [userPlanningToDelete.userId]: _, ...restUsers } = newState[userPlanningToDelete.periodId];
          newState[userPlanningToDelete.periodId] = restUsers;
        }
        
        return newState;
      });
      
      onSuccess('Planning supprimé avec succès');
      
      // Réinitialiser
      setUserPlanningToDelete(null);
      setShowDeleteUserPlanningConfirmation(false);
    } catch (error) {
      console.error('Error deleting user planning:', error);
      onError('Erreur lors de la suppression du planning');
    }
  };
  
  // Hooks pour accéder aux contextes de période et de phase BAG
  const planningPeriod = usePlanningPeriod();
  const { updateConfig: updateBagPhaseConfig } = useBagPhase();
  
  /**
   * Fonction pour mettre à jour le statut d'une période
   * Met également à jour la phase BAG en fonction du statut
   */
  const handleUpdatePeriodStatus = async (periodId: string, newStatus: PeriodStatus) => {
    try {
      // Récupérer la période concernée
      const period = allPeriods.find(p => p.id === periodId);
      if (!period) {
        throw new Error('Période non trouvée');
      }
      
      // Déterminer la phase BAG appropriée en fonction du statut
      let newBagPhase: BagPhase | undefined;
      
      switch (newStatus) {
        case 'future':
          // Si le statut passe à future, commencer par la phase de soumission
          newBagPhase = 'submission';
          break;
        case 'active':
          // Si le statut passe à active, la phase BAG est terminée
          newBagPhase = 'completed';
          break;
        // Pour les autres statuts, ne pas modifier la phase BAG
      }
      
      // Si une nouvelle phase BAG est déterminée, mettre à jour les deux
      if (newBagPhase) {
        await updatePlanningPeriod(periodId, { 
          status: newStatus,
          bagPhase: newBagPhase
        });
        
        // Si la période est future ou active, mettre à jour la configuration globale de la BAG
        if (newStatus === 'future' || newStatus === 'active') {
          await updateBagPhaseConfig({
            phase: newBagPhase,
            submissionDeadline: new Date(period.endDate),
            isValidated: newBagPhase === 'completed',
            isConfigured: true
          });
        }
        
        onSuccess(`Statut de la période mis à jour avec succès: ${newStatus} et phase BAG mise à jour à "${newBagPhase}"`);
      } else {
        // Sinon, mettre à jour uniquement le statut
        await updatePlanningPeriod(periodId, { status: newStatus });
        onSuccess(`Statut de la période mis à jour avec succès: ${newStatus}`);
      }
      
      // Rafraîchir les périodes
      if (refreshPeriods) {
        await refreshPeriods();
      }
    } catch (error) {
      console.error('Error updating period status:', error);
      onError('Erreur lors de la mise à jour du statut de la période');
    }
  };
  
  /**
   * Fonction pour mettre à jour la phase BAG d'une période
   * Met automatiquement à jour le statut de la période en fonction de la phase
   * Quand la phase passe à "completed", déclenche également la validation de la BAG
   */
  const handleUpdatePeriodBagPhase = async (periodId: string, newPhase: BagPhase) => {
    try {
      // Récupérer la période concernée
      const period = allPeriods.find(p => p.id === periodId);
      if (!period) {
        throw new Error('Période non trouvée');
      }
      
      let newStatus: PeriodStatus;
      
      // Déterminer le statut approprié en fonction de la phase
      switch (newPhase) {
        case 'submission':
          // En phase de soumission, la période est future
          newStatus = 'future';
          break;
        case 'distribution':
          // En phase de distribution, la période est toujours future
          newStatus = 'future';
          break;
        case 'completed':
          // En phase terminée, la période devient active
          newStatus = 'active';
          break;
        default:
          // Par défaut (ne devrait jamais arriver avec le typage)
          newStatus = 'future';
      }
      
      // Si la phase passe à "completed", effectuer des actions supplémentaires
      if (newPhase === 'completed') {
        // Mettre à jour la configuration globale BAG
        await updateBagPhaseConfig({
          phase: 'completed',
          submissionDeadline: new Date(period.endDate),
          isValidated: true,
          isConfigured: true
        });
        
        // Valider la bourse aux gardes et fusionner les périodes
        // Note: validateBag utilise validateBagAndMergePeriods
        try {
          await validateBagAndMergePeriods(periodId);
          onSuccess(`La bourse aux gardes a été validée et les périodes ont été fusionnées.`);
        } catch (e) {
          console.error('Erreur lors de la validation de la BAG:', e);
          // Continuer même en cas d'erreur de validation, mais mettre à jour le statut et la phase
        }
      } else {
        // Pour les autres phases, mettre à jour la configuration globale BAG
        await updateBagPhaseConfig({
          phase: newPhase,
          submissionDeadline: new Date(period.endDate),
          isValidated: false,
          isConfigured: true
        });
        
        // Mettre à jour le statut et la phase BAG de la période
        await updatePlanningPeriod(periodId, { 
          bagPhase: newPhase,
          status: newStatus
        });
        
        onSuccess(`Phase BAG de la période mise à jour avec succès: ${newPhase} et statut mis à jour à "${newStatus}"`);
      }
      
      // Rafraîchir les périodes dans tous les cas
      if (refreshPeriods) {
        await refreshPeriods();
      }
    } catch (error) {
      console.error('Error updating period BAG phase:', error);
      onError('Erreur lors de la mise à jour de la phase BAG de la période');
    }
  };
  
  // Trouver la période sélectionnée
  const selectedPeriod = allPeriods.find(p => p.id === selectedPeriodId);
  
  // Obtenir les utilisateurs qui ont un planning pour la période sélectionnée
  const usersWithPlanning = selectedPeriodId && uploadedPlannings[selectedPeriodId] 
    ? Object.keys(uploadedPlannings[selectedPeriodId]).map(userId => {
        const user = users.find(u => u.id === userId);
        return user ? { ...user, hasPlanning: true } : null;
      }).filter(Boolean) as (User & { hasPlanning: boolean })[]
    : [];
  
  // Obtenir les utilisateurs qui n'ont pas de planning pour la période sélectionnée
  const usersWithoutPlanning = selectedPeriodId
    ? users
        .filter(user => !usersWithPlanning.some(u => u.id === user.id))
        .map(user => ({ ...user, hasPlanning: false }))
    : [];
  
  // Combiner les listes, avec les utilisateurs sans planning en premier
  const allUsersForSelectedPeriod = [...usersWithoutPlanning, ...usersWithPlanning];
  
  // Vérifier si une période est divisée (contient "Passé" ou "Futur")
  const isPeriodDivided = (period: PlanningPeriod): boolean => {
    return period.name.includes('Passé') || period.name.includes('Futur');
  };
  
  // Simplifier le nom de la période
  const simplifyPeriodName = (periodName: string): string => {
    // Extraire les mois et années du nom complet
    const nameParts = periodName.split(' ');
    if (nameParts.length < 3) return periodName;
    
    const months = nameParts[0].split('-');
    if (months.length === 2) {
      const year = nameParts[2].substring(0, 4);
      // Extraire juste les trois premières lettres du mois
      const startMonth = months[0].substring(0, 3);
      const endMonth = months[1].substring(0, 3);
      return `${startMonth}-${endMonth} ${year.substring(2)}`;
    }
    
    return periodName;
  };
  
  // Formater la date de manière courte
  const formatShortDate = (date: Date): string => {
    return formatParisDate(new Date(date), 'dd/MM/yy', { locale: frLocale });
  };

  return (
    <div className="space-y-6">
      {/* Interface d'importation simplifiée */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Import de plannings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Importez des plannings au format CSV. Le nom du fichier doit contenir le nom de l'utilisateur et le contenu doit comporter les colonnes Date, Créneau et Type.
        </p>
        
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-md font-medium text-gray-800 mb-3">Configuration d'import</h3>
          <div className="space-y-4">
            {/* Option nom de période */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la période (optionnel)
              </label>
              <input
                type="text"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                placeholder="Laissez vide pour générer automatiquement"
              />
              <p className="mt-1 text-xs text-gray-500">
                Si laissé vide, un nom sera généré automatiquement en fonction des dates détectées dans les fichiers
              </p>
            </div>
            
            {/* Option Bourse aux gardes */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="bag-enabled-main"
                  type="checkbox"
                  checked={isBagEnabled}
                  onChange={(e) => setIsBagEnabled(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="bag-enabled-main" className="font-medium text-gray-700">
                  Soumettre à la bourse aux gardes
                </label>
                <p className="text-gray-500">
                  Les gardes futures seront soumises à la bourse aux gardes avant d'être disponibles pour les échanges directs.
                </p>
              </div>
            </div>
            
            {/* Zone de dépôt ou bouton d'importation */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isProcessing}
              >
                <Upload className="h-5 w-5 mr-2" />
                {isProcessing ? 'Importation en cours...' : 'Importer des fichiers'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFilesSelected} 
                accept=".csv" 
                multiple 
                className="hidden" 
              />
            </div>
          </div>
        </div>
        
        {/* Affichage des résultats d'importation */}
        {lastImportResult && lastImportResult.successfulImports.length > 0 && (
          <div className="mb-6 p-3 bg-green-50 text-green-800 rounded-md">
            <h4 className="font-medium mb-2">Importations réussies ({lastImportResult.successfulImports.length}) :</h4>
            <ul className="list-disc pl-5 text-sm">
              {lastImportResult.successfulImports.map((item, index) => (
                <li key={index}>{item.fileName} → {item.user.lastName} {item.user.firstName}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Affichage des erreurs */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
            <h4 className="font-medium mb-2">Erreurs lors de l'importation :</h4>
            <div className="whitespace-pre-line">
              {error}
            </div>
            {lastImportResult && lastImportResult.failedFiles.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Réessayer l'importation
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Conteneur unique pour périodes et utilisateurs */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Gestion des périodes et imports</h3>
        
      {/* Liste des périodes avec navigation */}
      <div className="mb-6 relative">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Périodes</h4>
        
        {allPeriods.length === 0 ? (
          <div className="p-3 bg-gray-50 rounded-lg text-gray-500 text-center text-sm w-full">
            Aucune période définie
          </div>
        ) : (
          <>
            <div className="flex items-center">
              {/* Bouton précédent */}
              <button 
                onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Périodes précédentes"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {/* Liste des périodes */}
              <div className="flex space-x-3 overflow-hidden mx-2 flex-grow">
                {[...allPeriods]
                  // Trier les périodes par date de début (de la plus ancienne à la plus récente)
                  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                  // Extraire les périodes pour la page actuelle
                  .slice(
                    currentPageIndex * periodsPerPage, 
                    (currentPageIndex + 1) * periodsPerPage
                  )
                  .map((period) => (
                    <div 
                      key={period.id}
                      onClick={() => setSelectedPeriodId(period.id)}
                      className={`p-3 rounded-md border cursor-pointer flex-shrink-0 min-w-[180px] flex-1 ${
                        period.id === selectedPeriodId 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* Nom simplifié de la période */}
                      <div className="font-medium text-sm">
                        {simplifyPeriodName(period.name)}
                      </div>
                      
                      {/* Dates en petit et grisé */}
                      <div className="text-xs text-gray-500 mt-1">
                        {formatShortDate(period.startDate)} - {formatShortDate(period.endDate)}
                      </div>
                      
                      {/* Contrôles de statut */}
                      <div className="flex flex-col space-y-2 mt-3">
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-16">Statut:</span>
                          <select 
                            className="text-xs border-gray-200 rounded focus:ring-indigo-500 focus:border-indigo-500 ml-2 flex-1"
                            value={period.status}
                            onChange={(e) => handleUpdatePeriodStatus(period.id, e.target.value as PeriodStatus)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="active">Active</option>
                            <option value="future">Future</option>
                            <option value="archived">Archivée</option>
                          </select>
                        </div>
                        
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-16">Phase:</span>
                          <select 
                            className="text-xs border-gray-200 rounded focus:ring-indigo-500 focus:border-indigo-500 ml-2 flex-1"
                            value={period.bagPhase}
                            onChange={(e) => handleUpdatePeriodBagPhase(period.id, e.target.value as BagPhase)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="submission">Soumission</option>
                            <option value="distribution">Distribution</option>
                            <option value="completed">Terminée</option>
                          </select>
                        </div>
                        
                        <div className="flex justify-end mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPeriodToDelete(period.id);
                              setShowDeletePeriodConfirmation(true);
                            }}
                            className="text-red-600 hover:text-red-900 p-1 rounded text-xs flex items-center"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              
              {/* Bouton suivant */}
              <button 
                onClick={() => setCurrentPageIndex(prev => Math.min(Math.ceil(allPeriods.length / periodsPerPage) - 1, prev + 1))}
                disabled={currentPageIndex >= Math.ceil(allPeriods.length / periodsPerPage) - 1}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Périodes suivantes"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            {/* Indicateur de pagination */}
            {Math.ceil(allPeriods.length / periodsPerPage) > 1 && (
              <div className="text-xs text-gray-500 text-center mt-2">
                {currentPageIndex + 1} / {Math.ceil(allPeriods.length / periodsPerPage)}
              </div>
            )}
          </>
        )}
        </div>
        
        {/* Liste des utilisateurs */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {selectedPeriod 
              ? `Utilisateurs pour "${simplifyPeriodName(selectedPeriod.name)}"` 
              : "Sélectionnez une période pour voir les utilisateurs"
            }
          </h4>
          
          {!selectedPeriod ? (
            <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-center">
              Veuillez sélectionner une période ci-dessus
            </div>
          ) : allUsersForSelectedPeriod.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-center">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                {allUsersForSelectedPeriod.map((user) => (
                  <div 
                    key={user.id} 
                    className={`p-3 flex justify-between items-center ${!user.hasPlanning ? 'bg-red-50' : ''} border-b border-gray-200`}
                  >
                    <div>
                      <span className="font-medium text-sm">{user.lastName} {user.firstName}</span>
                      {!user.hasPlanning ? (
                        <span className="ml-2 text-xs text-red-600 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Manquant
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-green-600 flex items-center">
                          <Check className="h-3 w-3 mr-1" />
                          Importé
                        </span>
                      )}
                    </div>
                    
                    {user.hasPlanning && (
                      <button
                        onClick={() => {
                          setUserPlanningToDelete({ userId: user.id, periodId: selectedPeriodId });
                          setShowDeleteUserPlanningConfirmation(true);
                        }}
                        className="text-red-600 hover:text-red-900 p-1 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Statistiques des imports */}
          {selectedPeriod && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Utilisateurs avec planning importé : </span>
                {usersWithPlanning.length} / {users.length}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de confirmation de suppression de période */}
      <ConfirmationModal
        isOpen={showDeletePeriodConfirmation}
        title="Supprimer la période"
        message={`Êtes-vous sûr de vouloir supprimer cette période ? Cette action est irréversible et supprimera tous les plannings associés.`}
        confirmLabel="Supprimer"
        onConfirm={handleDeletePeriod}
        onCancel={() => {
          setShowDeletePeriodConfirmation(false);
          setPeriodToDelete(null);
        }}
      />
      
      {/* Modal de confirmation de suppression de planning utilisateur */}
      <ConfirmationModal
        isOpen={showDeleteUserPlanningConfirmation}
        title="Supprimer le planning"
        message={`Êtes-vous sûr de vouloir supprimer le planning de cet utilisateur pour cette période ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDeleteUserPlanning}
        onCancel={() => {
          setShowDeleteUserPlanningConfirmation(false);
          setUserPlanningToDelete(null);
        }}
      />
    </div>
  );
};

export default ImportedPlanningsManager;
