import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, UserCheck, UserX, AlertTriangle, Info, ArrowLeftRight, Eye } from 'lucide-react';
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
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { GeneratedPlanning } from '../types/planning';
import type { User } from '../types/users';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ShiftExchangePage: React.FC = () => {
  const { user } = useAuth();
  const { users } = useUsers();
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAssignments, setUserAssignments] = useState<Record<string, ShiftAssignment>>({});
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictExchange, setConflictExchange] = useState<ShiftExchange | null>(null);
  const [exchangeUser, setExchangeUser] = useState<User | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [showCommentModal, setShowCommentModal] = useState<{ id: string; comment: string } | null>(null);
  const [conflictStates, setConflictStates] = useState<Record<string, boolean>>({});
  const { config: bagPhaseConfig } = useBagPhase();
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [showPlanningPreview, setShowPlanningPreview] = useState<{
    date: string;
    position: { x: number; y: number };
  } | null>(null);
  const [showOwnShifts, setShowOwnShifts] = useState(true);
  const [showMyInterests, setShowMyInterests] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'M' | 'AM' | 'S'>('all');
  const [receivedShifts, setReceivedShifts] = useState<Record<string, { 
    originalUserId: string; 
    newUserId: string; 
    isPermutation: boolean;
    shiftType: string;
    timeSlot: string;
  }>>({});
  
  // Écouter les changements dans la collection des échanges
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Écouter les échanges en temps réel
        const today = format(new Date(), 'yyyy-MM-dd');
        
        let unsubscribe: (() => void) | null = null;
        
        // Essayer d'abord avec un index composé
        try {
          const exchangesQuery = query(
            collection(db, 'shift_exchanges'),
            where('date', '>=', today),
            where('status', 'in', ['pending', 'unavailable'])
          );
          
          unsubscribe = onSnapshot(
            exchangesQuery,
            (snapshot) => {
              const exchangeData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as ShiftExchange[];
              
              exchangeData.sort((a, b) => {
                // D'abord par statut (pending avant unavailable)
                if (a.status === 'pending' && b.status === 'unavailable') return -1;
                if (a.status === 'unavailable' && b.status === 'pending') return 1;
                // Ensuite par date
                return a.date.localeCompare(b.date);
              });
              
              setExchanges(exchangeData);
              
              // Vérifier les conflits pour les nouveaux échanges
              const checkConflicts = async () => {
                if (!user) return;
                
                const states: Record<string, boolean> = {};
                for (const exchange of exchangeData) {
                  if (exchange.interestedUsers?.includes(user.id)) {
                    states[exchange.id] = await checkForConflict(exchange);
                  }
                }
                setConflictStates(states);
              };
              
              checkConflicts();
              setLoading(false);
            },
            (error) => {
              if (error instanceof Error && error.code === 'failed-precondition') {
                // L'index composé n'est pas prêt, utiliser une approche alternative
                fallbackQuery();
              } else {
                console.error('Error loading exchanges:', error);
                setToast({
                  visible: true,
                  message: 'Erreur lors du chargement des échanges',
                  type: 'error'
                });
                setLoading(false);
              }
            }
          );
        } catch (error) {
          console.warn('Failed to use composite index, falling back to simple query', error);
          fallbackQuery();
        }
        
        // Fonction de repli si l'index composé n'est pas disponible
        async function fallbackQuery() {
          console.log('Using fallback query without complex index');
          // Requête plus simple qui ne nécessite pas d'index composé
          const simpleQuery = query(
            collection(db, 'shift_exchanges')
          );
          
          unsubscribe = onSnapshot(
            simpleQuery,
            (snapshot) => {
              const allExchanges = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as ShiftExchange[];
              
              // Filtrer manuellement côté client
              const filteredExchanges = allExchanges.filter(exchange => 
                exchange.date >= today && 
                (exchange.status === 'pending' || exchange.status === 'unavailable')
              );
              
              filteredExchanges.sort((a, b) => {
                if (a.status === 'pending' && b.status === 'unavailable') return -1;
                if (a.status === 'unavailable' && b.status === 'pending') return 1;
                return a.date.localeCompare(b.date);
              });
              
              setExchanges(filteredExchanges);
              
              // Vérifier les conflits pour les nouveaux échanges
              const checkConflicts = async () => {
                if (!user) return;
                
                const states: Record<string, boolean> = {};
                for (const exchange of filteredExchanges) {
                  if (exchange.interestedUsers?.includes(user.id)) {
                    states[exchange.id] = await checkForConflict(exchange);
                  }
                }
                setConflictStates(states);
              };
              
              checkConflicts();
              setLoading(false);
            },
            (error) => {
              console.error('Error with fallback query:', error);
              setToast({
                visible: true,
                message: 'Erreur lors du chargement des échanges',
                type: 'error'
              });
              setLoading(false);
            }
          );
        }
        
        // Charger le planning de l'utilisateur
        const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
        if (planningDoc.exists()) {
          const planning = planningDoc.data() as GeneratedPlanning;
          setUserAssignments(planning.assignments || {});
        }

        // Charger l'historique des échanges pour trouver les gardes reçues
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
        
        // Écouter également les changements dans les échanges
        const unsubscribeExchangeHistory = onSnapshot(
          collection(db, 'exchange_history'),
          async () => {
            // Recharger l'historique des échanges quand il y a des changements
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
          },
          (error) => {
            console.error('Error monitoring exchange history:', error);
          }
        );
        
        return () => {
          if (unsubscribe) unsubscribe();
          unsubscribeExchangeHistory();
        };
      } catch (error) {
        console.error('Error loading data:', error);
        setToast({
          visible: true,
          message: 'Erreur lors du chargement des données',
          type: 'error'
        });
        setLoading(false);
        return () => {};
      }
    };
    
    const cleanup = loadData();
    return () => {
      cleanup.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [user]);

  const periodNames = {
    'M': 'Matin',
    'AM': 'Après-midi',
    'S': 'Soir'
  };

  const checkForConflict = async (exchange: ShiftExchange): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const planningDoc = await getDoc(doc(db, 'generated_plannings', user.id));
      if (!planningDoc.exists()) return false;
      
      const planning = planningDoc.data() as GeneratedPlanning;
      const assignmentKey = `${exchange.date}-${exchange.period}`;
      
      return Boolean(planning.assignments[assignmentKey]);
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return false;
    }
  };

  const handleToggleInterest = async (exchange: ShiftExchange) => {
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

    const hasConflict = await checkForConflict(exchange);
    const isAlreadyInterested = exchange.interestedUsers?.includes(user.id);

    if (hasConflict && !isAlreadyInterested) {
      const owner = users.find(u => u.id === exchange.userId);
      setConflictExchange(exchange);
      setExchangeUser(owner || null);
      setShowConflictModal(true);
    } else {
      await processToggleInterest(exchange.id);
    }
  };

  const processToggleInterest = async (exchangeId: string) => {
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
      
      const errorMessage = error instanceof Error && (error as any).code === 'EXCHANGE_UNAVAILABLE'
        ? 'Cette garde n\'est plus disponible'
        : 'Erreur lors de la mise à jour de l\'intérêt';
      
      setToast({
        visible: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const handleCloseConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setConflictExchange(null);
    setExchangeUser(null);
  }, []);

  const handleConfirmConflict = useCallback(async () => {
    if (!conflictExchange) return;
    
    await processToggleInterest(conflictExchange.id);
    handleCloseConflictModal();
  }, [conflictExchange, handleCloseConflictModal]);

  // Vérifier si les interactions doivent être désactivées (pendant la phase distribution)
  const isInteractionDisabled = bagPhaseConfig.phase !== 'submission';

  // Filtrer les échanges selon les paramètres
  const filteredExchanges = exchanges
    .filter(exchange => showOwnShifts || exchange.userId !== user?.id)
    .filter(exchange => !showMyInterests || exchange.interestedUsers?.includes(user?.id || ''))
    .filter(exchange => selectedPeriod === 'all' || exchange.period === selectedPeriod)
    .sort((a, b) => {
      // D'abord par date
      return a.date.localeCompare(b.date);
    });

  if (loading) {
    return <LoadingSpinner />;
  }

  // Fonction pour sélectionner une date (utilisée par le composant GroupedShiftExchangeList)
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toast 
        message={toast.message}
        isVisible={toast.visible}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bourse aux Gardes</h1>

      {/* Layout principal avec planning permanent et liste des gardes */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Planning personnel permanent */}
        <div className="w-full lg:w-2/3">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <BagPhaseIndicator />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOwnShifts}
                    onChange={(e) => setShowOwnShifts(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    disabled={isInteractionDisabled}
                  />
                  <span className="text-xs text-gray-700">Mes gardes</span>
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as 'all' | 'M' | 'AM' | 'S')}
                  className="text-xs border-gray-300 rounded-md"
                  disabled={isInteractionDisabled}
                >
                  <option value="all">Toutes</option>
                  <option value="M">Matin</option>
                  <option value="AM">AM</option>
                  <option value="S">Soir</option>
                </select>
              </div>
            </div>
            
            {bagPhaseConfig.phase === 'distribution' && (
              <div className="bg-yellow-50 px-3 py-2 border-b border-yellow-200">
                <p className="text-yellow-700 text-center text-xs font-medium">
                  Répartition en cours. Interactions temporairement désactivées.
                </p>
              </div>
            )}
          </div>
          
          {filteredExchanges.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-gray-500 text-center text-sm">
                Aucune garde disponible
              </p>
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

        {/* Planning fixe à droite */}
        <div className="w-full lg:w-1/3 lg:sticky lg:top-20 lg:self-start">
          <PermanentPlanningPreview
            assignments={userAssignments}
            selectedDate={selectedDate}
            className="lg:max-h-[calc(100vh-6rem)]"
          />
        </div>
      </div>
      
      {/* Modal de confirmation pour les conflits */}
      <ConflictModal
        isOpen={showConflictModal}
        onClose={handleCloseConflictModal}
        onConfirm={handleConfirmConflict}
        exchange={conflictExchange}
        exchangeUser={exchangeUser}
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
