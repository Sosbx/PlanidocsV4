import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, AlertCircle, Download, ChevronLeft, ChevronRight, Trash2, RotateCcw } from 'lucide-react';
import { Import as FileImport, Eye } from 'lucide-react';
import { parse, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, getDocs, deleteDoc, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config'; 
import { usePlanningConfig } from '../context/PlanningContext';
import { useUsers } from '../context/UserContext';
import { saveGeneratedPlanning, deletePlanning } from '../lib/firebase/planning';
import ConfirmationModal from '../components/ConfirmationModal';
import { Switch } from '../components/common/Switch';
import { 
  exportGeneratedPlanningToCSV, 
  exportGeneratedPlanningToPDF,
  exportAllGeneratedPlanningsToPDFZip,
  exportAllGeneratedPlanningsToCSVZip
} from '../utils/generatedPlanningExport';
import type { ShiftAssignment, GeneratedPlanning, ExchangeHistory, Selections } from '../types/planning';
import GeneratedPlanningTable from '../components/planning/GeneratedPlanningTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Toast from '../components/Toast';
import { getDesiderata } from '../lib/firebase/desiderata';

const GeneratedPlanningPage: React.FC = () => {
  const { config } = usePlanningConfig();
  const { users } = useUsers();
  const [activeTab, setActiveTab] = useState<'view' | 'import'>('view');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedPlannings, setUploadedPlannings] = useState<Record<string, GeneratedPlanning>>({});
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeleteAllConfirmation, setShowDeleteAllConfirmation] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [planningToDelete, setPlanningToDelete] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showDesiderata, setShowDesiderata] = useState(false);
  const [desiderata, setDesiderata] = useState<Selections>({});
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});

  // Charger les desiderata quand l'utilisateur sélectionné change
  useEffect(() => {
    const loadDesiderata = async () => {
      if (!selectedUserId) return;
      
      try {
        const data = await getDesiderata(selectedUserId);
        if (data?.selections) {
          setDesiderata(data.selections);
        } else {
          setDesiderata({});
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
        setToast({
          visible: true,
          message: 'Erreur lors du chargement des desiderata',
          type: 'error'
        });
      }
    };

    loadDesiderata();
  }, [selectedUserId]);

  useEffect(() => {
    const loadUploadedPlannings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'generated_plannings'));
        const plannings: Record<string, GeneratedPlanning> = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Convertir le timestamp Firestore en Date
          const uploadedAt = data.uploadedAt?.toDate?.() || new Date(data.uploadedAt);
          
          plannings[doc.id] = {
            assignments: data.assignments,
            uploadedAt
          };
        });
        
        setUploadedPlannings(plannings);

        // Charger également l'historique des échanges pour les permutations
        const historyQuerySnapshot = await getDocs(collection(db, 'exchange_history'));
        const receivedShiftsData: Record<string, { 
          originalUserId: string; 
          newUserId: string; 
          isPermutation: boolean;
          shiftType: string;
          timeSlot: string;
        }> = {};

        historyQuerySnapshot.docs.forEach(doc => {
          const history = doc.data() as ExchangeHistory;
          
          // Ne prendre en compte que les échanges complétés
          if (history.status === 'completed') {
            const key = `${history.date}-${history.period}`;
            receivedShiftsData[key] = {
              originalUserId: history.originalUserId,
              newUserId: history.newUserId,
              isPermutation: Boolean(history.isPermutation),
              shiftType: history.shiftType,
              timeSlot: history.timeSlot
            };
          }
        });

        setReceivedShifts(receivedShiftsData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading uploaded plannings:', error);
        setLoadError('Erreur lors du chargement des plannings');
        setToast({
          visible: true,
          message: 'Erreur lors du chargement des plannings',
          type: 'error'
        });
        setLoading(false);
      }
    };

    loadUploadedPlannings();
  }, []);

  // Sélectionner automatiquement le premier utilisateur avec un planning
  useEffect(() => {
    const usersWithPlannings = Object.keys(uploadedPlannings);
    if (usersWithPlannings.length > 0 && !selectedUserId) {
      setSelectedUserId(usersWithPlannings[0]);
    }
  }, [uploadedPlannings, selectedUserId]);

  const handlePreviousUser = () => {
    const usersWithPlannings = Object.keys(uploadedPlannings);
    const currentIndex = usersWithPlannings.indexOf(selectedUserId);
    if (currentIndex > 0) {
      setSelectedUserId(usersWithPlannings[currentIndex - 1]);
    } else {
      setSelectedUserId(usersWithPlannings[usersWithPlannings.length - 1]);
    }
  };

  const handleNextUser = () => {
    const usersWithPlannings = Object.keys(uploadedPlannings);
    const currentIndex = usersWithPlannings.indexOf(selectedUserId);
    if (currentIndex < usersWithPlannings.length - 1) {
      setSelectedUserId(usersWithPlannings[currentIndex + 1]);
    } else {
      setSelectedUserId(usersWithPlannings[0]);
    }
  };

  const parseCSVFile = async (file: File): Promise<Record<string, ShiftAssignment>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
        
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          // Nettoyer les lignes et gérer les différents encodages et types de sauts de ligne
          const lines = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line);
          
          // Récupérer les en-têtes originaux et leurs versions normalisées
          const headers = lines[0].split(',').map(h => h.trim());
          
          // Afficher les en-têtes pour le débogage
          console.log('En-têtes originaux:', headers);
          
          // Vérifier la présence des en-têtes requis
          const requiredHeaders = ['Date', 'Créneau', 'Type'];
          const missingHeaders = requiredHeaders.filter(required => 
            !headers.some(h => h === required)
          );
          
          if (missingHeaders.length > 0) {
            throw new Error(
              `Format de fichier CSV invalide. L'en-tête doit contenir : Date, Créneau, Type.\n` +
              `En-têtes trouvés : ${headers.join(', ')}\n` +
              `En-têtes manquants : ${missingHeaders.join(', ')}`
            );
          }
          
          // Trouver les indices des colonnes requises
          const dateIndex = headers.findIndex(h => h === 'Date');
          const creneauIndex = headers.findIndex(h => h === 'Créneau');
          const typeIndex = headers.findIndex(h => h === 'Type');

          // Parser les lignes
          const assignments: Record<string, ShiftAssignment> = {};
          
          for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(',').map(field => field.trim());
            const dateStr = fields[dateIndex];
            const timeSlot = fields[creneauIndex];
            const shiftType = fields[typeIndex];
            
            if (!dateStr || !timeSlot || !shiftType) {
              throw new Error(`Ligne ${i + 1} incomplète ou mal formatée`);
            }
            
            try {
              // Valider la date
              const date = parse(dateStr, 'dd-MM-yy', new Date());
              if (isNaN(date.getTime())) throw new Error(`Date invalide à la ligne ${i + 1}: ${dateStr}. Format attendu: JJ-MM-AA`);

              // Extraire et valider les heures du créneau
              const [startStr, endStr] = timeSlot.split(' - ');
              if (!startStr || !endStr) throw new Error(`Format de créneau horaire invalide à la ligne ${i + 1}. Format attendu: HH:MM - HH:MM`);

              // Convertir les heures en minutes depuis minuit
              const getMinutes = (timeStr: string) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes;
              };

              const startMinutes = getMinutes(startStr);
              let endMinutes = getMinutes(endStr);

              // Ajuster la fin si elle est avant le début (cas des gardes de nuit)
              if (endMinutes < startMinutes) endMinutes += 24 * 60;

              // Définir les tranches horaires en minutes
              const MORNING_START = 7 * 60;     // 07:00
              const AFTERNOON_START = 13 * 60;   // 13:00
              const EVENING_START = 20 * 60;     // 20:00
              const DAY_END = 24 * 60;          // 24:00

              // Calculer le temps passé dans chaque période
              const calculateOverlap = (start: number, end: number) => {
                return Math.max(0, Math.min(end, endMinutes) - Math.max(start, startMinutes));
              };

              const morningMinutes = calculateOverlap(MORNING_START, AFTERNOON_START);
              const afternoonMinutes = calculateOverlap(AFTERNOON_START, EVENING_START);
              const eveningMinutes = calculateOverlap(EVENING_START, DAY_END) + 
                                   calculateOverlap(0, MORNING_START);

              // Déterminer la période avec le plus de temps
              let period: 'M' | 'AM' | 'S';
              if (eveningMinutes >= morningMinutes && eveningMinutes >= afternoonMinutes) {
                period = 'S';
              } else if (afternoonMinutes >= morningMinutes) {
                period = 'AM';
              } else {
                period = 'M';
              }

              // Créer la clé unique pour cette affectation
              const formattedDate = format(date, 'yyyy-MM-dd');
              const key = `${formattedDate}-${period}`;
              
              assignments[key] = {
                type: period,
                date: formattedDate,
                timeSlot,
                shiftType
              };
            } catch (err) {
              throw new Error(`Erreur à la ligne ${i + 1}: ${err.message}`);
            }
          }
          
          resolve(assignments);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      
      // Lire le fichier avec l'encodage Windows-1252 qui gère mieux les caractères spéciaux français
      reader.readAsText(file, 'windows-1252');
    });
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    
    setIsProcessing(true);
    setError(null);
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Vérifier le type de fichier
      if (file.type !== 'text/csv') {
        errors.push(`${file.name} : Format de fichier invalide`);
        continue;
      }
      
      try {
        const assignments = await parseCSVFile(file);
        const planning: GeneratedPlanning = {
          assignments,
          uploadedAt: new Date()
        };
        
        // Extraire l'identifiant de l'utilisateur du nom du fichier
        const fileName = file.name.toUpperCase();
        const user = users.find(u => fileName.includes(u.lastName.toUpperCase()));
        
        if (!user) {
          errors.push(`${file.name} : Utilisateur non trouvé. Le nom du fichier doit contenir le NOM de l'utilisateur (ex: DUPONT.csv)`);
          continue;
        }
        
        // Sauvegarder dans Firebase
        await saveGeneratedPlanning(user.id, planning);
        
        // Mettre à jour l'état local
        setUploadedPlannings(prev => ({
          ...prev,
          [user.id]: planning
        }));
      } catch (err) {
        errors.push(`${file.name} : ${err.message}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setToast({
        visible: true,
        message: 'Plannings importés avec succès',
        type: 'success'
      });
    }
    
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [users]);

  const handleDeletePlanning = async () => {
    if (!planningToDelete) return;
    
    try {
      await deletePlanning(planningToDelete);
      
      // Mettre à jour l'état local
      setUploadedPlannings(prev => {
        const newState = { ...prev };
        delete newState[planningToDelete];
        return newState;
      });
      
      setToast({
        visible: true,
        message: 'Planning supprimé avec succès',
        type: 'success'
      });
      setPlanningToDelete(null);
    } catch (error) {
      setToast({
        visible: true,
        message: 'Erreur lors de la suppression du planning',
        type: 'error'
      });
      setPlanningToDelete(null);
    }
  };

  const handleCompleteReset = async () => {
    try {
      setIsResetting(true);
      const batch = writeBatch(db);
      
      // 1. Supprimer tous les plannings générés
      const planningsSnapshot = await getDocs(collection(db, 'generated_plannings'));
      for (const planningDoc of planningsSnapshot.docs) {
        batch.delete(planningDoc.ref);
      }
      
      // 2. Supprimer tous les échanges en cours
      const exchangesSnapshot = await getDocs(collection(db, 'shift_exchanges'));
      for (const exchangeDoc of exchangesSnapshot.docs) {
        batch.delete(exchangeDoc.ref);
      }
      
      // 3. Supprimer tout l'historique des échanges
      const historySnapshot = await getDocs(collection(db, 'exchange_history'));
      for (const historyDoc of historySnapshot.docs) {
        batch.delete(historyDoc.ref);
      }
      
      // 4. Exécuter toutes les opérations en une seule transaction
      await batch.commit();
      
      // 5. Mettre à jour l'état local
      setUploadedPlannings({});
      setSelectedUserId('');
      
      setToast({
        visible: true,
        message: 'Réinitialisation complète effectuée avec succès',
        type: 'success'
      });
      
      setShowResetConfirmation(false);
    } catch (error) {
      console.error('Error performing complete reset:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la réinitialisation',
        type: 'error'
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      // Filtrer les utilisateurs qui ont un planning
      const usersWithPlannings = users.filter(user => {
        const planning = uploadedPlannings[user.id];
        return planning && Object.keys(planning.assignments).length > 0;
      });

      if (usersWithPlannings.length === 0) {
        setToast({
          visible: true,
          message: 'Aucun planning à exporter',
          type: 'error'
        });
        return;
      }

      // Créer la map des plannings
      const planningsMap = Object.fromEntries(
        usersWithPlannings.map(user => [
          user.id,
          uploadedPlannings[user.id].assignments
        ])
      );
      
      await exportAllGeneratedPlanningsToPDFZip(
        usersWithPlannings,
        planningsMap,
        config.startDate,
        config.endDate
      );
      setPlanningToDelete(null);
    } catch (error) {
      console.error('Error downloading all PDFs:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du téléchargement des PDFs',
        type: 'error'
      });
      setPlanningToDelete(null);
    }
  };

  const handleDownloadAllCSV = async () => {
    try {
      // Filtrer les utilisateurs qui ont un planning
      const usersWithPlannings = users.filter(user => {
        const planning = uploadedPlannings[user.id];
        return planning && Object.keys(planning.assignments).length > 0;
      });

      if (usersWithPlannings.length === 0) {
        setToast({
          visible: true,
          message: 'Aucun planning à exporter',
          type: 'error'
        });
        return;
      }

      // Créer la map des plannings
      const planningsMap = Object.fromEntries(
        usersWithPlannings.map(user => [
          user.id,
          uploadedPlannings[user.id].assignments
        ])
      );
      
      await exportAllGeneratedPlanningsToCSVZip(
        usersWithPlannings,
        planningsMap,
        config.startDate
      );
      setPlanningToDelete(null);
    } catch (error) {
      console.error('Error downloading all CSVs:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du téléchargement des CSVs',
        type: 'error'
      });
      setPlanningToDelete(null);
    }
  };

  const usersList = users.filter(user => user.roles.isUser);

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Planning non configuré</h2>
          <p className="text-yellow-700">
            Le planning doit être configuré avant de pouvoir importer les données.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-700">{error}</p>
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
        <h1 className="text-2xl font-bold">Planning Généré</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResetConfirmation(true)}
            className="flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser Tout
          </button>
        </div>
      </div>
      
      {/* Modals de confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Supprimer le planning"
        message="Êtes-vous sûr de vouloir supprimer ce planning ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          await handleDeletePlanning();
          setShowDeleteConfirmation(false);
        }}
        onCancel={() => {
          setShowDeleteConfirmation(false);
          setPlanningToDelete(null);
        }}
      />
      
      <ConfirmationModal
        isOpen={showDeleteAllConfirmation}
        title="Supprimer tous les plannings"
        message="Êtes-vous sûr de vouloir supprimer tous les plannings ? Cette action est irréversible."
        confirmLabel="Tout supprimer"
        onConfirm={async () => {
          try {
            // Supprimer chaque planning
            for (const userId of Object.keys(uploadedPlannings)) {
              await deletePlanning(userId);
            }
            setUploadedPlannings({});
            setSelectedUserId('');
            setShowDeleteAllConfirmation(false);
          } catch (error) {
            console.error('Error deleting all plannings:', error);
          }
        }}
        onCancel={() => setShowDeleteAllConfirmation(false)}
      />

      <ConfirmationModal
        isOpen={showResetConfirmation}
        title="Réinitialiser l'application"
        message="ATTENTION ! Cette action va effacer TOUTES les données de l'application : tous les plannings générés, tous les plannings visualisés par les utilisateurs, toute la bourse aux gardes, tout l'historique des échanges. Tout sera remis à zéro. Cette action est irréversible. Êtes-vous vraiment sûr de vouloir continuer ?"
        confirmLabel={isResetting ? "Réinitialisation..." : "Réinitialiser tout"}
        onConfirm={handleCompleteReset}
        onCancel={() => setShowResetConfirmation(false)}
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('view')}
            className={`${
              activeTab === 'view'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Eye className="h-5 w-5 mr-2" />
            Visualisation des plannings
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`${
              activeTab === 'import'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <FileImport className="h-5 w-5 mr-2" />
            Importer les plannings
          </button>
        </nav>
      </div>

      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Importer des fichiers CSV</h2>
            <p className="text-sm text-gray-500 mb-4">
              Le nom de chaque fichier doit correspondre à l'identifiant de l'utilisateur (ex: DUPO.csv)
            </p>
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  multiple
                  className="sr-only"
                />
                <div className={`flex items-center justify-center px-6 py-4 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-500 cursor-pointer transition-colors ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                  <Upload className="h-6 w-6 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">
                    {isProcessing
                      ? 'Traitement en cours...'
                      : 'Cliquez pour sélectionner des fichiers CSV'
                    }
                  </span>
                </div>
              </label>
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-50 rounded-md whitespace-pre-line">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-medium text-gray-900 mb-4">État des Plannings</h2>
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière mise à jour
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usersList.map(user => {
                    const planning = uploadedPlannings[user.id];
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {user.lastName} {user.firstName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            planning 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {planning ? 'Importé' : 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                
                          {planning ? (
                            planning.uploadedAt instanceof Date ? 
                              format(planning.uploadedAt, 'dd/MM/yyyy HH:mm', { locale: fr }) :
                              '—'
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {planning && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setPlanningToDelete(user.id);
                                  setShowDeleteConfirmation(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'view' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              {Object.keys(uploadedPlannings).length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviousUser}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    title="Médecin précédent"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="block w-64 pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  >
                    {Object.entries(uploadedPlannings).map(([userId]) => {
                      const user = users.find(u => u.id === userId);
                      if (!user) return null;
                      return (
                        <option key={userId} value={userId}>
                          {user.lastName} {user.firstName}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={handleNextUser}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    title="Médecin suivant"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {Object.keys(uploadedPlannings).length > 0 && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadAllPDF}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Télécharger tous les plannings en PDF"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Tous les PDF
                    </button>
                    <button
                      onClick={handleDownloadAllCSV}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Télécharger tous les plannings en CSV"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Tous les CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Légende des couleurs */}
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span className="text-sm text-gray-600">Garde proposée à la bourse</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-sm text-gray-600">Garde reçue via la bourse</span>
            </div>
            {/* Légende des desiderata */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-sm text-gray-600">Desiderata primaire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span className="text-sm text-gray-600">Desiderata secondaire</span>
            </div>
          </div>

          {/* Toggle pour afficher/masquer les desiderata */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-600">Afficher les desiderata</span>
            <Switch
              checked={showDesiderata}
              onChange={setShowDesiderata}
              className="relative inline-flex h-6 w-11 items-center rounded-full"
            />
          </div>

          {selectedUserId && uploadedPlannings[selectedUserId] && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              {(() => {
                const user = users.find(u => u.id === selectedUserId);
                const planning = uploadedPlannings[selectedUserId];
                if (!user || !planning) return null;

                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        Planning de {user.lastName} {user.firstName}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            exportGeneratedPlanningToPDF(
                              planning.assignments,
                              `${user.lastName}_${user.firstName}`,
                              config.startDate,
                              config.endDate
                            );
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </button>
                        <button
                          onClick={() => {
                            exportGeneratedPlanningToCSV(
                              planning.assignments,
                              `${user.lastName}_${user.firstName}`
                            );
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </button>
                      </div>
                    </div>
                    <GeneratedPlanningTable
                      startDate={config.startDate}
                      endDate={config.endDate}
                      assignments={planning.assignments}
                      userId={selectedUserId}
                      receivedShifts={receivedShifts}
                      isAdminView={true}
                      showDesiderata={showDesiderata}
                      desiderata={desiderata}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratedPlanningPage;