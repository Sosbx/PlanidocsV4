import { useCallback, useState } from 'react';
import { toggleInterest, getShiftExchanges } from '../../lib/firebase/shifts';
import { useAuth } from "../../../features/auth/hooks";
import useConflictCheck from '../useConflictCheck';
import type { ShiftExchange } from '../../types/planning';
import type { User } from '../../types/users';

interface UseShiftInteractionProps {
  bagPhaseConfig: {
    phase: string;
  };
}

interface UseShiftInteractionResult {
  processToggleInterest: (exchangeId: string) => Promise<boolean>;
  handleToggleInterest: (exchange: ShiftExchange) => Promise<void>;
  showConflictModal: boolean;
  setShowConflictModal: (show: boolean) => void;
  conflictExchange: ShiftExchange | null;
  setConflictExchange: (exchange: ShiftExchange | null) => void;
  exchangeUser: User | null;
  setExchangeUser: (user: User | null) => void;
  handleCloseConflictModal: () => void;
  handleConfirmConflict: () => Promise<void>;
}

export default function useShiftInteraction(
  users: User[],
  conflictStates: Record<string, boolean>,
  setConflictDetails: (conflictDetails: Record<string, any>) => void,
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }) => void,
  { bagPhaseConfig }: UseShiftInteractionProps
): UseShiftInteractionResult {
  const { user } = useAuth();
  const { checkForConflict } = useConflictCheck();
  
  // Le setter pour les toasts est fourni en paramètre
  
  // États des modals
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictExchange, setConflictExchange] = useState<ShiftExchange | null>(null);
  const [exchangeUser, setExchangeUser] = useState<User | null>(null);

  // Traiter l'affichage et la fermeture du modal de conflit
  const handleCloseConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setConflictExchange(null);
    setExchangeUser(null);
  }, []);

  // Définir processToggleInterest avant de l'utiliser dans d'autres hooks
  const processToggleInterest = useCallback(async (exchangeId: string) => {
    if (!user) return false;

    try {
      // Mise à jour optimiste de l'état local (ce sera géré dans le composant parent)
      
      // Effectuer la mise à jour sur le serveur
      await toggleInterest(exchangeId, user.id);
      
      // Animations visuelles seront gérées dans le composant
      
      setToast({
        visible: true,
        message: 'Intérêt mis à jour avec succès',
        type: 'success'
      });
      
      return true;
    } catch (error) {
      // En cas d'erreur, recharger les données pour s'assurer de la cohérence
      
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
  }, [user]);
  
  const handleConfirmConflict = useCallback(async () => {
    if (!conflictExchange) return;
    
    // Procéder à la mise à jour de l'intérêt, même avec un conflit
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
        setConflictDetails({
          ...conflictDetails,
          [key]: conflictDetails
        });
      }
    } else {
      // Pas de conflit, on peut exprimer l'intérêt directement
      await processToggleInterest(exchange.id);
    }
  }, [user, bagPhaseConfig.phase, users, checkForConflict, processToggleInterest, setConflictDetails]);

  return {
    processToggleInterest,
    handleToggleInterest,
    showConflictModal,
    setShowConflictModal,
    conflictExchange,
    setConflictExchange,
    exchangeUser,
    setExchangeUser,
    handleCloseConflictModal,
    handleConfirmConflict
  };
};