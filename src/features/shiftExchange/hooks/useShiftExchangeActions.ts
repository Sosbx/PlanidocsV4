import { useCallback } from 'react';
import { useAuth } from '../../../features/auth/hooks';
import { useBagPhase } from './useBagPhase';
import { useShiftExchangeData } from './useShiftExchangeData';
import { useShiftInteraction } from './useShiftInteraction';
import { ShiftExchange } from '../types';
import { getShiftExchanges, toggleInterest } from '../../../lib/firebase/exchange';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";

interface UseShiftExchangeActionsResult {
  // Actions de création et modification
  createExchange: (exchange: Omit<ShiftExchange, 'id' | 'createdAt' | 'updatedAt' | 'lastModified'>) => Promise<string>;
  updateExchange: (exchange: ShiftExchange) => Promise<void>;
  deleteExchange: (exchangeId: string) => Promise<void>;
  
  // Actions d'interaction
  toggleInterest: (exchange: ShiftExchange) => Promise<void>;
  
  // États
  isInteractionDisabled: boolean;
  toast: { visible: boolean; message: string; type: 'success' | 'error' | 'info' };
  setToast: (toast: { visible: boolean; message: string; type: 'success' | 'error' | 'info' }) => void;
}

/**
 * Hook pour gérer les actions liées à la bourse aux gardes
 * @returns Fonctions et états pour les actions de la bourse aux gardes
 */
// Fonctions d'accès à Firestore
const createShiftExchange = async (exchange: any): Promise<string> => {
  const docRef = await addDoc(collection(db, 'shift_exchanges'), {
    ...exchange,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  });
  return docRef.id;
};

const updateShiftExchange = async (exchange: ShiftExchange): Promise<void> => {
  const exchangeRef = doc(db, 'shift_exchanges', exchange.id);
  await updateDoc(exchangeRef, {
    ...exchange,
    updatedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  });
};

const deleteShiftExchange = async (exchangeId: string): Promise<void> => {
  const exchangeRef = doc(db, 'shift_exchanges', exchangeId);
  await deleteDoc(exchangeRef);
};

export const useShiftExchangeActions = (): UseShiftExchangeActionsResult => {
  const { user } = useAuth();
  const { config } = useBagPhase();
  const { toast, setToast } = useShiftExchangeData();
  const { handleToggleInterest } = useShiftInteraction(
    [], // users - sera fourni par le composant
    {}, // conflictStates - sera fourni par le composant
    () => {}, // setConflictDetails - sera fourni par le composant
    setToast,
    { bagPhaseConfig: config }
  );
  
  // Vérifier si les interactions doivent être désactivées
  const isInteractionDisabled = config.phase !== 'submission';
  
  // Fonction pour créer un nouvel échange
  const createExchange = useCallback(async (
    exchange: Omit<ShiftExchange, 'id' | 'createdAt' | 'updatedAt' | 'lastModified'>
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to create an exchange');
    }
    
    if (isInteractionDisabled) {
      setToast({
        visible: true,
        message: 'La période de soumission est terminée',
        type: 'error'
      });
      throw new Error('Submission period is closed');
    }
    
    try {
      // Ajouter les propriétés manquantes
      const completeExchange = {
        ...exchange,
        userId: user.id,
        userName: user.fullName || `${user.firstName} ${user.lastName}` || user.email || 'Utilisateur',
        interestedUsers: [],
        status: 'pending' as const
      };
      
      // Créer l'échange dans Firestore
      const exchangeId = await createShiftExchange(completeExchange);
      
      setToast({
        visible: true,
        message: 'Échange créé avec succès',
        type: 'success'
      });
      
      return exchangeId;
    } catch (error) {
      console.error('Error creating exchange:', error);
      
      setToast({
        visible: true,
        message: 'Erreur lors de la création de l\'échange',
        type: 'error'
      });
      
      throw error;
    }
  }, [user, isInteractionDisabled, setToast]);
  
  // Fonction pour mettre à jour un échange
  const updateExchange = useCallback(async (exchange: ShiftExchange) => {
    if (!user) {
      throw new Error('User must be authenticated to update an exchange');
    }
    
    if (isInteractionDisabled) {
      setToast({
        visible: true,
        message: 'La période de soumission est terminée',
        type: 'error'
      });
      throw new Error('Submission period is closed');
    }
    
    try {
      // Vérifier que l'utilisateur est le propriétaire de l'échange
      if (exchange.userId !== user.id) {
        throw new Error('You can only update your own exchanges');
      }
      
      // Mettre à jour l'échange dans Firestore
      await updateShiftExchange(exchange);
      
      setToast({
        visible: true,
        message: 'Échange mis à jour avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating exchange:', error);
      
      setToast({
        visible: true,
        message: 'Erreur lors de la mise à jour de l\'échange',
        type: 'error'
      });
      
      throw error;
    }
  }, [user, isInteractionDisabled, setToast]);
  
  // Fonction pour supprimer un échange
  const deleteExchange = useCallback(async (exchangeId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete an exchange');
    }
    
    if (isInteractionDisabled) {
      setToast({
        visible: true,
        message: 'La période de soumission est terminée',
        type: 'error'
      });
      throw new Error('Submission period is closed');
    }
    
    try {
      // Supprimer l'échange dans Firestore
      await deleteShiftExchange(exchangeId);
      
      setToast({
        visible: true,
        message: 'Échange supprimé avec succès',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting exchange:', error);
      
      setToast({
        visible: true,
        message: 'Erreur lors de la suppression de l\'échange',
        type: 'error'
      });
      
      throw error;
    }
  }, [user, isInteractionDisabled, setToast]);
  
  // Fonction pour manifester de l'intérêt pour un échange
  const toggleInterest = useCallback(async (exchange: ShiftExchange) => {
    if (!user) {
      throw new Error('User must be authenticated to toggle interest');
    }
    
    await handleToggleInterest(exchange);
  }, [user, handleToggleInterest]);
  
  return {
    createExchange,
    updateExchange,
    deleteExchange,
    toggleInterest,
    isInteractionDisabled,
    toast,
    setToast
  };
};

export default useShiftExchangeActions;
