import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DirectExchangeDocument } from '@/api/interfaces/IDirectExchangeRepository';
import { DirectExchangeProposal } from '@/features/directExchange/types';
import { getDirectExchangeRepository } from '@/api/repositories';
import { useAssociation } from '../association/AssociationContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { ShiftAssignment } from '@/types/planning';
import { OperationType, ShiftPeriod } from '@/types/exchange';

/**
 * Type pour le contexte des échanges directs
 */
interface DirectExchangeContextType {
  // État
  exchanges: DirectExchangeDocument[];
  myExchanges: DirectExchangeDocument[];
  proposals: DirectExchangeProposal[];
  myProposals: DirectExchangeProposal[];
  loading: boolean;
  error: string | null;
  
  // Actions sur les échanges
  createExchange: (
    assignment: ShiftAssignment,
    operationTypes: OperationType[],
    comment?: string
  ) => Promise<DirectExchangeDocument | null>;
  
  cancelExchange: (exchangeId: string) => Promise<void>;
  
  // Actions sur les propositions
  createProposal: (
    targetExchangeId: string,
    targetUserId: string,
    proposalType: 'take' | 'exchange' | 'both' | 'replacement',
    targetShift: any,
    proposedShifts: any[],
    comment: string
  ) => Promise<void>;
  
  acceptProposal: (proposalId: string, exchangeId: string) => Promise<void>;
  rejectProposal: (proposalId: string) => Promise<void>;
  
  // Filtrage et recherche
  searchExchanges: (filters: {
    operationTypes?: OperationType[];
    period?: ShiftPeriod;
    dateRange?: { start: Date; end: Date };
  }) => DirectExchangeDocument[];
  
  // Remplacements
  replacementRequests: DirectExchangeDocument[];
  canViewReplacements: boolean;
  
  // Rafraîchissement
  refresh: () => Promise<void>;
}

const DirectExchangeContext = createContext<DirectExchangeContextType | undefined>(undefined);

/**
 * Provider pour le contexte des échanges directs utilisant le repository
 */
