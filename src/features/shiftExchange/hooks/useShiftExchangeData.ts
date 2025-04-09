import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../features/auth/hooks';
import { useUsers } from '../../../features/auth/hooks';
import { useBagPhase } from './useBagPhase';
import { getShiftExchanges } from '../../../lib/firebase/shifts';
import type { ShiftExchange, ShiftAssignment } from '../types';
import type { User } from '../../../features/users/types';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";

/**
 * Hook pour gérer les données de la bourse aux gardes
 * @returns Données et états pour la bourse aux gardes
 */
export const useShiftExchangeData = () => {
  // Hooks d'authentification et contexte
  const { user } = useAuth();
  const { users } = useUsers();
  const { config: bagPhaseConfig } = useBagPhase();

  // États principaux
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAssignments, setUserAssignments] = useState<Record<string, ShiftAssignment>>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  
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
      
      const planning = planningDoc.data() as any;
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
            const planning = planningDoc.data() as any;
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
            const history = doc.data() as any;
            
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
              const history = doc.data() as any;
              
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

  // Logique de filtrage simplifiée et centralisée
  const filteredExchanges = exchanges
    .filter(exchange => {
      // Vérifier si c'est une garde de l'utilisateur
      const isUserShift = exchange.userId === user?.id;
      
      // Vérifier si l'utilisateur est intéressé par cette garde
      const isUserInterested = exchange.interestedUsers?.includes(user?.id || '');
      
      // Filtre "Mes positions" : si activé, ne montrer QUE les gardes où l'utilisateur est intéressé
      if (showMyInterests) {
        return isUserInterested;
      }
      
      // Filtre "Mes gardes" : si désactivé, masquer uniquement les gardes de l'utilisateur
      if (!showOwnShifts && isUserShift) {
        return false;
      }
      
      // En phase "completed", ne montrer que les gardes de l'utilisateur
      if (bagPhaseConfig.phase === 'completed' && !isUserShift) {
        return false;
      }
      
      // Par défaut, montrer la garde
      return true;
    })
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
    conflictStates,
    setConflictDetails,
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
    handleSelectDate
  };
};

export default useShiftExchangeData;
