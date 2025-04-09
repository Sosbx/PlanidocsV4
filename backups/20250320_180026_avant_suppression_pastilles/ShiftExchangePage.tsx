import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Info, List, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import ConflictModal from '../components/modals/ConflictModal';
import CommentModalView from '../components/modals/CommentModalView';
import PlanningPreviewModal from '../components/modals/PlanningPreviewModal';
import PermanentPlanningPreview from '../components/planning/PermanentPlanningPreview';
import GroupedShiftExchangeList from '../components/bag/GroupedShiftExchangeList';
import { useBagPhase } from '../context/BagPhaseContext';
import BagPhaseIndicator from '../components/bag/BagPhaseIndicator';
import { useAuth } from '../hooks/useAuth';
import { getShiftExchanges, toggleInterest } from '../lib/firebase/shifts';
import { isGrayedOut } from '../utils/dateUtils';
import type { ShiftExchange, ShiftAssignment, ExchangeHistory } from '../types/planning';
import { useUsers } from '../context/UserContext';
import Toast from '../components/Toast';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { GeneratedPlanning } from '../types/planning';
import type { User } from '../types/users';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ShiftExchangePage: React.FC = () => {
  // Hooks d'authentification et contexte
  const { user } = useAuth();
  const { users } = useUsers();
  const { config: bagPhaseConfig } = useBagPhase();

  // États principaux
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAssignments, setUserAssignments] = useState<Record<string, ShiftAssignment>>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  
  // États des modals
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictExchange, setConflictExchange] = useState<ShiftExchange | null>(null);
  const [exchangeUser, setExchangeUser] = useState<User | null>(null);
  const [showCommentModal, setShowCommentModal] = useState<{ id: string; comment: string } | null>(null);
  const [showPlanningPreview, setShowPlanningPreview] = useState<{
    date: string;
    position: { x: number; y: number };
  } | null>(null);

  // États des conflits
  const [conflictStates, setConflictStates] = useState<Record<string, boolean>>({});
  const [, setConflictDetails] = useState<Record<string, {
    date: string;
    period: string;
    shiftType: string;
  }>>({});

  // États de filtrage et d'affichage
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [showOwnShifts, setShowOwnShifts] = useState(true);
  const [showMyInterests, setShowMyInterests] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'M' | 'AM' | 'S'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // États de navigation du calendrier
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    console.log("Initialisation de currentMonth:", now);
    return now;
  });
  
  // États pour le responsive
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('month');
  
  // État pour les gardes reçues
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});
  
  // Refs
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const swipeInfo = useRef({ touchStartX: 0, touchStartY: 0, touchStartTime: 0 });
  const isFirstLoad = useRef(true);
  
  // Fonction pour vérifier les conflits - maintenant en useCallback
  const checkForConflict = useCallback(async (exchange: ShiftExchange): Promise<{hasConflict: boolean; conflictDetails?: {date: string; period: string; shiftType: string}}> => {
    if (!user) return {hasConflict: false};
    
    try {
      const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
      if (!planningDoc.exists()) return {hasConflict: false};
      
      const planning = planningDoc.data() as GeneratedPlanning;
      const assignmentKey = `${exchange.date}-${exchange.period}`;
      
      const conflictAssignment = planning.assignments[assignmentKey];
      
      if (conflictAssignment) {
        return {
          hasConflict: true,
          conflictDetails: {
            date: exchange.date,
            period: exchange.period,
            shiftType: conflictAssignment.shiftType
          }
        };
      }
      
      return {hasConflict: false};
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return {hasConflict: false};
    }
  }, [user]);
  
  // Définir processToggleInterest avant de l'utiliser dans d'autres hooks
  const processToggleInterest = useCallback(async (exchangeId: string) => {
    if (!user) return;

    try {
      // Mise à jour optimiste de l'état local
      setExchanges(prevExchanges => {
        return prevExchanges.map(exchange => {
          if (exchange.id === exchangeId) {
            const currentInterestedUsers = exchange.interestedUsers || [];
            const isCurrentlyInterested = currentInterestedUsers.includes(user.id);
            
            return {
              ...exchange,
              interestedUsers: isCurrentlyInterested
                ? currentInterestedUsers.filter(id => id !== user.id)
                : [...currentInterestedUsers, user.id]
            };
          }
          return exchange;
        });
      });

      // Effectuer la mise à jour sur le serveur
      await toggleInterest(exchangeId, user.id);
      
      setToast({
        visible: true,
        message: 'Intérêt mis à jour avec succès',
        type: 'success'
      });
    } catch (error) {
      // En cas d'erreur, recharger les données pour s'assurer de la cohérence
      const data = await getShiftExchanges();
      setExchanges(data);
      
      const errorMessage = error instanceof Error && 'code' in error && error.code === 'EXCHANGE_UNAVAILABLE'
        ? 'Cette garde n\'est plus disponible'
        : 'Erreur lors de la mise à jour de l\'intérêt';
      
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
    }
  }, [user]);
  
  // Fonctions de navigation du calendrier
  const goToPrevious = useCallback(() => {
    if (calendarViewMode === 'week') {
      setCurrentMonth(prevMonth => subDays(prevMonth, 7));
    } else {
      setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
    }
  }, [calendarViewMode]);
  
  const goToNext = useCallback(() => {
    if (calendarViewMode === 'week') {
      setCurrentMonth(prevMonth => addDays(prevMonth, 7));
    } else {
      setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
    }
  }, [calendarViewMode]);
  
  // Gestionnaires d'événements
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (viewMode !== 'calendar') return;
    if (!e.touches?.length || e.touches.length !== 1) return;
    
    swipeInfo.current.touchStartX = e.touches[0].clientX;
    swipeInfo.current.touchStartY = e.touches[0].clientY;
    swipeInfo.current.touchStartTime = Date.now();
  }, [viewMode]);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (viewMode !== 'calendar') return;
    if (!e.changedTouches?.[0]) return;
    
    const { touchStartX, touchStartY, touchStartTime } = swipeInfo.current;
    
    const elapsedTime = Date.now() - touchStartTime;
    if (elapsedTime > 300) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;
    
    if (Math.abs(distX) >= 75 && Math.abs(distY) <= 100) {
      if (distX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
  }, [viewMode, goToNext, goToPrevious]);

  const handleCloseConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setConflictExchange(null);
    setExchangeUser(null);
  }, []);

  const handleConfirmConflict = useCallback(async () => {
    if (!conflictExchange) return;
    
    await processToggleInterest(conflictExchange.id);
    handleCloseConflictModal();
  }, [conflictExchange, handleCloseConflictModal, processToggleInterest]);
  
  const handleToggleInterest = useCallback(async (exchange: ShiftExchange) => {
    if (!user) return;

    // Empêcher les interactions si la phase n'est pas "submission"
    if (bagPhaseConfig.phase !== 'submission') {
      setToast({
        visible: true,
        message: bagPhaseConfig.phase === 'distribution' 
          ? 'La répartition des gardes est en cours. Veuillez patienter.' 
          : 'La période de soumission est terminée',
        type: 'error'
      });
      return;
    }
    
    // Empêcher les interactions avec les gardes indisponibles
    if (exchange.status === 'unavailable') {
      setToast({
        visible: true,
        message: 'Cette garde n\'est plus disponible',
        type: 'error'
      });
      return;
    }

    const { hasConflict, conflictDetails } = await checkForConflict(exchange);
    const isAlreadyInterested = exchange.interestedUsers?.includes(user.id);

    // Si l'utilisateur a déjà manifesté son intérêt, permettre de retirer l'intérêt même en cas de conflit
    if (isAlreadyInterested) {
      await processToggleInterest(exchange.id);
      return;
    }
    
    // Pour un nouvel intérêt avec conflit, afficher une alerte
    if (hasConflict) {
      const owner = users.find(u => u.id === exchange.userId);
      setConflictExchange(exchange);
      setExchangeUser(owner || null);
      setShowConflictModal(true);
      
      // Mettre à jour les détails de conflit
      if (conflictDetails) {
        const key = `${exchange.date}-${exchange.period}`;
        setConflictDetails(prev => ({
          ...prev,
          [key]: conflictDetails
        }));
      }
    } else {
      // Pas de conflit, on peut exprimer l'intérêt directement
      await processToggleInterest(exchange.id);
    }
  }, [user, bagPhaseConfig.phase, users, checkForConflict, processToggleInterest]);
  
  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  // Fonction pour obtenir les jours à afficher - maintenant en useCallback
  const getDaysToDisplay = useCallback(() => {
    try {
      if (calendarViewMode === 'week') {
        // Pour le mode semaine, on prend la semaine qui contient le jour actuel du mois
        const currentDay = new Date(currentMonth);
        
        // Trouver le lundi de la semaine (en France, la semaine commence le lundi)
        let startOfWeek = currentDay;
        let dayOfWeek = currentDay.getDay(); // 0 = dimanche, 1 = lundi, ...
        
        // Ajuster pour que la semaine commence lundi (1) et finisse dimanche (0)
        // Si c'est dimanche (0), on recule de 6 jours pour trouver le lundi précédent
        // Sinon on recule de (dayOfWeek - 1) jours
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        // Reculer pour trouver le lundi
        startOfWeek = subDays(currentDay, dayOfWeek);
        
        // La fin de la semaine est 6 jours plus tard (dimanche)
        const endOfWeek = addDays(startOfWeek, 6);
        
        const days = eachDayOfInterval({ start: startOfWeek, end: endOfWeek });
        return days;
      } else {
        // Mode mois standard
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start, end });
        return days;
      }
    } catch (error) {
      console.error("Erreur dans getDaysToDisplay:", error);
      // Fallback à un tableau vide
      return [];
    }
  }, [currentMonth, calendarViewMode]);
  
  // useEffect pour détecter la taille de l'écran
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640); // Mobile: < 640px (sm breakpoint)
      setIsSmallScreen(window.innerWidth < 768); // Small screens: < 768px (md breakpoint)
      
      // Définir automatiquement le mode calendrier selon la taille d'écran
      if (isFirstLoad.current) {
        if (window.innerWidth < 640) {
          setCalendarViewMode('week');
        } else {
          setCalendarViewMode('month');
        }
        isFirstLoad.current = false;
      }
    };
    
    // Vérifier la taille initiale
    checkScreenSize();
    
    // Écouter les changements de taille d'écran
    window.addEventListener('resize', checkScreenSize);
    
    // Nettoyer l'écouteur au démontage
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // useEffect pour les événements tactiles
  useEffect(() => {
    const container = calendarContainerRef.current;
    if (!container) return;
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Nettoyage
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
  
  // useEffect pour charger les données
  useEffect(() => {
    if (!user) return;
    
    // Stockage des fonctions de nettoyage
    const cleanupFunctions: (() => void)[] = [];
    
    const addCleanup = (fn: (() => void) | undefined | null) => {
      if (typeof fn === 'function') {
        cleanupFunctions.push(fn);
      }
    };
    
    setLoading(true);
    
    // Date d'aujourd'hui
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      // 1. Requête optimisée pour obtenir les échanges
      const exchangesQuery = query(
        collection(db, 'shift_exchanges'),
        where('date', '>=', today),
        where('status', 'in', ['pending', 'unavailable']),
        orderBy('date', 'asc'),
        limit(100) // Limiter à 100 résultats
      );
      
      // 2. Écouteur principal pour les échanges
      const unsubscribeMain = onSnapshot(
        exchangesQuery,
        (snapshot) => {
          const exchangeData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ShiftExchange[];
          
          // Trier les échanges
          exchangeData.sort((a, b) => {
            if (a.status === 'pending' && b.status === 'unavailable') return -1;
            if (a.status === 'unavailable' && b.status === 'pending') return 1;
            return a.date.localeCompare(b.date);
          });
          
          setExchanges(exchangeData);
          
          // Vérifier les conflits pour les échanges intéressés
          if (user) {
            const interestedExchanges = exchangeData.filter(e => 
              e.interestedUsers?.includes(user.id)
            );
            
            Promise.all(
              interestedExchanges.map(async exchange => {
                const result = await checkForConflict(exchange);
                return { 
                  id: exchange.id, 
                  hasConflict: result.hasConflict,
                  conflictDetails: result.conflictDetails,
                  key: `${exchange.date}-${exchange.period}`
                };
              })
            ).then(results => {
              const newConflictStates: Record<string, boolean> = {};
              const newConflictDetails: Record<string, {
                date: string;
                period: string;
                shiftType: string;
              }> = {};
              
              results.forEach(({ id, hasConflict, conflictDetails, key }) => {
                newConflictStates[id] = hasConflict;
                if (hasConflict && conflictDetails) {
                  newConflictDetails[key] = conflictDetails;
                }
              });
              
              setConflictStates(newConflictStates);
              setConflictDetails(newConflictDetails);
            });
          }
          
          setLoading(false);
        },
        (error) => {
          console.error('Error loading exchanges:', error);
          
          // Message d'erreur personnalisé pour l'index manquant
          let errorMessage = 'Erreur lors du chargement des échanges';
          
          // Vérifier si c'est une erreur d'index manquant
          if (error.message && error.message.includes('requires an index')) {
            errorMessage = 'Configuration de la base de données requise. Veuillez contacter l\'administrateur.';
            console.warn('Index Firestore manquant. Créez l\'index via le lien dans l\'erreur de console.');
          }
          
          setToast({
            visible: true,
            message: errorMessage,
            type: 'error'
          });
          
          // Définir un délai avant de réessayer
          setTimeout(() => {
            // Essayer de charger sans orderBy pour récupérer au moins des données
            try {
              const simpleQuery = query(
                collection(db, 'shift_exchanges'),
                where('date', '>=', today),
                where('status', 'in', ['pending', 'unavailable'])
              );
              
              const fallbackUnsubscribe = onSnapshot(
                simpleQuery,
                (snapshot) => {
                  const exchangeData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as ShiftExchange[];
                  
                  setExchanges(exchangeData);
                  setLoading(false);
                },
                () => setLoading(false)
              );
              
              // Ajouter au nettoyage
              addCleanup(fallbackUnsubscribe);
            } catch (error) {
              console.error('Fallback query error:', error);
              setLoading(false);
            }
          }, 1000);
        }
      );
      
      // Ajouter l'écouteur principal à nettoyer
      addCleanup(unsubscribeMain);
      
      // Charger les données supplémentaires de manière asynchrone
      const loadAdditionalData = async () => {
        try {
          // Charger le planning de l'utilisateur
          const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
          if (planningDoc.exists()) {
            const planning = planningDoc.data() as GeneratedPlanning;
            setUserAssignments(planning.assignments || {});
          }
  
          // Charger l'historique des échanges pour les gardes reçues
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
            
            // Ne prendre en compte que les échanges complétés impliquant cet utilisateur
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
          console.error('Error loading additional data:', error);
        }
      };
      
      // Lancer le chargement des données supplémentaires
      loadAdditionalData();
      
      // Observer les changements d'historique
      const unsubscribeExchangeHistory = onSnapshot(
        collection(db, 'exchange_history'),
        async () => {
          try {
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
            console.error('Error reloading exchange history:', error);
          }
        }
      );
      
      // Ajouter l'écouteur d'historique à nettoyer
      addCleanup(unsubscribeExchangeHistory);
    } catch (error) {
      console.error('Error loading data:', error);
      setToast({
        visible: true,
        message: 'Erreur lors du chargement des données',
        type: 'error'
      });
      setLoading(false);
    }
    
    // Fonction de nettoyage principale pour l'effet
    return () => {
      // Exécuter toutes les fonctions de nettoyage
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      });
    };
  }, [user, checkForConflict]);

  // Vérifier si les interactions doivent être désactivées
  const isInteractionDisabled = bagPhaseConfig.phase !== 'submission';
  
  // Chaîne de description pour aider l'utilisateur à comprendre les conflits
  const conflictHelpText = "Un conflit signifie que vous avez déjà une garde à cette date et période. Vous pouvez quand même vous positionner, mais sachez qu'en cas d'échange, il vous faudra résoudre ce conflit.";

  // Filtrer les échanges selon les paramètres - déplacé hors du rendu
  const filteredExchanges = exchanges
    .filter(exchange => showOwnShifts || exchange.userId !== user?.id)
    .filter(exchange => !showMyInterests || exchange.interestedUsers?.includes(user?.id || ''))
    .filter(exchange => selectedPeriod === 'all' || exchange.period === selectedPeriod)
    .sort((a, b) => {
      // D'abord par date
      return a.date.localeCompare(b.date);
    });
    
  // Autres constantes utiles si nécessaire plus tard

  // Logs pour déboguer
  console.log("Total des échanges bruts:", exchanges.length);
  console.log("Total des échanges filtrés:", filteredExchanges.length);

  // Affichage d'un message si les échanges ne peuvent pas être chargés
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600 text-center max-w-md">
          Chargement des échanges de gardes...
        </p>
        <p className="mt-2 text-gray-500 text-xs text-center max-w-md">
          Si le chargement persiste, un index Firebase pourrait être nécessaire.
        </p>
      </div>
    );
  }
  
  // Message de secours en cas d'échec de chargement
  if (!loading && exchanges.length === 0 && toast.visible && toast.type === 'error') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Toast 
          message={toast.message}
          isVisible={toast.visible}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        />
        
        <div className="bg-white rounded-lg shadow-md p-8 mt-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <h2 className="text-xl font-semibold text-gray-800">Impossible de charger les échanges</h2>
            <p className="text-gray-600 max-w-md">
              Un problème est survenu lors du chargement des données. 
              Veuillez réessayer ultérieurement ou contacter l'administrateur.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Réessayer
              </button>
              <p className="text-xs text-gray-500 max-w-[300px] mx-auto">
                Problème d'index Firebase détecté. Vérifiez la console pour le lien de création d'index.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-indigo-900">Bourse aux Gardes</h1>
        
        {/* Toggle pour basculer entre la vue liste et agenda */}
        <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-100 text-indigo-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <List className="h-4 w-4" />
            <span>Liste</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-indigo-100 text-indigo-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Agenda</span>
          </button>
        </div>
      </div>

      {/* Controls panel - commun aux deux vues */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <BagPhaseIndicator />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer bg-indigo-50 px-2 py-1 rounded-md">
              <input
                type="checkbox"
                checked={showOwnShifts}
                onChange={(e) => setShowOwnShifts(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                disabled={isInteractionDisabled}
              />
              <span className="text-xs text-gray-700">Mes gardes</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer bg-green-50 px-2 py-1 rounded-md">
              <input
                type="checkbox"
                checked={showMyInterests}
                onChange={(e) => setShowMyInterests(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-4 w-4"
                disabled={isInteractionDisabled}
              />
              <span className="text-xs text-gray-700">Mes intérêts</span>
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'all' | 'M' | 'AM' | 'S')}
              className="text-xs border-gray-300 rounded-md px-2 py-1"
              disabled={isInteractionDisabled}
            >
              <option value="all">Toutes périodes</option>
              <option value="M">Matin</option>
              <option value="AM">Après-midi</option>
              <option value="S">Soir</option>
            </select>
          </div>
        </div>
        
        {bagPhaseConfig.phase === 'distribution' && (
          <div className="bg-yellow-50 px-3 py-2 border-b border-yellow-200">
            <p className="text-yellow-700 text-center text-xs font-medium flex items-center justify-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
              Répartition en cours. Interactions temporairement désactivées.
            </p>
          </div>
        )}
      </div>

      {/* Vérifier que les données sont bien chargées avant d'afficher le contenu */}
      {!user || loading ? (
        <LoadingSpinner />
      ) : viewMode === 'list' ? (
        // Vue Liste
        <div className="flex flex-row gap-2 sm:gap-3 md:gap-4">
          {/* Liste des gardes à gauche */}
          <div className="w-3/5 sm:w-2/3 max-h-[calc(100vh-13rem)] overflow-auto" id="shift-exchange-container">
            {filteredExchanges.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Info className="h-8 w-8 text-indigo-300" />
                  <p className="text-gray-600 font-medium">
                    Aucune garde disponible avec les filtres sélectionnés
                  </p>
                  <p className="text-gray-500 text-sm">
                    Essayez de modifier vos filtres ou revenez plus tard
                  </p>
                </div>
              </div>
            ) : (
              <GroupedShiftExchangeList
                exchanges={filteredExchanges}
                user={user}
                users={users}
                userAssignments={userAssignments}
                conflictStates={conflictStates}
                receivedShifts={receivedShifts}
                isInteractionDisabled={isInteractionDisabled}
                bagPhaseConfig={bagPhaseConfig}
                onToggleInterest={handleToggleInterest}
                onSelectDate={handleSelectDate}
                selectedDate={selectedDate}
              />
            )}
          </div>
          
          {/* Planning fixe à droite, visible sur tous les écrans */}
          <div className="w-2/5 sm:w-1/3 sticky top-4 self-start">
            <PermanentPlanningPreview
              assignments={userAssignments}
              selectedDate={selectedDate}
              className="max-h-[calc(100vh-8rem)]"
            />
          </div>
        </div>
      ) : (
        // Vue Agenda améliorée sans planning flottant
        <div 
          ref={calendarContainerRef}
          className="w-full bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Agenda des gardes disponibles</h2>
          
            {/* En-tête de l'agenda avec navigation adaptée tactile */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center">
                <button 
                  onClick={goToPrevious}
                  className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-indigo-600 bg-white rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shadow-sm touch-action-manipulation"
                  aria-label={calendarViewMode === 'week' ? 'Semaine précédente' : 'Mois précédent'}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="flex flex-col items-center">
                  <h3 className="text-base sm:text-lg font-bold text-indigo-700">
                    {calendarViewMode === 'week' 
                      ? (() => {
                          try {
                            const days = getDaysToDisplay();
                            return days && days.length > 0 
                              ? `Semaine du ${format(days[0], 'd MMM', { locale: fr })}`
                              : 'Semaine en cours';
                          } catch (error) {
                            console.error('Erreur format date semaine:', error);
                            return 'Semaine en cours';
                          }
                        })()
                      : format(currentMonth, 'MMMM yyyy', { locale: fr })}
                  </h3>
                  
                  {/* Bouton pour aller à aujourd'hui */}
                  <button 
                    onClick={() => setCurrentMonth(new Date())}
                    className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded-full hover:bg-indigo-50 active:bg-indigo-100"
                  >
                    aujourd'hui
                  </button>
                </div>
                
                <button 
                  onClick={goToNext}
                  className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-indigo-600 bg-white rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shadow-sm touch-action-manipulation"
                  aria-label={calendarViewMode === 'week' ? 'Semaine suivante' : 'Mois suivant'}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              
              {/* Basculement entre modes semaine et mois (visible uniquement sur petit écran) */}
              {isSmallScreen && (
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <div className="inline-flex rounded-md bg-gray-100 p-0.5">
                    <button
                      onClick={() => setCalendarViewMode('week')}
                      className={`px-3 py-1 text-xs rounded-md ${
                        calendarViewMode === 'week'
                          ? 'bg-white text-indigo-700 font-medium shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Semaine
                    </button>
                    <button
                      onClick={() => setCalendarViewMode('month')}
                      className={`px-3 py-1 text-xs rounded-md ${
                        calendarViewMode === 'month'
                          ? 'bg-white text-indigo-700 font-medium shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Mois
                    </button>
                  </div>
                  
                  {/* Astuce de navigation par swipe */}
                  {isMobile && (
                    <div className="flex items-center text-[10px] text-gray-500 italic">
                      <span>Glissez vers la gauche/droite pour naviguer</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grille de l'agenda - adaptée selon la taille d'écran */}
            {!isMobile && (
              // Entêtes des jours uniquement pour les écrans non-mobiles
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                  <div key={day} className="text-center font-medium text-gray-600 py-2 text-sm">
                    {day}
                  </div>
                ))}
              </div>
            )}

            {/* Conteneur de grille avec nombre de colonnes adapté */}
            <div className={`grid ${isMobile ? 'grid-cols-4 gap-0.5' : 'grid-cols-7 gap-1'}`}>
              {/* Générer les cellules pour les jours précédents pour aligner correctement le calendrier */}
              {(() => {
                try {
                  // Le remplissage des cellules vides n'est nécessaire qu'en mode mois
                  if (calendarViewMode === 'month') {
                    const firstDay = startOfMonth(currentMonth);
                    // Calcul du jour de la semaine: 0 pour dimanche, 1 pour lundi, etc.
                    let dayOfWeek = firstDay.getDay();
                    // Ajuster pour que la semaine commence lundi (0) et finisse dimanche (6)
                    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    
                    const emptyCells = [];
                    for (let i = 0; i < dayOfWeek; i++) {
                      emptyCells.push(
                        <div key={`empty-${i}`} className={`${isMobile ? 'min-h-[50px]' : 'min-h-[100px]'} bg-gray-50/50`}></div>
                      );
                    }
                    return emptyCells;
                  }
                  // En mode semaine, on n'a pas besoin de cellules vides
                  return null;
                } catch (error) {
                  console.error("Erreur lors de la génération des cellules vides:", error);
                  return null;
                }
              })()}
              
              {/* Jours du mois actuel - rendu de façon sécurisée */}
              {(() => {
                try {
                  // Récupérer les jours avec gestion d'erreur
                  let days;
                  try {
                    days = getDaysToDisplay();
                  } catch (error) {
                    console.error("Erreur lors de l'obtention des jours:", error);
                    // Fallback à un tableau vide
                    days = [];
                  }
                  
                  if (days.length === 0) {
                    console.error("Aucun jour retourné par getDaysToDisplay()");
                    return <div className="p-4 bg-red-100 text-red-800">Erreur: Aucun jour disponible</div>;
                  }
                  
                  const today = new Date();
                  
                  // Récupérer TOUS les échanges par jour et par période (non filtrés)
                  const exchangesByDate: Record<string, Record<string, ShiftExchange[]>> = {};
                  
                  // Regrouper les échanges par date et par période
                  // Utiliser 'exchanges' au lieu de 'filteredExchanges' pour afficher toutes les gardes
                  // indépendamment des filtres sélectionnés
                  exchanges
                    // Filtre pour période si sélectionnée (garder ce filtre pour cohérence)
                    .filter(exchange => selectedPeriod === 'all' || exchange.period === selectedPeriod)
                    // Trier par date pour cohérence d'affichage
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .forEach(exchange => {
                      const { date, period } = exchange;
                      if (!exchangesByDate[date]) {
                        exchangesByDate[date] = { M: [], AM: [], S: [] };
                      }
                      exchangesByDate[date][period].push(exchange);
                    });
                  
                  // Rendu des cellules du jour
                  return days.map(day => {
                    try {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayNum = day.getDate();
                      
                      // Vérifier si c'est un week-end ou un jour férié
                      let isWeekend = false;
                      try {
                        isWeekend = isGrayedOut(day);
                      } catch (error) {
                        console.error("Erreur avec isGrayedOut:", error);
                      }
                      
                      // Vérifier si c'est aujourd'hui
                      let isToday = false;
                      try {
                        isToday = isSameDay(today, day);
                      } catch (error) {
                        console.error("Erreur avec isSameDay:", error);
                      }
                      
                      // Récupérer les gardes de l'utilisateur pour cette date
                      const userShifts: Record<string, boolean> = {};
                      ['M', 'AM', 'S'].forEach(period => {
                        const key = `${dateStr}-${period}`;
                        userShifts[period] = Boolean(userAssignments[key]);
                      });
                      
                      // Récupérer les échanges disponibles pour cette date
                      const dayExchanges = exchangesByDate[dateStr] || { M: [], AM: [], S: [] };
                      
                      return (
                        <div 
                          key={dateStr}
                          className={`
                            relative overflow-hidden
                            ${isMobile ? 'p-0.5 min-h-[52px]' : 'p-1.5 ' + (calendarViewMode === 'week' ? 'min-h-[120px]' : 'min-h-[100px]')}
                            rounded ${isMobile ? 'shadow-sm' : 'border'} transition-all duration-200
                            ${isToday ? 'border-indigo-400' : isMobile ? 'border-transparent' : 'border-gray-200'}
                            ${isWeekend ? 'bg-gray-100/80 shadow-inner' : 'bg-white'}
                            ${selectedDate === dateStr ? 'ring-2 ring-indigo-400 shadow-md' : ''}
                          `}
                          onClick={() => handleSelectDate(dateStr)}
                        >
                          {/* En-tête de la cellule avec numéro du jour - adapté au tactile et format d'écran */}
                          <div className={`flex justify-between items-center relative z-10 ${isMobile ? 'mb-0' : 'mb-1'}`}>
                            {isWeekend && (
                              <span className="absolute top-0 left-0 w-full h-full border-t-2 border-gray-200 rounded-t-md opacity-40 z-0"></span>
                            )}
                            {isMobile ? (
                              <div className="flex items-center gap-0.5">
                                <span className={`text-[7px] w-3 ${isWeekend ? 'text-gray-600 font-semibold' : 'text-gray-500'}`}>
                                  {format(day, 'EEE', { locale: fr }).substring(0, 1)}
                                </span>
                                <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] font-medium transition-colors 
                                  ${isToday ? 'bg-indigo-500 text-white' : isWeekend ? 'bg-gray-200 text-gray-800 shadow-sm' : 'text-gray-700'} 
                                  ${selectedDate === dateStr ? 'ring-1 ring-indigo-300' : isWeekend ? 'ring-1 ring-gray-400' : ''}`}>
                                  {dayNum}
                                </span>
                              </div>
                            ) : (
                              <span className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors 
                                ${isToday ? 'bg-indigo-500 text-white' : isWeekend ? 'bg-gray-200 text-gray-800 shadow-sm' : 'text-gray-700'} 
                                ${selectedDate === dateStr ? 'ring-1 ring-indigo-300' : isWeekend ? 'ring-1 ring-gray-400' : ''}`}>
                                {dayNum}
                              </span>
                            )}
                            
                            {/* Indicateur de nombre total de gardes disponibles pour les petits écrans */}
                            {isMobile && (() => {
                              const dayExchanges = exchangesByDate[dateStr] || { M: [], AM: [], S: [] };
                              const totalShifts = dayExchanges.M.length + dayExchanges.AM.length + dayExchanges.S.length;
                              if (totalShifts > 0) {
                                return (
                                  <div className="flex items-center">
                                    <span className="flex items-center justify-center h-4 w-4 text-[9px] font-bold bg-indigo-500 text-white rounded-full shadow-sm">
                                      {totalShifts}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          
                          {/* Section des gardes (personnelles et disponibles) */}
                          <div className={`${isMobile ? 'mt-1' : 'mt-0.5'}`}>
                            {/* Gardes par période - ordre adapté pour la lisibilité */}
                            {['M', 'AM', 'S'].map(period => {
                              const hasUserShift = userShifts[period];
                              const dayPeriodExchanges = dayExchanges[period] || [];
                              const hasPeriodExchanges = dayPeriodExchanges.length > 0;
                              
                              if (!hasUserShift && !hasPeriodExchanges) return null;
                              
                              return (
                                <div key={`period-${period}`} className={`${isMobile ? 'mb-0.5 relative pl-1.5' : 'mb-1'}`}>
                                  {/* Indicateur de période pour mobile */}
                                  {isMobile && (
                                    <div className={`
                                      absolute left-0 h-full w-0.5 rounded-full
                                      ${period === 'M' ? 'bg-amber-400' : period === 'AM' ? 'bg-sky-400' : 'bg-violet-400'}
                                    `}></div>
                                  )}
                                  {/* Badges groupés sans label de période - espacement adapté mobile */}
                                  <div className={`flex flex-wrap ${isMobile ? 'gap-1.5' : 'gap-0.5'} items-center`}>
                                    {/* Garde de l'utilisateur */}
                                    {hasUserShift && (() => {
                                      const key = `${dateStr}-${period}`;
                                      const assignment = userAssignments[key];
                                      
                                      return (
                                        <div 
                                          key={`my-${period}`} 
                                          className={`
                                            inline-block text-center
                                            ${isMobile 
                                              ? 'text-[8px] min-w-[22px] px-1 py-0.5 font-semibold' 
                                              : 'text-[9px] min-w-[24px] px-1.5 py-0.5 font-medium'
                                            } 
                                            rounded-sm bg-indigo-100 text-indigo-700 border border-indigo-300 shadow-sm
                                          `}
                                          title="Ma garde"
                                        >
                                          {assignment?.shiftType || period}
                                        </div>
                                      );
                                    })()}
                                    
                                    {/* Gardes disponibles - toujours affichées sauf celles de l'utilisateur */}
                                    {hasPeriodExchanges && dayPeriodExchanges
                                      // Filtrer pour ne pas afficher les gardes proposées par l'utilisateur
                                      .filter(exchange => exchange.userId !== user?.id)
                                      .map(exchange => {
                                        const isInterested = exchange.interestedUsers?.includes(user?.id || '');
                                        const hasConflict = conflictStates[exchange.id];
                                        
                                        // Choix des couleurs selon les états
                                        let bgColor, textColor, borderColor, hoverBgColor;
                                        let indicator = null;
                                        
                                        // Couleurs plus vives selon période (encore plus contrastées pour mobile)
                                        if (period === 'M') {
                                          bgColor = isMobile ? "bg-amber-200" : "bg-amber-100";
                                          textColor = "text-amber-900";
                                          borderColor = isMobile ? "border-amber-400" : "border-amber-300";
                                          hoverBgColor = "hover:bg-amber-200";
                                        } else if (period === 'AM') {
                                          bgColor = isMobile ? "bg-sky-200" : "bg-sky-100";
                                          textColor = "text-sky-900";
                                          borderColor = isMobile ? "border-sky-400" : "border-sky-300";
                                          hoverBgColor = "hover:bg-sky-200";
                                        } else {
                                          bgColor = isMobile ? "bg-violet-200" : "bg-violet-100";
                                          textColor = "text-violet-900";
                                          borderColor = isMobile ? "border-violet-400" : "border-violet-300";
                                          hoverBgColor = "hover:bg-violet-200";
                                        }
                                        
                                        // Ajouter un indicateur et des styles pour les gardes intéressées
                                        if (isInterested) {
                                          if (hasConflict) {
                                            // Indicateur rouge et bordure pour conflit - plus visible sur mobile
                                            indicator = !isMobile 
                                              ? <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                              : null; // Sur mobile, on utilise un élément différent pour l'indicateur
                                            borderColor = "border-red-500";
                                            bgColor = period === 'M' ? "bg-amber-50" : period === 'AM' ? "bg-sky-50" : "bg-violet-50";
                                          } else {
                                            // Indicateur vert et bordure pour intérêt sans conflit - plus visible sur mobile
                                            indicator = !isMobile 
                                              ? <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                                              : null; // Sur mobile, on utilise un élément différent pour l'indicateur
                                            borderColor = "border-green-500";
                                            // Garde la couleur de fond mais ajoute une bordure verte
                                          }
                                        }
                                        
                                        return (
                                          <button
                                            key={exchange.id}
                                            onClick={(e) => {
                                              e.stopPropagation(); // Éviter de déclencher le handleSelectDate du parent
                                              handleToggleInterest(exchange);
                                            }}
                                            disabled={isInteractionDisabled}
                                            className={`
                                              relative truncate border transition-all font-medium touch-manipulation
                                              ${isMobile
                                                ? 'text-[9px] min-w-[28px] h-[24px] px-1.5 py-0.5 font-semibold' 
                                                : 'text-[11px] min-w-[24px] h-[28px] px-2 py-1'
                                              }
                                              ${isMobile ? 'rounded' : 'rounded-sm'}
                                              cursor-pointer hover:shadow-md active:translate-y-0.5
                                              ${bgColor} ${textColor} ${borderColor} ${hoverBgColor}
                                              ${isInteractionDisabled ? 'opacity-50' : ''}
                                              ${(isInterested) ? 'shadow-md ring-2 ring-opacity-60 z-10 ' + (hasConflict ? 'ring-red-500' : 'ring-green-500') : ''}
                                              ${isInterested && isMobile ? 'scale-110' : ''}
                                            `}
                                            title={`${exchange.shiftType} - ${users.find(u => u.id === exchange.userId)?.fullName || 'Utilisateur'}${hasConflict ? ' (Conflit potentiel)' : ''}`}
                                          >
                                            {exchange.shiftType}
                                            {indicator}
                                            {isInterested && isMobile && (
                                              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${hasConflict ? 'bg-red-500' : 'bg-green-500'} shadow-sm`}></span>
                                            )}
                                          </button>
                                        );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    } catch (error) {
                      console.error("Erreur lors du rendu d'une cellule de jour:", error);
                      // Cellule de secours en cas d'erreur
                      return (
                        <div key={`error-${Math.random()}`} className={`${isMobile ? 'min-h-[50px]' : 'min-h-[100px]'} bg-red-50/20 border border-gray-200`}></div>
                      );
                    }
                  });
                } catch (error) {
                  console.error("Erreur globale lors du rendu du calendrier:", error);
                  return null;
                }
              })()}
            </div>
            
            {/* Légende */}
            <div className="mt-3 border-t border-gray-200 pt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-600">
              {isMobile ? (
                // Version compacte pour mobile
                <>
                  <div className="flex items-center gap-1 bg-gray-50 rounded px-1 py-0.5">
                    <span className="inline-block min-w-[15px] px-0.5 py-px bg-gray-100 rounded-sm border border-gray-200 text-[8px] text-center text-gray-500">A</span>
                    <span className="text-[9px]">Mes gardes</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 rounded px-1 py-0.5">
                    <span className="inline-block min-w-[15px] px-0.5 py-px bg-amber-100 rounded-sm border border-amber-300 text-[8px] text-center font-medium text-amber-900">A</span>
                    <span className="text-[9px]">Matin</span>
                  </div>
                  <div className="flex items-center gap-1 bg-sky-50 rounded px-1 py-0.5">
                    <span className="inline-block min-w-[15px] px-0.5 py-px bg-sky-100 rounded-sm border border-sky-300 text-[8px] text-center font-medium text-sky-900">A</span>
                    <span className="text-[9px]">AM</span>
                  </div>
                  <div className="flex items-center gap-1 bg-violet-50 rounded px-1 py-0.5">
                    <span className="inline-block min-w-[15px] px-0.5 py-px bg-violet-100 rounded-sm border border-violet-300 text-[8px] text-center font-medium text-violet-900">A</span>
                    <span className="text-[9px]">Soir</span>
                  </div>
                  <div className="w-full flex justify-between gap-2 mt-1.5">
                    <div className="flex items-center gap-1 relative">
                      <div className="relative scale-105">
                        <span className="inline-block min-w-[18px] px-0.5 py-px bg-amber-100 rounded-sm border-2 border-green-500 text-[8px] text-center font-medium text-amber-900 shadow-sm">A</span>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                      </div>
                      <span className="text-[9px] font-medium">Intéressé</span>
                    </div>
                    <div className="flex items-center gap-1 relative">
                      <div className="relative scale-105">
                        <span className="inline-block min-w-[18px] px-0.5 py-px bg-amber-50 rounded-sm border-2 border-red-500 text-[8px] text-center font-medium text-amber-900 shadow-sm">A</span>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                      </div>
                      <span className="text-[9px] font-medium">Conflit</span>
                    </div>
                  </div>
                </>
              ) : (
                // Version standard pour desktop
                <>
                  <div className="flex items-center gap-1">
                    <span className="inline-block min-w-[20px] px-1 py-0.5 bg-gray-100 rounded-sm border border-gray-200 text-[9px] text-center text-gray-500">A</span>
                    <span>Mes gardes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block min-w-[20px] px-1 py-0.5 bg-amber-100 rounded-sm border border-amber-300 text-[11px] text-center font-medium text-amber-900">A</span>
                    <span>Matin</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block min-w-[20px] px-1 py-0.5 bg-sky-100 rounded-sm border border-sky-300 text-[11px] text-center font-medium text-sky-900">A</span>
                    <span>Après-midi</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block min-w-[20px] px-1 py-0.5 bg-violet-100 rounded-sm border border-violet-300 text-[11px] text-center font-medium text-violet-900">A</span>
                    <span>Soir</span>
                  </div>
                  <div className="flex items-center gap-1 relative">
                    <div className="relative">
                      <span className="inline-block min-w-[20px] px-1 py-0.5 bg-amber-100 rounded-sm border-2 border-green-500 text-[11px] text-center font-medium text-amber-900 shadow-sm">A</span>
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                    </div>
                    <span>Intéressé</span>
                  </div>
                  <div className="flex items-center gap-1 relative">
                    <div className="relative">
                      <span className="inline-block min-w-[20px] px-1 py-0.5 bg-amber-50 rounded-sm border-2 border-red-500 text-[11px] text-center font-medium text-amber-900 shadow-sm">A</span>
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </div>
                    <span>Conflit</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmation pour les conflits */}
      <ConflictModal
        isOpen={showConflictModal}
        onClose={handleCloseConflictModal}
        onConfirm={handleConfirmConflict}
        exchange={conflictExchange}
        exchangeUser={exchangeUser}
        helpText={conflictHelpText}
      />

      {/* Modal pour afficher les commentaires sur mobile */}
      <CommentModalView
        isOpen={!!showCommentModal}
        onClose={() => setShowCommentModal(null)}
        comment={showCommentModal?.comment || ''}
      />

      {/* Modal pour afficher l'aperçu du planning */}
      <PlanningPreviewModal
        isOpen={!!showPlanningPreview}
        onClose={() => setShowPlanningPreview(null)}
        date={showPlanningPreview?.date || ''}
        assignments={userAssignments}
        position={showPlanningPreview?.position || { x: 0, y: 0 }}
      />
    </div>
  );
};

export default ShiftExchangePage;