export const DirectExchangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exchanges, setExchanges] = useState<DirectExchangeDocument[]>([]);
  const [myExchanges, setMyExchanges] = useState<DirectExchangeDocument[]>([]);
  const [proposals, setProposals] = useState<DirectExchangeProposal[]>([]);
  const [myProposals, setMyProposals] = useState<DirectExchangeProposal[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<DirectExchangeDocument[]>([]);
  const [canViewReplacements, setCanViewReplacements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { currentAssociation } = useAssociation();
  const { user: currentUser } = useCurrentUser();
  const { showToast } = useToast();
  
  const unsubscribeExchangesRef = useRef<(() => void) | null>(null);
  const unsubscribeProposalsRef = useRef<(() => void) | null>(null);

  /**
   * Charger les données initiales et s'abonner aux changements
   */
  useEffect(() => {
    // Nettoyer les souscriptions précédentes
    if (unsubscribeExchangesRef.current) {
      unsubscribeExchangesRef.current();
      unsubscribeExchangesRef.current = null;
    }
    if (unsubscribeProposalsRef.current) {
      unsubscribeProposalsRef.current();
      unsubscribeProposalsRef.current = null;
    }

    if (!currentAssociation || !currentUser) {
      setExchanges([]);
      setMyExchanges([]);
      setProposals([]);
      setMyProposals([]);
      setReplacementRequests([]);
      setLoading(false);
      return;
    }

    const repository = getDirectExchangeRepository(currentAssociation);

    // Vérifier si l'utilisateur peut voir les remplacements
    repository.canViewReplacements(currentUser.id, currentAssociation)
      .then(setCanViewReplacements)
      .catch(console.error);

    // S'abonner aux échanges
    const unsubscribeExchanges = repository.subscribeToExchanges(
      currentUser.id,
      currentAssociation,
      (updatedExchanges) => {
        setExchanges(updatedExchanges);
        
        // Filtrer mes échanges
        const mine = updatedExchanges.filter(e => e.userId === currentUser.id);
        setMyExchanges(mine);
        
        // Filtrer les remplacements si l'utilisateur peut les voir
        if (canViewReplacements) {
          const replacements = updatedExchanges.filter(e => 
            e.operationTypes.includes('replacement' as OperationType)
          );
          setReplacementRequests(replacements);
        }
        
        setLoading(false);
        setError(null);
      }
    );

    // S'abonner aux propositions
    const unsubscribeProposals = repository.subscribeToProposals(
      currentUser.id,
      currentAssociation,
      (updatedProposals) => {
        setMyProposals(updatedProposals);
        
        // Charger aussi les propositions reçues sur mes échanges
        Promise.all(
          myExchanges.map(exchange => 
            repository.getProposalsForExchange(exchange.id, currentAssociation)
          )
        ).then(proposalArrays => {
          const allProposals = proposalArrays.flat();
          setProposals(allProposals);
        });
      }
    );

    unsubscribeExchangesRef.current = unsubscribeExchanges;
    unsubscribeProposalsRef.current = unsubscribeProposals;

    // Nettoyer lors du démontage
    return () => {
      if (unsubscribeExchangesRef.current) {
        unsubscribeExchangesRef.current();
        unsubscribeExchangesRef.current = null;
      }
      if (unsubscribeProposalsRef.current) {
        unsubscribeProposalsRef.current();
        unsubscribeProposalsRef.current = null;
      }
    };
  }, [currentAssociation, currentUser, canViewReplacements]);

  /**
   * Créer un nouvel échange
   */
  const createExchange = useCallback(async (
    assignment: ShiftAssignment,
    operationTypes: OperationType[],
    comment?: string
  ): Promise<DirectExchangeDocument | null> => {
    if (!currentAssociation || !currentUser) {
      throw new Error('Association ou utilisateur non défini');
    }

    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      
      // Déterminer la période
      const period = assignment.period || assignment.type;
      if (!period || !['M', 'AM', 'S'].includes(period)) {
        throw new Error(`Période invalide: ${period}`);
      }

      // Convertir en enum ShiftPeriod
      let periodEnum: ShiftPeriod;
      switch (period) {
        case 'M':
          periodEnum = ShiftPeriod.MORNING;
          break;
        case 'AM':
          periodEnum = ShiftPeriod.AFTERNOON;
          break;
        case 'S':
          periodEnum = ShiftPeriod.EVENING;
          break;
        default:
          throw new Error(`Période invalide: ${period}`);
      }

      const exchange = await repository.createExchange({
        userId: currentUser.id,
        date: assignment.date,
        period: periodEnum,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        operationTypes,
        comment: comment || '',
        status: 'pending',
        interestedUsers: [],
        hasProposals: false
      }, currentAssociation);

      showToast({
        type: 'success',
        message: 'Échange créé avec succès'
      });

      return exchange;
    } catch (error) {
      console.error('Erreur lors de la création de l\'échange:', error);
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la création'
      });
      throw error;
    }
  }, [currentAssociation, currentUser, showToast]);

  /**
   * Annuler un échange
   */
  const cancelExchange = useCallback(async (exchangeId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      await repository.cancelExchange(exchangeId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Échange annulé'
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de l\'annulation'
      });
      throw error;
    }
  }, [currentAssociation, showToast]);

  /**
   * Créer une proposition
   */
  const createProposal = useCallback(async (
    targetExchangeId: string,
    targetUserId: string,
    proposalType: 'take' | 'exchange' | 'both' | 'replacement',
    targetShift: any,
    proposedShifts: any[],
    comment: string
  ) => {
    if (!currentAssociation || !currentUser) return;

    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      
      await repository.createProposal({
        targetExchangeId,
        targetUserId,
        proposingUserId: currentUser.id,
        proposalType,
        targetShift,
        proposedShifts,
        comment,
        status: 'pending'
      }, currentAssociation);

      showToast({
        type: 'success',
        message: 'Proposition envoyée'
      });
    } catch (error) {
      console.error('Erreur lors de la création de la proposition:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de l\'envoi de la proposition'
      });
      throw error;
    }
  }, [currentAssociation, currentUser, showToast]);

  /**
   * Accepter une proposition
   */
  const acceptProposal = useCallback(async (proposalId: string, exchangeId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      await repository.acceptProposal(proposalId, exchangeId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Proposition acceptée'
      });
    } catch (error) {
      console.error('Erreur lors de l\'acceptation:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de l\'acceptation'
      });
      throw error;
    }
  }, [currentAssociation, showToast]);

  /**
   * Rejeter une proposition
   */
  const rejectProposal = useCallback(async (proposalId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      await repository.rejectProposal(proposalId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Proposition rejetée'
      });
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors du rejet'
      });
      throw error;
    }
  }, [currentAssociation, showToast]);

  /**
   * Rechercher des échanges avec filtres
   */
  const searchExchanges = useCallback((filters: {
    operationTypes?: OperationType[];
    period?: ShiftPeriod;
    dateRange?: { start: Date; end: Date };
  }): DirectExchangeDocument[] => {
    let filtered = exchanges.filter(e => e.userId !== currentUser?.id);

    if (filters.operationTypes && filters.operationTypes.length > 0) {
      filtered = filtered.filter(e => 
        e.operationTypes.some(type => filters.operationTypes!.includes(type))
      );
    }

    if (filters.period) {
      filtered = filtered.filter(e => e.period === filters.period);
    }

    if (filters.dateRange) {
      filtered = filtered.filter(e => {
        const exchangeDate = new Date(e.date);
        return exchangeDate >= filters.dateRange!.start && 
               exchangeDate <= filters.dateRange!.end;
      });
    }

    return filtered;
  }, [exchanges, currentUser]);

  /**
   * Rafraîchir les données
   */
  const refresh = useCallback(async () => {
    if (!currentAssociation || !currentUser) return;

    setLoading(true);
    try {
      const repository = getDirectExchangeRepository(currentAssociation);
      const freshExchanges = await repository.getActiveExchanges(currentAssociation);
      setExchanges(freshExchanges);
      
      // Mettre à jour les filtres
      const mine = freshExchanges.filter(e => e.userId === currentUser.id);
      setMyExchanges(mine);
      
      if (canViewReplacements) {
        const replacements = freshExchanges.filter(e => 
          e.operationTypes.includes('replacement' as OperationType)
        );
        setReplacementRequests(replacements);
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      setError('Erreur lors du rafraîchissement des données');
    } finally {
      setLoading(false);
    }
  }, [currentAssociation, currentUser, canViewReplacements]);

  const value: DirectExchangeContextType = {
    exchanges,
    myExchanges,
    proposals,
    myProposals,
    loading,
    error,
    createExchange,
    cancelExchange,
    createProposal,
    acceptProposal,
    rejectProposal,
    searchExchanges,
    replacementRequests,
    canViewReplacements,
    refresh
  };

  return (
    <DirectExchangeContext.Provider value={value}>
      {children}
    </DirectExchangeContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte des échanges directs
 */
export const useDirectExchanges = () => {
  const context = useContext(DirectExchangeContext);
  if (context === undefined) {
    throw new Error('useDirectExchanges must be used within a DirectExchangeProvider');
  }
  return context;
};