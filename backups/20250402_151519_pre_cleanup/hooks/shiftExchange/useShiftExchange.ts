import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from "../../../features/auth/hooks";
import { useUsers } from '../../context/UserContext';
import { useBagPhase } from '../../context/BagPhaseContext';
import { getShiftExchanges, toggleInterest } from '../../lib/firebase/shifts';
import type { ShiftExchange, ShiftAssignment, ExchangeHistory, GeneratedPlanning } from '../../types/planning';
import type { User } from '../../types/users';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
from "../../lib/firebase/config";

export const useShiftExchange = () => {
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
  const [conflictDetails, setConflictDetails] = useState<Record<string, {
    date: string;
    period: string;
    shiftType: string;
  }>>({});

  // États de filtrage et d'affichage
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [showOwnShifts, setShowOwnShifts] = useState(true);
  const [showMyInterests, setShowMyInterests] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // État pour les gardes reçues
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});
  
  // Fonction pour vérifier les conflits
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
  
  // Traitement de la manifestation d'intérêt
  const processToggleInterest = useCallback(async (exchangeId: string) => {
    if (!user) return false;

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
      
      // Animations visuelles après confirmation
      const badgeElement = document.getElementById(`shift-badge-${exchangeId}`);
      if (badgeElement) {
        // Vérifier si l'utilisateur a manifesté de l'intérêt après la mise à jour
        const exchange = exchanges.find(e => e.id === exchangeId);
        const isInterestedAfterUpdate = exchange?.interestedUsers?.includes(user.id) || false;
        
        // Si c'est un nouvel intérêt, ajouter l'animation
        if (isInterestedAfterUpdate && !badgeElement.classList.contains('shift-badge-interested')) {
          badgeElement.classList.add('shift-badge-ripple');
          // Ajouter la classe "intéressé" après un court délai
          setTimeout(() => {
            badgeElement.classList.remove('shift-badge-ripple');
            badgeElement.classList.add('shift-badge-interested');
          }, 800);
        }
        // Dans le cas d'une annulation, on ne fait rien ici car c'est déjà géré dans GroupedShiftExchangeList
      }
      
      setToast({
        visible: true,
        message: 'Intérêt mis à jour avec succès',
        type: 'success'
      });
      
      return true;
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
      
      return false;
    }
  }, [user, exchanges]);

  const handleCloseConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setConflictExchange(null);
    setExchangeUser(null);
  }, []);

  const handleConfirmConflict = useCallback(async () => {
    if (!conflictExchange) return;
    
    const result = await processToggleInterest(conflictExchange.id);
    handleCloseConflictModal();
    return result;
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

    const { hasConflict, conflictDetails: details } = await checkForConflict(exchange);
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
      if (details) {
        const key = `${exchange.date}-${exchange.period}`;
        setConflictDetails(prev => ({
          ...prev,
          [key]: details
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
              
              results.forEach(({ id, hasConflict, conflictDetails: details, key }) => {
                newConflictStates[id] = hasConflict;
                if (hasConflict && details) {
                  newConflictDetails[key] = details;
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

  // Filtrer les échanges selon les paramètres
  const filteredExchanges = exchanges
    .filter(exchange => showOwnShifts || exchange.userId !== user?.id)
    .filter(exchange => !showMyInterests || exchange.interestedUsers?.includes(user?.id || ''))
    .sort((a, b) => a.date.localeCompare(b.date));
    
  // Vérifier si les interactions doivent être désactivées
  const isInteractionDisabled = bagPhaseConfig.phase !== 'submission';
  
  // Chaîne de description pour aider l'utilisateur à comprendre les conflits
  const conflictHelpText = "Cela signifie que vous avez déjà une garde. Vous pouvez quand même vous positionner, un échange sera proposé sous validation de l'administrateur.";

  return {
    // États
    user,
    users,
    bagPhaseConfig,
    exchanges,
    filteredExchanges,
    loading,
    userAssignments,
    toast,
    setToast,
    showConflictModal,
    conflictExchange,
    exchangeUser,
    showCommentModal, 
    setShowCommentModal,
    showPlanningPreview, 
    setShowPlanningPreview,
    conflictStates,
    receivedShifts,
    selectedDate, 
    setSelectedDate,
    showOwnShifts, 
    setShowOwnShifts,
    showMyInterests, 
    setShowMyInterests,
    viewMode, 
    setViewMode,
    isInteractionDisabled,
    conflictHelpText,
    
    // Méthodes
    checkForConflict,
    processToggleInterest,
    handleCloseConflictModal,
    handleConfirmConflict,
    handleToggleInterest,
    handleSelectDate
  };
};