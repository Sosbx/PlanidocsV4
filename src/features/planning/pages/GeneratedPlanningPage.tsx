import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Upload, AlertCircle, Download, ChevronLeft, ChevronRight, Trash2, RotateCcw, Calendar, Plus } from 'lucide-react';
import { Import as FileImport, Eye } from 'lucide-react';
import { parse, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, getDocs, deleteDoc, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config"; 
import { usePlanningConfig } from '../../../context/planning/PlanningContext';
import { usePlanningPeriod } from '../../../context/planning';
import { useUsers } from '../../../features/auth/hooks';
import { 
  saveGeneratedPlanning, 
  deletePlanning, 
  createPlanningPeriod,
  updatePlanningPeriod,
  deletePlanningPeriod,
  validateBagAndMergePeriods,
  exportUserPlanningHistoryToCsv
} from '../../../lib/firebase/planning';
import { ConfirmationModal } from '../../../components/modals';
import { Switch, LoadingSpinner } from '../../../components/common';
import { loadGeneratedPlanningExporters } from '../../../utils/lazyExporters';
import type { 
  ShiftAssignment, 
  GeneratedPlanning, 
  ExchangeHistory, 
  Selections,
  PlanningPeriod
} from '../../../types/planning';
import Toast from '../../../components/Toast';
import { getDesiderata } from '../../../lib/firebase/desiderata';

// Import dynamique du composant lourd
const GeneratedPlanningTable = lazy(() => import('../components/GeneratedPlanningTable'));

const GeneratedPlanningPage: React.FC = () => {
  const { config } = usePlanningConfig();
  const { users } = useUsers();
  const [activeTab, setActiveTab] = useState<'view' | 'import' | 'periods' | 'export'>('view');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // État pour les plannings et les périodes
  // Restructuration pour organiser les plannings par période
  const [uploadedPlannings, setUploadedPlannings] = useState<Record<string, Record<string, GeneratedPlanning>>>({});
  const { allPeriods, isLoading: isLoadingPeriods, refreshPeriods } = usePlanningPeriod();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [uploadPeriodId, setUploadPeriodId] = useState<string>('');
  
  // État pour la gestion des périodes
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [newPeriodStartDate, setNewPeriodStartDate] = useState<Date>(new Date());
  const [newPeriodEndDate, setNewPeriodEndDate] = useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() + 3))
  );
  const [newPeriodStatus, setNewPeriodStatus] = useState<'active' | 'future' | 'archived'>('future');
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [showDeletePeriodConfirmation, setShowDeletePeriodConfirmation] = useState<boolean>(false);
  
  // État pour l'export d'historique
  const [exportStartDate, setExportStartDate] = useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() - 3))
  );
  const [exportEndDate, setExportEndDate] = useState<Date>(new Date());
  const [exportUserId, setExportUserId] = useState<string>('');
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

  // Charger les plannings et les périodes
  useEffect(() => {
    const loadUploadedPlannings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'generated_plannings'));
        const planningsByPeriod: Record<string, Record<string, GeneratedPlanning>> = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const userId = doc.id;
          // Convertir le timestamp Firestore en Date
          const uploadedAt = data.uploadedAt?.toDate?.() || new Date(data.uploadedAt);
          const periodId = data.periodId || 'current';
          
          // Initialiser l'objet pour cette période si nécessaire
          if (!planningsByPeriod[periodId]) {
            planningsByPeriod[periodId] = {};
          }
          
          // Ajouter le planning à la période correspondante
          planningsByPeriod[periodId][userId] = {
            periodId,
            assignments: data.assignments,
            uploadedAt
          };
        });
        
        setUploadedPlannings(planningsByPeriod);

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
        
        // Sélectionner la période active par défaut pour l'upload et la visualisation
        const activePeriod = allPeriods.find(p => p.status === 'active');
        if (activePeriod) {
          setUploadPeriodId(activePeriod.id);
          setSelectedPeriodId(activePeriod.id);
        } else if (allPeriods.length > 0) {
          setUploadPeriodId(allPeriods[0].id);
          setSelectedPeriodId(allPeriods[0].id);
        }
        
        // Sélectionner le premier utilisateur pour l'export
        if (users.length > 0) {
          setExportUserId(users[0].id);
        }
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
  }, [allPeriods, users]);

  // Sélectionner automatiquement le premier utilisateur avec un planning
  useEffect(() => {
    if (!selectedPeriodId || !uploadedPlannings[selectedPeriodId]) return;
    
    const usersWithPlannings = Object.keys(uploadedPlannings[selectedPeriodId]);
    if (usersWithPlannings.length > 0 && !selectedUserId) {
      setSelectedUserId(usersWithPlannings[0]);
    }
  }, [uploadedPlannings, selectedPeriodId, selectedUserId]);

  const handlePreviousUser = () => {
    if (!selectedPeriodId || !uploadedPlannings[selectedPeriodId]) return;
    
    const usersWithPlannings = Object.keys(uploadedPlannings[selectedPeriodId]);
    const currentIndex = usersWithPlannings.indexOf(selectedUserId);
    if (currentIndex > 0) {
      setSelectedUserId(usersWithPlannings[currentIndex - 1]);
    } else {
      setSelectedUserId(usersWithPlannings[usersWithPlannings.length - 1]);
    }
  };

  const handleNextUser = () => {
    if (!selectedPeriodId || !uploadedPlannings[selectedPeriodId]) return;
    
    const usersWithPlannings = Object.keys(uploadedPlannings[selectedPeriodId]);
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
          
          // Détecter automatiquement le séparateur (virgule ou point-virgule)
          const firstLine = lines[0];
          const separator = firstLine.includes(';') ? ';' : ',';
          
          console.log(`Séparateur détecté: "${separator}"`);
          
          // Récupérer les en-têtes originaux
          const originalHeaders = firstLine.split(separator).map(h => h.trim());
          
          // Afficher les en-têtes pour le débogage
          console.log('En-têtes originaux:', originalHeaders);
          
          // Vérifier la présence des en-têtes requis
          const requiredHeaders = ['Date', 'Créneau', 'Type'];
          
          // Normaliser les en-têtes pour gérer les variations d'encodage et de casse
          const normalizedHeaders = originalHeaders.map(h => {
            const normalized = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            // Normaliser les variantes de "Créneau"
            if (normalized === 'Creneau' || 
                h === 'CrÃ©neau' || 
                h === 'Créneau' || 
                h.toLowerCase() === 'creneau' || 
                h.toLowerCase() === 'créneau') {
              return 'Créneau';
            }
            
            // Normaliser Date et Type (insensible à la casse)
            if (normalized.toLowerCase() === 'date') {
              return 'Date';
            }
            if (normalized.toLowerCase() === 'type') {
              return 'Type';
            }
            
            return h;
          });
          
          console.log('En-têtes normalisés:', normalizedHeaders);
          
          const missingHeaders = requiredHeaders.filter(required => 
            !normalizedHeaders.some(h => h === required)
          );
          
          if (missingHeaders.length > 0) {
            throw new Error(
              `Format de fichier CSV invalide. L'en-tête doit contenir : Date, Créneau, Type.\n` +
              `En-têtes trouvés : ${originalHeaders.join(', ')}\n` +
              `En-têtes manquants : ${missingHeaders.join(', ')}`
            );
          }
          
          // Trouver les indices des colonnes requises
          const dateIndex = normalizedHeaders.findIndex(h => h === 'Date');
          const creneauIndex = normalizedHeaders.findIndex(h => h === 'Créneau');
          const typeIndex = normalizedHeaders.findIndex(h => h === 'Type');

          // Parser les lignes
          const assignments: Record<string, ShiftAssignment> = {};
          
          for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(separator).map(field => field.trim());
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
            } catch (err: any) {
              throw new Error(`Erreur à la ligne ${i + 1}: ${err.message}`);
            }
          }
          
          resolve(assignments);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      
      // Essayer différents encodages si nécessaire
      try {
        // D'abord essayer UTF-8
        reader.readAsText(file, 'UTF-8');
      } catch (error) {
        console.warn("Échec de lecture en UTF-8, tentative avec Windows-1252", error);
        // Si UTF-8 échoue, essayer Windows-1252
        reader.readAsText(file, 'windows-1252');
      }
    });
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !uploadPeriodId) {
      if (!uploadPeriodId) {
        setToast({
          visible: true,
          message: 'Veuillez sélectionner une période pour l\'import',
          type: 'error'
        });
      }
      return;
    }
    
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
          periodId: uploadPeriodId,
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
        
        // Sauvegarder dans Firebase avec la période sélectionnée
        await saveGeneratedPlanning(user.id, planning, uploadPeriodId);
        
        // Mettre à jour l'état local
        setUploadedPlannings(prev => {
          const newState = { ...prev };
          
          // Initialiser l'objet pour cette période si nécessaire
          if (!newState[uploadPeriodId]) {
            newState[uploadPeriodId] = {};
          }
          
          // Ajouter le planning à la période correspondante
          newState[uploadPeriodId][user.id] = planning;
          
          return newState;
        });
      } catch (err: any) {
        errors.push(`${file.name} : ${err instanceof Error ? err.message : String(err)}`);
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
  }, [users, uploadPeriodId]);
  
  // Fonction pour créer une nouvelle période
  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Déterminer automatiquement le statut en fonction des dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Déterminer le statut automatiquement
      let autoStatus: 'active' | 'future' | 'archived';
      if (newPeriodEndDate < today) {
        // Si la période est entièrement dans le passé
        autoStatus = 'archived';
      } else if (newPeriodStartDate > today) {
        // Si la période est entièrement dans le futur
        autoStatus = 'future';
      } else {
        // Si la période contient la date d'aujourd'hui
        autoStatus = 'active';
      }
      
      // Utiliser le statut déterminé automatiquement ou celui sélectionné par l'utilisateur
      const finalStatus = newPeriodStatus || autoStatus;
      
      // Déterminer la phase BAG en fonction du statut
      let bagPhase: 'submission' | 'distribution' | 'completed';
      if (finalStatus === 'future') {
        bagPhase = 'submission';
      } else {
        bagPhase = 'completed';
      }
      
      // Déterminer si la période est validée en fonction du statut
      const isValidated = finalStatus === 'archived';
      
      const newPeriod: Omit<PlanningPeriod, 'id'> = {
        name: newPeriodName,
        startDate: newPeriodStartDate,
        endDate: newPeriodEndDate,
        status: finalStatus,
        bagPhase: bagPhase, // Jamais undefined
        isValidated: isValidated
      };
      
      // Créer la période dans Firebase
      const periodId = await createPlanningPeriod(newPeriod);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      // Réinitialiser le formulaire
      setNewPeriodName('');
      setNewPeriodStartDate(new Date());
      setNewPeriodEndDate(new Date(new Date().setMonth(new Date().getMonth() + 3)));
      
      setToast({
        visible: true,
        message: 'Période ajoutée avec succès',
        type: 'success'
      });
      
      // Sélectionner la nouvelle période pour l'upload
      setUploadPeriodId(periodId);
    } catch (error) {
      console.error('Error adding period:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'ajout de la période',
        type: 'error'
      });
    }
  };
  
  // Fonction pour supprimer une période
  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    
    try {
      await deletePlanningPeriod(periodToDelete);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      setToast({
        visible: true,
        message: 'Période supprimée avec succès',
        type: 'success'
      });
      
      setPeriodToDelete(null);
      setShowDeletePeriodConfirmation(false);
    } catch (error) {
      console.error('Error deleting period:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la suppression de la période',
        type: 'error'
      });
    }
  };
  
  // Fonction pour valider la BAG et fusionner les périodes
  const handleValidateBag = async (periodId: string) => {
    try {
      await validateBagAndMergePeriods(periodId);
      
      // Rafraîchir les périodes
      await refreshPeriods();
      
      setToast({
        visible: true,
        message: 'BAG validée et périodes fusionnées avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error validating BAG:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de la validation de la BAG',
        type: 'error'
      });
    }
  };
  
  // Fonction pour exporter l'historique de planning d'un utilisateur
  const handleExportUserHistory = async () => {
    if (!exportUserId) {
      setToast({
        visible: true,
        message: 'Veuillez sélectionner un utilisateur',
        type: 'error'
      });
      return;
    }
    
    try {
      setToast({
        visible: true,
        message: 'Préparation de l\'export CSV...',
        type: 'success'
      });
      
      // Exporter l'historique
      const csvContent = await exportUserPlanningHistoryToCsv(
        exportUserId,
        exportStartDate,
        exportEndDate
      );
      
      // Créer un blob et un lien de téléchargement
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Trouver l'utilisateur pour le nom du fichier
      const user = users.find(u => u.id === exportUserId);
      const fileName = user 
        ? `historique_${user.lastName}_${user.firstName}_${format(exportStartDate, 'yyyy-MM-dd')}_${format(exportEndDate, 'yyyy-MM-dd')}.csv`
        : `historique_${format(exportStartDate, 'yyyy-MM-dd')}_${format(exportEndDate, 'yyyy-MM-dd')}.csv`;
      
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({
        visible: true,
        message: 'Export CSV réussi',
        type: 'success'
      });
    } catch (error) {
      console.error('Error exporting user history:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'export CSV',
        type: 'error'
      });
    }
  };

  const handleDeletePlanning = async () => {
    if (!planningToDelete || !selectedPeriodId) return;
    
    try {
      // Supprimer le planning dans Firebase
      await deletePlanning(planningToDelete);
      
      // Mettre à jour l'état local
      setUploadedPlannings(prev => {
        const newState = { ...prev };
        
        // Vérifier si la période existe
        if (newState[selectedPeriodId]) {
          // Supprimer le planning de l'utilisateur dans cette période
          const newPeriodState = { ...newState[selectedPeriodId] };
          delete newPeriodState[planningToDelete];
          newState[selectedPeriodId] = newPeriodState;
        }
        
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
      if (!selectedPeriodId || !uploadedPlannings[selectedPeriodId]) {
        setToast({
          visible: true,
          message: 'Aucune période sélectionnée ou aucun planning disponible pour cette période',
          type: 'error'
        });
        return;
      }
      
      setToast({
        visible: true,
        message: 'Préparation de l\'export PDF...',
        type: 'success'
      });
      
      const planningsForPeriod = uploadedPlannings[selectedPeriodId];
      
      // Filtrer les utilisateurs qui ont un planning dans cette période
      const usersWithPlannings = users.filter(user => 
        planningsForPeriod[user.id] && 
        Object.keys(planningsForPeriod[user.id].assignments).length > 0
      );

      if (usersWithPlannings.length === 0) {
        setToast({
          visible: true,
          message: 'Aucun planning à exporter pour cette période',
          type: 'error'
        });
        return;
      }

      // Créer la map des plannings
      const planningsMap = Object.fromEntries(
        usersWithPlannings.map(user => [
          user.id,
          planningsForPeriod[user.id].assignments
        ])
      );
      
      // Chargement dynamique des exporteurs
      const exporters = await loadGeneratedPlanningExporters();
      
      await exporters.allToPdf(
        usersWithPlannings,
        planningsMap,
        config.startDate,
        config.endDate
      );
      
      setToast({
        visible: true,
        message: 'Export PDF réussi',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading all PDFs:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du téléchargement des PDFs',
        type: 'error'
      });
    }
  };

  const handleDownloadAllCSV = async () => {
    try {
      if (!selectedPeriodId || !uploadedPlannings[selectedPeriodId]) {
        setToast({
          visible: true,
          message: 'Aucune période sélectionnée ou aucun planning disponible pour cette période',
          type: 'error'
        });
        return;
      }
      
      setToast({
        visible: true,
        message: 'Préparation de l\'export CSV...',
        type: 'success'
      });
      
      const planningsForPeriod = uploadedPlannings[selectedPeriodId];
      
      // Filtrer les utilisateurs qui ont un planning dans cette période
      const usersWithPlannings = users.filter(user => 
        planningsForPeriod[user.id] && 
        Object.keys(planningsForPeriod[user.id].assignments).length > 0
      );

      if (usersWithPlannings.length === 0) {
        setToast({
          visible: true,
          message: 'Aucun planning à exporter pour cette période',
          type: 'error'
        });
        return;
      }

      // Créer la map des plannings
      const planningsMap = Object.fromEntries(
        usersWithPlannings.map(user => [
          user.id,
          planningsForPeriod[user.id].assignments
        ])
      );
      
      // Chargement dynamique des exporteurs
      const exporters = await loadGeneratedPlanningExporters();
      
      await exporters.allToCsv(
        usersWithPlannings,
        planningsMap,
        config.startDate
      );
      
      setToast({
        visible: true,
        message: 'Export CSV réussi',
        type: 'success'
      });
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
            // Supprimer chaque planning pour chaque période
            for (const periodId of Object.keys(uploadedPlannings)) {
              const planningsForPeriod = uploadedPlannings[periodId];
              for (const userId of Object.keys(planningsForPeriod)) {
                await deletePlanning(userId);
              }
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
      
      <ConfirmationModal
        isOpen={showDeletePeriodConfirmation}
        title="Supprimer la période"
        message="Êtes-vous sûr de vouloir supprimer cette période ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDeletePeriod}
        onCancel={() => {
          setShowDeletePeriodConfirmation(false);
          setPeriodToDelete(null);
        }}
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
          <button
            onClick={() => setActiveTab('periods')}
            className={`${
              activeTab === 'periods'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Calendar className="h-5 w-5 mr-2" />
            Gestion des périodes
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Download className="h-5 w-5 mr-2" />
            Export d'historique
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
            
            {/* Sélecteur de période pour l'import */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période pour l'import
              </label>
              <select
                value={uploadPeriodId}
                onChange={(e) => setUploadPeriodId(e.target.value)}
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              >
                <option value="">Sélectionner une période</option>
                {allPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({format(period.startDate, 'dd/MM/yyyy', { locale: fr })} - {format(period.endDate, 'dd/MM/yyyy', { locale: fr })})
                    {period.status === 'active' ? ' (Actuelle)' : period.status === 'future' ? ' (Future)' : ' (Archivée)'}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  multiple
                  className="sr-only"
                  disabled={!uploadPeriodId}
                />
                <div className={`flex items-center justify-center px-6 py-4 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-500 cursor-pointer transition-colors ${
                  isProcessing || !uploadPeriodId ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                  <Upload className="h-6 w-6 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">
                    {isProcessing
                      ? 'Traitement en cours...'
                      : !uploadPeriodId
                      ? 'Veuillez sélectionner une période'
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
                    // Vérifier si l'utilisateur a un planning dans la période sélectionnée
                    const planning = uploadPeriodId && uploadedPlannings[uploadPeriodId] ? 
                      uploadedPlannings[uploadPeriodId][user.id] : undefined;
                    
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
                                  setSelectedPeriodId(uploadPeriodId); // S'assurer que la période sélectionnée est celle de l'import
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

      {activeTab === 'periods' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Gestion des périodes de planning</h2>
            <p className="text-sm text-gray-500 mb-4">
              Créez et gérez les périodes de planning. Les périodes permettent d'organiser les plannings dans le temps et de gérer les phases de la bourse aux gardes.
            </p>
            
            {/* Formulaire d'ajout de période */}
            <form onSubmit={handleAddPeriod} className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-md font-medium text-gray-800 mb-3">Ajouter une nouvelle période</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la période
                  </label>
                  <input
                    type="text"
                    value={newPeriodName}
                    onChange={(e) => setNewPeriodName(e.target.value)}
                    className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                    placeholder="Ex: Été 2025"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={newPeriodStatus}
                    onChange={(e) => setNewPeriodStatus(e.target.value as 'active' | 'future' | 'archived')}
                    className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  >
                    <option value="future">Future</option>
                    <option value="active">Active</option>
                    <option value="archived">Archivée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={format(newPeriodStartDate, 'yyyy-MM-dd')}
                    onChange={(e) => setNewPeriodStartDate(new Date(e.target.value))}
                    className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={format(newPeriodEndDate, 'yyyy-MM-dd')}
                    onChange={(e) => setNewPeriodEndDate(new Date(e.target.value))}
                    className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la période
                </button>
              </div>
            </form>
            
            {/* Liste des périodes */}
            <div className="overflow-hidden border border-gray-200 rounded-lg">
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
                      Phase BAG
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingPeriods ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-center">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : allPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-center text-gray-500">
                        Aucune période définie
                      </td>
                    </tr>
                  ) : (
                    allPeriods.map((period) => (
                      <tr key={period.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {period.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {format(period.startDate, 'dd/MM/yyyy', { locale: fr })} - {format(period.endDate, 'dd/MM/yyyy', { locale: fr })}
                          </div>
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
                                : period.bagPhase === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}>
                            {period.bagPhase === 'submission' 
                              ? 'Soumission' 
                              : period.bagPhase === 'distribution'
                                ? 'Distribution'
                                : period.bagPhase === 'completed'
                                  ? 'Terminée'
                                  : 'Non définie'
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            {period.status === 'future' && (
                              <button
                                onClick={() => handleValidateBag(period.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                Valider BAG
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setPeriodToDelete(period.id);
                                setShowDeletePeriodConfirmation(true);
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Supprimer
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
        </div>
      )}
      
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Export d'historique de planning</h2>
            <p className="text-sm text-gray-500 mb-4">
              Exportez l'historique de planning d'un utilisateur sur une période donnée. L'export inclut toutes les gardes, y compris les gardes archivées.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Utilisateur
                </label>
                <select
                  value={exportUserId}
                  onChange={(e) => setExportUserId(e.target.value)}
                  className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {usersList.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.lastName} {user.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={format(exportStartDate, 'yyyy-MM-dd')}
                  onChange={(e) => setExportStartDate(new Date(e.target.value))}
                  className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={format(exportEndDate, 'yyyy-MM-dd')}
                  onChange={(e) => setExportEndDate(new Date(e.target.value))}
                  className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleExportUserHistory}
                disabled={!exportUserId}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  exportUserId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter en CSV
              </button>
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
                    {selectedPeriodId && uploadedPlannings[selectedPeriodId] ? 
                      Object.keys(uploadedPlannings[selectedPeriodId]).map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <option key={userId} value={userId}>
                            {user.lastName} {user.firstName}
                          </option>
                        );
                      })
                    : <option value="">Aucun utilisateur disponible</option>}
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

          {selectedPeriodId && selectedUserId && 
           uploadedPlannings[selectedPeriodId] && 
           uploadedPlannings[selectedPeriodId][selectedUserId] && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              {(() => {
                const user = users.find(u => u.id === selectedUserId);
                const planning = uploadedPlannings[selectedPeriodId][selectedUserId];
                if (!user || !planning) return null;

                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        Planning de {user.lastName} {user.firstName} - {allPeriods.find(p => p.id === selectedPeriodId)?.name || 'Période inconnue'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              setToast({
                                visible: true,
                                message: 'Préparation de l\'export PDF...',
                                type: 'success'
                              });
                              
                              // Chargement dynamique des exporteurs
                              const exporters = await loadGeneratedPlanningExporters();
                              
                              await exporters.toPdf(
                                planning.assignments,
                                `${user.lastName}_${user.firstName}`,
                                config.startDate,
                                config.endDate
                              );
                              
                              setToast({
                                visible: true,
                                message: 'Export PDF réussi',
                                type: 'success'
                              });
                            } catch (error) {
                              console.error('Error exporting to PDF:', error);
                              setToast({
                                visible: true,
                                message: 'Erreur lors de l\'export PDF',
                                type: 'error'
                              });
                            }
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              setToast({
                                visible: true,
                                message: 'Préparation de l\'export CSV...',
                                type: 'success'
                              });
                              
                              // Chargement dynamique des exporteurs
                              const exporters = await loadGeneratedPlanningExporters();
                              
                              await exporters.toCsv(
                                planning.assignments,
                                `${user.lastName}_${user.firstName}`
                              );
                              
                              setToast({
                                visible: true,
                                message: 'Export CSV réussi',
                                type: 'success'
                              });
                            } catch (error) {
                              console.error('Error exporting to CSV:', error);
                              setToast({
                                visible: true,
                                message: 'Erreur lors de l\'export CSV',
                                type: 'error'
                              });
                            }
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </button>
                      </div>
                    </div>
                    <Suspense fallback={
                      <div className="flex justify-center items-center py-20">
                        <LoadingSpinner />
                        <span className="ml-2 text-sm text-gray-500">Chargement du planning...</span>
                      </div>
                    }>
                <GeneratedPlanningTable
                  startDate={(() => {
                    // Utiliser les dates de la période sélectionnée si disponible
                    const selectedPeriod = allPeriods.find(p => p.id === selectedPeriodId);
                    if (selectedPeriod) {
                      // Ajouter une marge de 15 jours avant pour une meilleure visualisation
                      const startDate = new Date(selectedPeriod.startDate);
                      startDate.setDate(startDate.getDate() - 15);
                      console.log(`Gestion Planning - Date de début calculée: ${startDate.toISOString()}`);
                      return startDate;
                    }
                    
                    // Si aucune période n'est sélectionnée, calculer les dates à partir des assignments
                    if (planning && planning.assignments) {
                      const dates: Date[] = [];
                      
                      // Extraire les dates des assignments
                      Object.keys(planning.assignments).forEach(key => {
                        const [dateStr] = key.split('-');
                        try {
                          const date = new Date(dateStr);
                          if (!isNaN(date.getTime())) {
                            dates.push(date);
                          }
                        } catch (error) {
                          console.error(`Erreur lors de la conversion de la date ${dateStr}:`, error);
                        }
                      });
                      
                      if (dates.length > 0) {
                        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                        minDate.setDate(minDate.getDate() - 15);
                        console.log(`Gestion Planning - Date de début calculée depuis assignments: ${minDate.toISOString()}`);
                        return minDate;
                      }
                    }
                    
                    console.log(`Gestion Planning - Utilisation de la date de début par défaut: ${config.startDate.toISOString()}`);
                    return config.startDate;
                  })()}
                  endDate={(() => {
                    // Utiliser les dates de la période sélectionnée si disponible
                    const selectedPeriod = allPeriods.find(p => p.id === selectedPeriodId);
                    if (selectedPeriod) {
                      // Ajouter une marge de 15 jours après pour une meilleure visualisation
                      const endDate = new Date(selectedPeriod.endDate);
                      endDate.setDate(endDate.getDate() + 15);
                      console.log(`Gestion Planning - Date de fin calculée: ${endDate.toISOString()}`);
                      return endDate;
                    }
                    
                    // Si aucune période n'est sélectionnée, calculer les dates à partir des assignments
                    if (planning && planning.assignments) {
                      const dates: Date[] = [];
                      
                      // Extraire les dates des assignments
                      Object.keys(planning.assignments).forEach(key => {
                        const [dateStr] = key.split('-');
                        try {
                          const date = new Date(dateStr);
                          if (!isNaN(date.getTime())) {
                            dates.push(date);
                          }
                        } catch (error) {
                          console.error(`Erreur lors de la conversion de la date ${dateStr}:`, error);
                        }
                      });
                      
                      if (dates.length > 0) {
                        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                        maxDate.setDate(maxDate.getDate() + 15);
                        console.log(`Gestion Planning - Date de fin calculée depuis assignments: ${maxDate.toISOString()}`);
                        return maxDate;
                      }
                    }
                    
                    console.log(`Gestion Planning - Utilisation de la date de fin par défaut: ${config.endDate.toISOString()}`);
                    return config.endDate;
                  })()}
                  assignments={planning.assignments}
                  userId={selectedUserId}
                  receivedShifts={receivedShifts}
                  isAdminView={true}
                  showDesiderata={showDesiderata}
                  desiderata={desiderata}
                />
                    </Suspense>
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
