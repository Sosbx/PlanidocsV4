import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Calendar, Download, HelpCircle, X, Mail, Grid, Settings, FileSpreadsheet, Import, CheckCircle2 } from 'lucide-react';
import { ChevronDown, FileText, Columns, LayoutList } from 'lucide-react';
import { useAuth } from '../../../features/auth/hooks';
import { doc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { useBagPhase } from "../../../features/shiftExchange/hooks";
import { usePlanningPeriod } from "../../../context/planning";
import { Switch } from "../../../components/common";
import { Info, Clock, AlertTriangle } from 'lucide-react';
import { db } from "../../../lib/firebase/config";
import { getTimeRemaining } from "../../../utils/timeUtils";
import { usePlanningConfig } from "../../../context/planning/PlanningContext";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import PlanningTutorial from "../components/PlanningTutorial";
import { format } from 'date-fns';
import type { GeneratedPlanning, ExchangeHistory, ShiftAssignment } from "../types";
import Toast from "../../../components/Toast";
import { getAllDesiderata } from "../../../lib/firebase/desiderata";
import { useAssociation } from "../../../context/association/AssociationContext";

// Importation dynamique des fonctions d'export volumineuses
import { 
  loadPdfExporter, 
  loadCsvExporter, 
  loadIcsExporter 
} from "../../../utils/lazyExporters";

// Importation dynamique du composant table de planning
const GeneratedPlanningTable = lazy(() => import('../components/GeneratedPlanningTable'));

const UserPlanningPage: React.FC = () => {
  const { user } = useAuth();
  const { config } = usePlanningConfig();
  const { config: bagPhaseConfig } = useBagPhase();
  const { allPeriods } = usePlanningPeriod();
  const { currentAssociation } = useAssociation();
  const [planning, setPlanning] = useState<GeneratedPlanning | null>(null);
  const [planningsByPeriod, setPlanningsByPeriod] = useState<Record<string, GeneratedPlanning>>({});
  const todayRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDesiderata, setShowDesiderata] = useState(false);
  
  // Log pour suivre les changements de showDesiderata
  useEffect(() => {
    console.log("UserPlanningPage: showDesiderata a changé:", showDesiderata);
  }, [showDesiderata]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [desiderata, setDesiderata] = useState<Record<string, 'primary' | 'secondary' | null>>({});
  const [desiderataForDisplay, setDesiderataForDisplay] = useState<Record<string, { type: 'primary' | 'secondary' | null }>>({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'multiColumn' | 'singleColumn'>('multiColumn');
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(bagPhaseConfig.submissionDeadline));
  const [showPastDates, setShowPastDates] = useState<boolean>(true);
  const [loadedMonths, setLoadedMonths] = useState<number>(0);
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});

  // Charger les desiderata pour l'export et l'affichage (incluant les desiderata archivés)
  useEffect(() => {
    if (!user) return;
    const loadDesiderata = async () => {
      try {
        console.log(`UserPlanningPage: Chargement des désiderata pour l'utilisateur ${user.id} de l'association ${currentAssociation}`);
        
        // Récupérer d'abord uniquement les désiderata actifs pour les examiner
        const activeData = await getAllDesiderata(user.id, false, false, currentAssociation);
        console.log("UserPlanningPage: Désiderata actifs récupérés:", 
                    activeData?.selections ? Object.keys(activeData.selections).length : 0);
        
        if (activeData?.selections && Object.keys(activeData.selections).length > 0) {
          const firstKey = Object.keys(activeData.selections)[0];
          console.log("UserPlanningPage: Exemple de désiderata actif:", 
                      firstKey, activeData.selections[firstKey]);
          console.log("UserPlanningPage: Type du premier désiderata actif:", 
                      typeof activeData.selections[firstKey]);
        }
        
        // Inclure les desiderata archivés pour l'affichage complet
        const data = await getAllDesiderata(user.id, true, false, currentAssociation);
        console.log("UserPlanningPage: Total des désiderata (actifs + archivés):", 
                    data?.selections ? Object.keys(data.selections).length : 0);
        
        if (data?.selections) {
          // Convertir les données de type Selections en Record<string, 'primary' | 'secondary' | null>
          // pour l'export PDF
          const simplifiedDesiderata: Record<string, 'primary' | 'secondary' | null> = {};
          
          // Format attendu par GeneratedPlanningTable
          const formattedDesiderata: Record<string, { type: 'primary' | 'secondary' | null }> = {};
          
          Object.entries(data.selections).forEach(([key, value]) => {
            // Vérifier le format de chaque désiderata
            console.log(`UserPlanningPage: Traitement du désiderata ${key}:`, value);
            
            if (value && typeof value === 'object' && 'type' in value) {
              // Si c'est déjà un objet avec une propriété type
              simplifiedDesiderata[key] = value.type;
              formattedDesiderata[key] = { type: value.type };
              console.log(`UserPlanningPage: Désiderata ${key} déjà au bon format:`, value.type);
            } else if (value === 'primary' || value === 'secondary' || value === null) {
              // Si c'est directement une chaîne 'primary' ou 'secondary'
              simplifiedDesiderata[key] = value;
              formattedDesiderata[key] = { type: value };
              console.log(`UserPlanningPage: Désiderata ${key} converti de chaîne:`, value);
            } else {
              // Format inconnu
              console.warn(`UserPlanningPage: Format inconnu pour le désiderata ${key}:`, value);
              simplifiedDesiderata[key] = null;
              formattedDesiderata[key] = { type: null };
            }
          });
          
          // Vérifier les désiderata de septembre-octobre 2025
          const septOctDesiderata = Object.keys(formattedDesiderata).filter(key => 
            key.startsWith('2025-09') || key.startsWith('2025-10')
          );
          console.log("UserPlanningPage: Désiderata de sept-oct 2025 après transformation:", 
                      septOctDesiderata.length, septOctDesiderata);
          
          if (septOctDesiderata.length > 0) {
            // Vérifier le format d'un exemple
            const exampleKey = septOctDesiderata[0];
            console.log(`UserPlanningPage: Exemple de désiderata sept-oct après transformation:`, 
                        exampleKey, formattedDesiderata[exampleKey]);
          }
          
          setDesiderata(simplifiedDesiderata);
          setDesiderataForDisplay(formattedDesiderata);
        }
      } catch (error) {
        console.error('Error loading desiderata:', error);
      }
    };
    loadDesiderata();
  }, [user, currentAssociation]); // Ajouter currentAssociation comme dépendance pour recharger les desiderata quand l'association change
  
  // Update timeLeft every second during submission phase
  useEffect(() => {
    if (bagPhaseConfig.phase !== 'submission') return;

    const timer = setInterval(() => {
      const remaining = getTimeRemaining(bagPhaseConfig.submissionDeadline);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [bagPhaseConfig.submissionDeadline, bagPhaseConfig.phase]);
  
  // Effect pour détecter la taille de l'écran et définir le mode d'affichage automatiquement
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      setViewMode(isSmallScreen ? 'singleColumn' : 'multiColumn');
    };
    
    // Vérifier la taille initiale
    checkScreenSize();
    
    // Ajouter un listener pour les changements de taille d'écran
    window.addEventListener('resize', checkScreenSize);
    
    // Nettoyer le listener au démontage
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleExportCSV = async () => {
    if (!planning || !user) {
      setToast({
        visible: true,
        message: 'Aucun planning disponible à exporter',
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
      
      // Charger dynamiquement l'exporteur CSV
      const exportPlanningToGoogleCalendarCSV = await loadCsvExporter();
      
      // Utiliser les assignments du planning actuel
      exportPlanningToGoogleCalendarCSV(
        planning.assignments,
        `${user.lastName}_${user.firstName}`
      );
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({
        visible: true,
        message: 'Erreur lors de l\'export du planning',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    if (!user) return;

    // Charger l'historique des échanges pour identifier les gardes reçues
    const loadExchangeHistory = async () => {
      try {
        // Utiliser une requête avec where pour filtrer directement les échanges pertinents
        const historyQuery = query(
          collection(db, 'exchange_history'),
          where('status', '==', 'completed')
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const receivedShiftsData: Record<string, { 
          originalUserId: string; 
          newUserId: string; 
          isPermutation: boolean;
          shiftType: string;
          timeSlot: string;
        }> = {};

        historySnapshot.docs.forEach(doc => {
          const history = doc.data() as ExchangeHistory;
          
          // Ne prendre en compte que les échanges complétés (non annulés) et où cet utilisateur est impliqué
          if (history.status === 'completed' && 
              (history.originalUserId === user.id || history.newUserId === user.id)) {
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
      } catch (error) {
        console.error('Error loading exchange history:', error);
      }
    };

    // Charger tous les plannings de l'utilisateur en temps réel
    const unsubscribe = onSnapshot(
      doc(db, 'generated_plannings', user.id),
      (doc) => {
        setLoading(false);
        if (doc.exists()) {
          const data = doc.data() as any; // Utiliser any temporairement pour éviter les erreurs de type
          console.log("Données reçues de Firebase:", data);
          
          // Vérifier si les données sont au nouveau format (avec periods) ou à l'ancien format
          if (data.periods) {
            console.log("Format avec périodes détecté");
            // Nouveau format avec périodes
            const periodIds = Object.keys(data.periods);
            console.log("Périodes disponibles:", periodIds);
            
            // Pour chaque période, extraire les assignments et les ajouter à planningsByPeriod
            periodIds.forEach(periodId => {
              // Vérifier que la période existe et n'est pas null
              const periodData = data.periods[periodId];
              console.log(`Période ${periodId}:`, periodData);
              
              // Vérifier que periodData existe et contient des assignments
              if (periodData && periodData.assignments) {
                console.log(`Assignments dans la période ${periodId}:`, Object.keys(periodData.assignments).length);
                if (Object.keys(periodData.assignments).length > 0) {
                  console.log(`Exemple d'assignment dans la période ${periodId}:`, Object.entries(periodData.assignments)[0]);
                }
                
                // Convertir le timestamp Firestore en Date
                const uploadedAt = periodData.uploadedAt && typeof periodData.uploadedAt.toDate === 'function' 
                  ? periodData.uploadedAt.toDate() 
                  : new Date(periodData.uploadedAt || Date.now());
                
                // Stocker le planning dans la structure par période
                setPlanningsByPeriod(prev => {
                  const newPlanningsByPeriod = {
                    ...prev,
                    [periodId]: {
                      ...periodData,
                      uploadedAt
                    }
                  };
                  
                  console.log("Plannings par période mis à jour:", Object.keys(newPlanningsByPeriod));
                  
                  // Fusionner tous les plannings en un seul pour l'affichage
                  const mergedAssignments = mergeAllPlannings(newPlanningsByPeriod);
                  
                  // Mettre à jour le planning fusionné
                  setPlanning({
                    assignments: mergedAssignments,
                    uploadedAt
                  } as GeneratedPlanning);
                  
                  return newPlanningsByPeriod;
                });
              }
            });
          } else {
            // Ancien format sans périodes
            console.log("Format sans périodes détecté");
            console.log("Assignments dans les données:", data.assignments ? Object.keys(data.assignments).length : 0);
            
            // Convertir le timestamp Firestore en Date
            const uploadedAt = data.uploadedAt && typeof data.uploadedAt.toDate === 'function' 
              ? data.uploadedAt.toDate() 
              : new Date(data.uploadedAt);
            
            const periodId = data.periodId || 'current';
          
            // Stocker le planning dans la structure par période
            setPlanningsByPeriod(prev => {
              const newPlanningsByPeriod = {
                ...prev,
                [periodId]: {
                  ...data,
                  uploadedAt
                }
              };
              
              console.log("Plannings par période mis à jour:", Object.keys(newPlanningsByPeriod));
              
              // Fusionner tous les plannings en un seul pour l'affichage
              const mergedAssignments = mergeAllPlannings(newPlanningsByPeriod);
              
              // Mettre à jour le planning fusionné
              setPlanning({
                assignments: mergedAssignments,
                uploadedAt
              } as GeneratedPlanning);
              
              return newPlanningsByPeriod;
            });
          }
        } else {
          setPlanning(null);
        }
      },
      (error) => {
        console.error('Error loading planning:', error);
        setError('Erreur lors du chargement du planning');
        setLoading(false);
      }
    );

    // Écouter également les changements dans les échanges
    const unsubscribeExchangeHistory = onSnapshot(
      collection(db, 'exchange_history'),
      async () => {
        // Recharger l'historique des échanges quand il y a des changements
        await loadExchangeHistory();
      },
      (error) => {
        console.error('Error monitoring exchange history:', error);
      }
    );

    // Chargement initial
    loadExchangeHistory();

    // Nettoyage à la désactivation du composant
    return () => {
      unsubscribe();
      unsubscribeExchangeHistory();
    };
  }, [user]);
  
  // État pour stocker les dates calculées dynamiquement
  const [dynamicDateRange, setDynamicDateRange] = useState<{startDate: Date, endDate: Date} | null>(null);
  
  // Fonction pour charger les plannings antérieurs mois par mois
  const loadPreviousMonth = () => {
    if (!showPastDates) {
      // Premier chargement des dates antérieures
      setShowPastDates(true);
      
      // Charger 1 mois en arrière à partir d'aujourd'hui
      const today = new Date();
      const newStartDate = new Date(today);
      newStartDate.setMonth(today.getMonth() - 1);
      newStartDate.setDate(1); // Premier jour du mois précédent
      
      setDynamicDateRange(prev => ({
        startDate: newStartDate,
        endDate: prev?.endDate || new Date(today.setMonth(today.getMonth() + 6))
      }));
      
      setLoadedMonths(1); // Un mois chargé
    } else {
      // Charger 1 mois supplémentaire
      setDynamicDateRange(prev => {
        if (!prev) return null;
        
        const newStartDate = new Date(prev.startDate);
        newStartDate.setMonth(newStartDate.getMonth() - 1);
        
        return {
          startDate: newStartDate,
          endDate: prev.endDate
        };
      });
      
      setLoadedMonths(prev => prev + 1);
    }
  };
  
  // Fonction pour charger un mois supplémentaire dans le futur
  const loadNextMonth = () => {
    setDynamicDateRange(prev => {
      if (!prev) return null;
      
      const newEndDate = new Date(prev.endDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      
      return {
        startDate: prev.startDate,
        endDate: newEndDate
      };
    });
  };
  
  // Fonction pour fusionner tous les plannings de toutes les périodes en une seule structure
  const mergeAllPlannings = (planningsByPeriod: Record<string, GeneratedPlanning>) => {
    const mergedAssignments: Record<string, ShiftAssignment> = {};
    const allDates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliser à minuit
    
    console.log("Fusion des plannings - Périodes disponibles:", Object.keys(planningsByPeriod));
    
    // Vérifier si les désiderata de septembre-octobre 2025 sont présents
    const septOctDesiderata = Object.keys(desiderataForDisplay).filter(key => 
      key.startsWith('2025-09') || key.startsWith('2025-10')
    );
    console.log("UserPlanningPage: Désiderata de sept-oct 2025:", septOctDesiderata.length, septOctDesiderata);
    
    // Vérifier si nous avons des périodes archivées
    const hasArchivedPeriods = Object.keys(planningsByPeriod).some(periodId => {
      const period = allPeriods.find(p => p.id === periodId);
      return period && period.status === 'archived';
    });
    
    // Si nous avons des périodes archivées, nous devons toujours afficher les dates passées
    const shouldShowPastDates = showPastDates || hasArchivedPeriods;
    
    if (hasArchivedPeriods) {
      console.log("UserPlanningPage: Périodes archivées détectées - Affichage forcé des dates passées");
    }
    
    // Parcourir toutes les périodes
    Object.entries(planningsByPeriod).forEach(([periodId, planning]) => {
      if (!planning || !planning.assignments) {
        console.log(`Planning invalide ou sans assignments pour la période ${periodId}`);
        return;
      }
      
      const assignmentCount = Object.keys(planning.assignments).length;
      
      // Vérifier si cette période est archivée
      const period = allPeriods.find(p => p.id === periodId);
      const isArchivedPeriod = period && period.status === 'archived';
      
      console.log(`Planning de la période ${periodId} (${isArchivedPeriod ? 'archivée' : 'active'}) avec ${assignmentCount} assignments`);
      
      // Ajouter les assignments de cette période au planning fusionné
      Object.entries(planning.assignments).forEach(([key, assignment]) => {
        // Extraire la date de la clé (format: YYYY-MM-DD-PERIOD)
        const dateParts = key.split('-');
        if (dateParts.length >= 3) {
          const dateStr = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
          
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              // Inclure toutes les dates pour les périodes archivées
              // Pour les périodes actives, filtrer selon shouldShowPastDates
              if (isArchivedPeriod || shouldShowPastDates || date >= today) {
                mergedAssignments[key] = assignment;
                allDates.push(date);
              }
            }
          } catch (error) {
            console.error(`Erreur lors de la conversion de la date ${dateStr}:`, error);
          }
        }
      });
    });
    
    console.log(`Nombre total de dates valides trouvées: ${allDates.length}`);
    
    // Calculer les dates min et max si des dates valides ont été trouvées
    if (allDates.length > 0) {
      // Toujours trouver la date minimale réelle pour avoir toutes les gardes
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      
      console.log(`Date min trouvée: ${minDate.toISOString()}`);
      console.log(`Date max trouvée: ${maxDate.toISOString()}`);
      
      // Créer une copie de minDate pour la manipulation
      const adjustedMinDate = new Date(minDate);
      // Ajouter une marge de 15 jours avant et après pour une meilleure visualisation
      adjustedMinDate.setDate(adjustedMinDate.getDate() - 15);
      
      // Copie de maxDate pour la manipulation
      const adjustedMaxDate = new Date(maxDate);
      adjustedMaxDate.setDate(adjustedMaxDate.getDate() + 15);
      
      // Vérifier si les désiderata de septembre-octobre 2025 sont présents
      const septOctDesiderata = Object.keys(desiderataForDisplay).filter(key => 
        key.startsWith('2025-09') || key.startsWith('2025-10')
      );
      
      // Pour l'affichage initial, utiliser aujourd'hui comme date de début
      let displayStartDate = today;
      
      // Pour l'affichage initial, limiter à 5 mois à partir d'aujourd'hui
      let displayEndDate = new Date(today);
      displayEndDate.setMonth(displayEndDate.getMonth() + 5);
      
      // Si des désiderata de septembre-octobre 2025 sont présents, étendre la plage de dates
      if (septOctDesiderata.length > 0) {
        console.log("UserPlanningPage: Extension de la plage de dates pour inclure les désiderata de sept-oct 2025");
        
        // Créer une date pour septembre 2025
        const sept2025 = new Date(2025, 8, 1); // Mois 8 = septembre (0-indexed)
        
        // Créer une date pour octobre 2025
        const oct2025 = new Date(2025, 9, 31); // Mois 9 = octobre (0-indexed)
        
        // Si septembre 2025 est après la date de fin actuelle, étendre la plage
        if (sept2025 > displayEndDate) {
          console.log("UserPlanningPage: Extension de la date de fin pour inclure septembre-octobre 2025");
          displayEndDate = new Date(oct2025);
        }
      }
      
      console.log(`Plage de données complète: ${adjustedMinDate.toISOString()} - ${adjustedMaxDate.toISOString()}`);
      console.log(`Plage d'affichage initiale: ${displayStartDate.toISOString()} - ${displayEndDate.toISOString()}`);
      
      // Mettre à jour l'état des dates dynamiques avec la date d'affichage initiale
      setDynamicDateRange({startDate: displayStartDate, endDate: displayEndDate});
    } else {
      console.warn("Aucune date valide trouvée, utilisation des dates de configuration par défaut");
      // Si aucune date valide n'est trouvée, utiliser une plage par défaut (6 mois)
      const defaultStartDate = new Date();
      const defaultEndDate = new Date();
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 6);
      
      console.log(`Plage de dates par défaut: ${defaultStartDate.toISOString()} - ${defaultEndDate.toISOString()}`);
      setDynamicDateRange({startDate: defaultStartDate, endDate: defaultEndDate});
    }
    
    console.log("Assignments fusionnés:", Object.keys(mergedAssignments).length, mergedAssignments);
    return mergedAssignments;
  };
  
  // Effectuer le scroll vers la date actuelle au chargement
  useEffect(() => {
    if (todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 500); // Délai pour s'assurer que le composant est rendu
    }
    
    // Écouter l'événement personnalisé pour charger le mois précédent
    const handleLoadPreviousMonth = () => {
      loadPreviousMonth();
    };
    
    window.addEventListener('loadPreviousMonth', handleLoadPreviousMonth);
    
    return () => {
      window.removeEventListener('loadPreviousMonth', handleLoadPreviousMonth);
    };
  }, [planning]);
  
  // Fonction pour déterminer si un jour est le premier jour d'une période BAG
  const isFirstDayOfBagPeriod = (date: Date) => {
    // Vérifier d'abord si la date appartient à une période importée sans BAG
    const matchingPeriod = allPeriods.find(period => {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      return date >= startDate && date <= endDate;
    });
    
    // Si la période existe et est soit en phase 'completed' soit a le statut 'active',
    // alors c'est une période importée sans BAG - ignorer la détection de début de BAG
    if (matchingPeriod && (matchingPeriod.bagPhase === 'completed' || matchingPeriod.status === 'active')) {
      console.log(`Date ${format(date, 'yyyy-MM-dd')} appartient à une période importée sans BAG: ${matchingPeriod.name}`);
      return false;
    }
    
    // Trouver la période future (BAG)
    const bagPeriod = allPeriods.find(p => p.status === 'future');
    if (!bagPeriod) {
      console.log("Aucune période BAG (future) trouvée");
      return false;
    }
    
    // Vérifier si c'est le premier jour de la période BAG
    const dateStr = format(date, 'yyyy-MM-dd');
    const bagStartStr = format(bagPeriod.startDate, 'yyyy-MM-dd');
    
    const isBagStart = dateStr === bagStartStr;
    
    // Log pour débogage - uniquement si c'est le premier jour
    if (isBagStart) {
      console.log(`Jour de début de BAG détecté: ${dateStr}`);
    }
    
    return isBagStart;
  };

  if (!user?.roles.isUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Accès non autorisé</h2>
          <p className="text-yellow-700">
            Vous n'avez pas accès à cette page.
          </p>
        </div>
      </div>
    );
  }

  if (!config.isConfigured) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Planning non configuré</h2>
          <p className="text-yellow-700">
            Le planning n'a pas encore été configuré par l'administrateur.
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 mr-2" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mon Planning</h1>
              <button
                onClick={() => setShowTutorial(true)}
                className="ml-2 p-1.5 rounded-full bg-amber-100/80 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-300 transition-all transform hover:scale-105 active:scale-95"
                title="Tutoriel"
                data-tutorial="tutorial-button"
              >
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 drop-shadow" />
              </button>
            </div>
            {planning && (
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex gap-1 sm:gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="inline-flex items-center px-2 sm:px-3 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Exporter le planning"
                    >
                      <Download className="h-4 w-4 sm:mr-2" />
                      <span className="hidden xs:inline">Exporter</span>
                      <ChevronDown className={`ml-1 sm:ml-2 h-4 w-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showExportMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setShowExportMenu(false)}
                        />
                        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1" role="menu">
                            <button
                              onClick={() => {
                                handleExportCSV();
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              CSV (Google Calendar)
                            </button>
                            <button
                              onClick={async () => {
                                if (!planning || !user) return;
                                setToast({
                                  visible: true,
                                  message: 'Préparation de l\'export ICS...',
                                  type: 'success'
                                });
                                try {
                                  const exportPlanningToICS = await loadIcsExporter();
                                  exportPlanningToICS(
                                    planning.assignments,
                                    `${user.lastName}_${user.firstName}`
                                  );
                                  setShowExportMenu(false);
                                } catch (error) {
                                  console.error('Error exporting ICS:', error);
                                  setToast({
                                    visible: true,
                                    message: 'Erreur lors de l\'export ICS',
                                    type: 'error'
                                  });
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              ICS (Apple Calendar)
                            </button>
                            <button
                              onClick={() => {
                                setShowDownloadModal(true);
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              role="menuitem"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              PDF
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button
                              onClick={() => {
                                setShowImportHelp(true);
                                setShowExportMenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 flex items-center"
                              role="menuitem"
                            >
                              <HelpCircle className="h-4 w-4 mr-2" />
                              Aide à l'importation
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2" data-tutorial="toggle-desiderata">
                <span className="text-xs sm:text-sm text-gray-600">Desiderata</span>
                <Switch
                  checked={showDesiderata}
                  onChange={setShowDesiderata}
                  className="relative inline-flex h-5 sm:h-6 w-10 sm:w-11 items-center rounded-full"
                />
              </div>
              
              <div className="h-6 w-px bg-gray-200"></div>
              
              <div className="flex items-center gap-1 border rounded-md bg-white shadow-sm" data-tutorial="view-switcher">
                <button
                  onClick={() => setViewMode('multiColumn')}
                  className={`p-1.5 rounded-l-md transition-colors ${viewMode === 'multiColumn' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="Vue en colonnes"
                >
                  <Columns className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('singleColumn')}
                  className={`p-1.5 rounded-r-md transition-colors ${viewMode === 'singleColumn' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="Vue en liste"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {planning ? (
          <>
            {/* Phase de la bourse aux gardes */}
            <div className="mb-2 text-xs">
              {bagPhaseConfig.phase === 'submission' ? (
                <div className="flex flex-row items-center justify-between text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Clock className="h-4 w-4" />
                    <span>BàG disponible</span>
                    <div className="flex items-center gap-1 text-blue-900 font-medium">
                      <span>
                        {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
                        {String(timeLeft.hours).padStart(2, '0')}h
                        {String(timeLeft.minutes).padStart(2, '0')}m
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 italic">
                    MàJ : {(planning.uploadedAt as Date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              ) : bagPhaseConfig.phase === 'distribution' ? (
                <div className="flex flex-row items-center justify-between text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-md">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Répartition en cours</span>
                  </div>
                  <div className="text-[10px] text-gray-500 italic">
                    MàJ : {(planning.uploadedAt as Date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-between text-green-700 bg-green-50 px-3 py-1.5 rounded-md">
                  <div className="flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    <span>Phase terminée</span>
                  </div>
                  <div className="text-[10px] text-gray-500 italic">
                    MàJ : {(planning.uploadedAt as Date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              )}
            </div>
            <div data-tutorial="planning-grid" className="w-full overflow-hidden">
              
              <div className="w-full">
                <Suspense fallback={
                  <div className="flex justify-center items-center py-20">
                    <LoadingSpinner />
                    <span className="ml-2 text-sm text-gray-500">Chargement du planning...</span>
                  </div>
                }>
                  <GeneratedPlanningTable
                    startDate={dynamicDateRange ? dynamicDateRange.startDate : config.startDate}
                    endDate={dynamicDateRange ? dynamicDateRange.endDate : config.endDate}
                    assignments={planning.assignments}
                    userId={user?.id}
                    showDesiderata={showDesiderata}
                    desiderata={desiderataForDisplay}
                    receivedShifts={receivedShifts}
                    viewMode={viewMode}
                    todayRef={todayRef}
                    isFirstDayOfBagPeriod={isFirstDayOfBagPeriod}
                    isAdminView={false}
                    onLoadPreviousMonth={loadPreviousMonth}
                    onLoadNextMonth={loadNextMonth}
                  />
                </Suspense>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-yellow-50 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-yellow-800 mb-2">
              Planning en cours de création
            </h2>
            <p className="text-yellow-700">
              Votre planning n'a pas encore été importé par l'administrateur. 
              Il sera affiché ici dès qu'il sera disponible.
            </p>
          </div>
        )}
      </div>
      <PlanningTutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      
      {/* Modal de téléchargement PDF */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Télécharger le planning en PDF
            </h3>
            <div className="space-y-4">
              <button
                onClick={async () => {
                  if (!planning || !user) return;
                  try {
                    setToast({
                      visible: true,
                      message: 'Préparation de l\'export PDF...',
                      type: 'success'
                    });
                    const exportPlanningToPDF = await loadPdfExporter();
                    await exportPlanningToPDF({
                      userName: `${user.lastName} ${user.firstName}`,
                      startDate: config.startDate,
                      endDate: config.endDate,
                      assignments: planning.assignments,
                      showAssignmentsOnly: true
                    });
                    setShowDownloadModal(false);
                  } catch (error) {
                    console.error('Error exporting PDF:', error);
                    setToast({
                      visible: true,
                      message: 'Erreur lors de l\'export PDF',
                      type: 'error'
                    });
                  }
                }}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Planning seul
              </button>
              <button
                onClick={async () => {
                  if (!planning || !user) return;
                  try {
                    setToast({
                      visible: true,
                      message: 'Préparation de l\'export PDF avec desiderata...',
                      type: 'success'
                    });
                    const exportPlanningToPDF = await loadPdfExporter();
                    await exportPlanningToPDF({
                      userName: `${user.lastName} ${user.firstName}`,
                      startDate: config.startDate,
                      endDate: config.endDate,
                      assignments: planning.assignments,
                      desiderata: desiderata,
                      showAssignmentsOnly: false,
                      showComments: true
                    });
                    setShowDownloadModal(false);
                  } catch (error) {
                    console.error('Error exporting PDF with desiderata:', error);
                    setToast({
                      visible: true,
                      message: 'Erreur lors de l\'export PDF avec desiderata',
                      type: 'error'
                    });
                  }
                }}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Planning avec desiderata
              </button>
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'aide à l'importation */}
      {showImportHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-full">
                  <Import className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Importer votre planning dans Google Calendar
                </h3>
              </div>
              <button
                onClick={() => setShowImportHelp(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Fermer</span>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-6">
              <ol className="space-y-6">
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Connectez-vous à votre compte GmailH24</p>
                    <p className="mt-1 text-sm text-gray-600">Utilisez un ordinateur pour une meilleure expérience</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Téléchargez votre fichier CSV</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur le bouton "Exporter", puis sélectionnez "CSV (Google Calendar)"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-indigo-100 rounded-full">
                    <Grid className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Accédez à Google Calendar</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur le menu des applications Google (carré) en haut à droite, puis sélectionnez "Agenda"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-full">
                    <Settings className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Ouvrez les paramètres</p>
                    <p className="mt-1 text-sm text-gray-600">Cliquez sur l'icône des paramètres (roue dentelée) puis sélectionnez "Paramètres"</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-purple-100 rounded-full">
                    <Import className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Importez votre planning</p>
                    <ol className="mt-2 space-y-2 text-sm text-gray-600">
                      <li>1. Dans le menu de gauche, cliquez sur "Importer et exporter"</li>
                      <li>2. Sélectionnez le fichier CSV téléchargé</li>
                      <li>3. Choisissez votre agenda dans le menu déroulant</li>
                      <li>4. Cliquez sur "Importer"</li>
                    </ol>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Terminé !</p>
                    <p className="mt-1 text-sm text-green-700">Un message de confirmation devrait apparaître. Votre planning est maintenant importé dans Google Calendar.</p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowImportHelp(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPlanningPage;
