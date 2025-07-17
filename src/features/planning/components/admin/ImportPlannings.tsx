import React, { useState, useRef } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { frLocale } from '../../../../utils/dateLocale';
import { saveGeneratedPlanning, createPlanningPeriod, deletePlanningPeriod } from '../../../../lib/firebase/planning';
import { useImportExport } from '../../hooks';
import { X, Upload, Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import type { PlanningPeriod, GeneratedPlanning } from '../../../../types/planning';
import type { User } from '../../../../types/users';
import { ConfirmationModal } from '../../../../components/modals';

interface ImportPlanningsProps {
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

/**
 * Composant Modal pour l'import de plannings
 */
interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  allPeriods: PlanningPeriod[];
  uploadPeriodId: string;
  setUploadPeriodId: (id: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onPlanningImported: (userId: string, planning: GeneratedPlanning, periodId: string) => void;
  refreshPeriods?: () => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  users,
  allPeriods,
  uploadPeriodId,
  setUploadPeriodId,
  onSuccess,
  onError,
  onPlanningImported,
  refreshPeriods
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBagEnabled, setIsBagEnabled] = useState<boolean>(true);
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [showDeletePeriodConfirmation, setShowDeletePeriodConfirmation] = useState<boolean>(false);
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  
  // Utiliser le hook d'import/export avec les nouveaux paramètres
  const {
    isProcessing,
    error,
    handleFileUpload,
    lastImportResult
  } = useImportExport({
    uploadPeriodId,
    users,
    onSuccess,
    onError,
    saveGeneratedPlanning,
    allPeriods,
    onPlanningImported,
    createPlanningPeriod,
    setUploadPeriodId,
    refreshPeriods,
    newPeriodName,
    isBagEnabled
  });

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
      if (periodToDelete === uploadPeriodId) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Importer des plannings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Importez des plannings au format CSV. Le nom du fichier doit contenir le nom de l'utilisateur et le contenu doit comporter les colonnes Date, Créneau et Type.
        </p>
        
        {/* Interface d'importation simplifiée */}
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-md font-medium text-gray-800 mb-3">Configuration de l'importation</h3>
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
                  id="bag-enabled"
                  type="checkbox"
                  checked={isBagEnabled}
                  onChange={(e) => setIsBagEnabled(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="bag-enabled" className="font-medium text-gray-700">
                  Soumettre à la bourse aux gardes
                </label>
                <p className="text-gray-500">
                  Les gardes futures seront soumises à la bourse aux gardes avant d'être disponibles pour les échanges directs.
                  Les gardes passées seront automatiquement archivées.
                </p>
              </div>
            </div>
            
            {/* Zone de dépôt de fichiers */}
            <div 
              className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFilesSelected} 
                accept=".csv" 
                multiple 
                className="hidden" 
              />
              
              {isProcessing ? (
                <div className="text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                  <p>Traitement en cours...</p>
                </div>
              ) : (
                <>
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-2">
                    <Upload className="h-full w-full" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Cliquez pour sélectionner un ou plusieurs fichiers CSV</p>
                  <p className="text-xs text-gray-500">Format accepté: CSV uniquement</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Périodes existantes */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-800 mb-3">Périodes existantes</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phase BaG
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allPeriods.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      Aucune période définie
                    </td>
                  </tr>
                ) : (
                  allPeriods.map((period) => (
                    <tr key={period.id} className={`${period.id === uploadPeriodId ? 'bg-blue-50' : ''} hover:bg-gray-50`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {period.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatParisDate(period.startDate, 'dd/MM/yyyy', { locale: frLocale })} - {formatParisDate(period.endDate, 'dd/MM/yyyy', { locale: frLocale })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          period.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : period.status === 'future'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {period.status === 'active' 
                            ? 'Active' 
                            : period.status === 'future'
                              ? 'Future'
                              : 'Archivée'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          period.bagPhase === 'submission' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : period.bagPhase === 'distribution'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {period.bagPhase === 'submission' 
                            ? 'Soumission' 
                            : period.bagPhase === 'distribution'
                              ? 'Distribution'
                              : 'Terminée'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end items-center space-x-2">
                          <button
                            onClick={() => {
                              setUploadPeriodId(period.id);
                            }}
                            className={`${period.id === uploadPeriodId ? 'text-blue-700 bg-blue-100' : 'text-blue-600 hover:text-blue-900'} px-2 py-1 rounded`}
                          >
                            Sélectionner
                          </button>
                          <button
                            onClick={() => {
                              setPeriodToDelete(period.id);
                              setShowDeletePeriodConfirmation(true);
                            }}
                            className="text-red-600 hover:text-red-900 px-2 py-1 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
          <div className="mb-6 p-3 bg-red-50 text-red-800 rounded-md text-sm">
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
        
        {/* Boutons d'action */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
      
      {/* Modal de confirmation de suppression de période */}
      <ConfirmationModal
        isOpen={showDeletePeriodConfirmation}
        title="Supprimer la période"
        message={`Êtes-vous sûr de vouloir supprimer cette période ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDeletePeriod}
        onCancel={() => {
          setShowDeletePeriodConfirmation(false);
          setPeriodToDelete(null);
        }}
      />
    </div>
  );
};

/**
 * Composant pour l'import de plannings
 */
const ImportPlannings: React.FC<ImportPlanningsProps> = ({ 
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // État pour stocker le nom de période et l'option BaG
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [isBagEnabled, setIsBagEnabled] = useState<boolean>(true);
  
  // Utiliser le hook d'import/export avec tous les paramètres nécessaires
  const { 
    isProcessing, 
    error,
    handleFileUpload,
    lastImportResult
  } = useImportExport({
    uploadPeriodId,
    users,
    onSuccess,
    onError,
    saveGeneratedPlanning,
    allPeriods,
    createPlanningPeriod,
    setUploadPeriodId,
    refreshPeriods,
    newPeriodName,
    isBagEnabled,
    onImportComplete: (result) => {
      // Mettre à jour les plannings importés
      if (result.successfulImports.length > 0) {
        result.successfulImports.forEach(({ user }) => {
          if (onPlanningImported && user.id) {
            console.log(`[IMPORT_PLANNINGS] Notification d'importation pour l'utilisateur ${user.id}`);
            
            // Parcourir toutes les périodes pour trouver les plannings de cet utilisateur
            allPeriods.forEach(period => {
              const periodId = period.id;
              
              // Vérifier si ce planning existe dans uploadedPlannings
              if (uploadedPlannings[periodId] && uploadedPlannings[periodId][user.id]) {
                console.log(`[IMPORT_PLANNINGS] Planning trouvé pour la période ${periodId}`);
                const planning = uploadedPlannings[periodId][user.id];
                
                // Notifier le composant parent pour cette période
                onPlanningImported(user.id, planning, periodId);
              }
            });
            
            // Si nous avons créé de nouvelles périodes qui ne sont pas encore dans allPeriods,
            // vérifier également dans toutes les clés de uploadedPlannings
            Object.keys(uploadedPlannings).forEach(periodId => {
              // Vérifier que cette période n'a pas déjà été traitée dans la boucle précédente
              if (!allPeriods.some(p => p.id === periodId) && 
                  uploadedPlannings[periodId] && 
                  uploadedPlannings[periodId][user.id]) {
                console.log(`[IMPORT_PLANNINGS] Planning trouvé pour une nouvelle période ${periodId}`);
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

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Import de plannings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Importez des plannings au format CSV. Le nom du fichier doit contenir le nom de l'utilisateur et le contenu doit comporter les colonnes Date, Créneau et Type.
        </p>
        
        {/* Interface d'importation simplifiée */}
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-md font-medium text-gray-800 mb-3">Importation rapide</h3>
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
            <div className="flex gap-2 justify-center mt-4">
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
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Options avancées
              </button>
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
        
        {/* Tableau récapitulatif des utilisateurs et de leurs plannings */}
        {uploadPeriodId && uploadedPlannings[uploadPeriodId] && (
          <div className="mt-6">
            <h3 className="text-md font-medium text-gray-800 mb-2">Plannings importés pour cette période</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Utilisateurs avec planning importé : </span>
                {uploadedPlannings[uploadPeriodId] ? Object.keys(uploadedPlannings[uploadPeriodId]).length : 0} / {users.length}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal avancée d'importation */}
      <ImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        users={users}
        allPeriods={allPeriods}
        uploadPeriodId={uploadPeriodId}
        setUploadPeriodId={setUploadPeriodId}
        onSuccess={onSuccess}
        onError={onError}
        onPlanningImported={(userId, planning, periodId) => {
          // Mettre à jour l'état uploadedPlannings avec le planning importé
          setUploadedPlannings(prev => {
            const newState = { ...prev };
            
            // Créer l'objet pour la période si nécessaire
            if (!newState[periodId]) {
              newState[periodId] = {};
            }
            
            // Ajouter le planning pour cet utilisateur
            newState[periodId][userId] = planning;
            
            return newState;
          });
          
          // Notifier le composant parent de l'importation réussie
          if (onPlanningImported) {
            onPlanningImported(userId, planning, periodId);
          }
        }}
        refreshPeriods={refreshPeriods}
      />
    </div>
  );
};

export default ImportPlannings;
