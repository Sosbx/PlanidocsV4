import { useState, useCallback } from 'react';
import { useAuth } from '../../auth/hooks';
import { 
  replacementService, 
  ProposeReplacementOptions, 
  RespondToReplacementOptions 
} from '../../../lib/firebase/directExchange/replacementTransactionService';

/**
 * Hook pour interagir avec le service de remplacement
 * Permet de proposer, accepter ou rejeter des remplacements
 */
export const useReplacementService = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Propose une garde en remplacement
   */
  const proposeReplacement = useCallback(async (options: ProposeReplacementOptions) => {
    if (!user) {
      setError('Vous devez être connecté pour proposer un remplacement');
      return { success: false, error: 'Utilisateur non connecté' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await replacementService.proposeReplacement(options);
      
      if (!result.success && result.error) {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la proposition de remplacement: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  /**
   * Répond à une proposition de remplacement (accepter/rejeter)
   */
  const respondToReplacement = useCallback(async (options: RespondToReplacementOptions) => {
    if (!user) {
      setError('Vous devez être connecté pour répondre à une proposition');
      return { success: false, error: 'Utilisateur non connecté' };
    }
    
    if (!user.roles.isReplacement) {
      setError('Seuls les remplaçants peuvent répondre aux propositions de remplacement');
      return { success: false, error: 'Permissions insuffisantes' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await replacementService.respondToReplacement(options);
      
      if (!result.success && result.error) {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la réponse à la proposition: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  /**
   * Récupère les propositions de remplacement pour l'utilisateur
   */
  const getReplacementProposals = useCallback(async () => {
    if (!user) {
      setError('Vous devez être connecté pour voir les propositions');
      return { proposals: [], error: 'Utilisateur non connecté' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await replacementService.getReplacementProposals();
      
      if (result.error) {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la récupération des propositions: ${errorMessage}`);
      return { proposals: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  /**
   * Récupère l'historique des remplacements
   */
  const getReplacementHistory = useCallback(async (options: {
    status?: 'proposed' | 'accepted' | 'rejected' | 'completed';
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}) => {
    if (!user) {
      setError('Vous devez être connecté pour voir l\'historique');
      return { history: [], error: 'Utilisateur non connecté' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await replacementService.getReplacementHistory({
        userId: user.id,
        ...options
      });
      
      if (result.error) {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la récupération de l'historique: ${errorMessage}`);
      return { history: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  /**
   * Annule une proposition de remplacement
   */
  const cancelReplacementProposal = useCallback(async (proposalId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour annuler une proposition');
      return { success: false, error: 'Utilisateur non connecté' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await replacementService.cancelReplacementProposal(proposalId);
      
      if (!result.success && result.error) {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de l'annulation de la proposition: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  return {
    proposeReplacement,
    respondToReplacement,
    getReplacementProposals,
    getReplacementHistory,
    cancelReplacementProposal,
    loading,
    error,
    isReplacementUser: user?.roles?.isReplacement || false
  };
};