import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { ShiftExchangeDocument } from '@/api/interfaces/IShiftExchangeRepository';
import { getShiftExchangeRepository } from '@/api/repositories';
import { useAssociation } from '../association/AssociationContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { ShiftAssignment } from '@/types/planning';
import { ShiftPeriod } from '@/types/exchange';
import { BagPhase } from '@/features/shiftExchange/types';
import { BagPhaseConfig } from '@/types/planning';

/**
 * Type pour le contexte de la bourse aux gardes
 */
interface ShiftExchangeContextType {
  // État
  exchanges: ShiftExchangeDocument[];
  mySubmissions: ShiftExchangeDocument[];
  myInterests: ShiftExchangeDocument[];
  matchedExchanges: ShiftExchangeDocument[];
  loading: boolean;
  error: string | null;
  
  // Phase de la bourse
  currentPhase: BagPhase;
  phaseConfig: BagPhaseConfig | null;
  canSubmit: boolean;
  
  // Actions sur les échanges
  submitExchange: (
    assignment: ShiftAssignment,
    comment?: string
  ) => Promise<ShiftExchangeDocument | null>;
  
  cancelExchange: (exchangeId: string) => Promise<void>;
  
  // Actions sur les intérêts
  addInterest: (exchangeId: string) => Promise<void>;
  removeInterest: (exchangeId: string) => Promise<void>;
  
  // Actions sur les appariements
  validateMatch: (exchangeId: string, matchedUserId: string) => Promise<void>;
  rejectMatch: (exchangeId: string) => Promise<void>;
  
  // Filtrage et recherche
  searchExchanges: (filters: {
    period?: ShiftPeriod;
    dateRange?: { start: Date; end: Date };
    showOwnShifts?: boolean;
    showMyInterests?: boolean;
  }) => ShiftExchangeDocument[];
  
  // Vérifications
  userHasShiftAt: (date: string, period: ShiftPeriod) => Promise<boolean>;
  
  // Statistiques
  statistics: {
    totalExchanges: number;
    pendingExchanges: number;
    matchedExchanges: number;
    validatedExchanges: number;
  };
  
  // Rafraîchissement
  refresh: () => Promise<void>;
}

const ShiftExchangeContext = createContext<ShiftExchangeContextType | undefined>(undefined);

/**
 * Provider pour le contexte de la bourse aux gardes utilisant le repository
 */
export const ShiftExchangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exchanges, setExchanges] = useState<ShiftExchangeDocument[]>([]);
  const [mySubmissions, setMySubmissions] = useState<ShiftExchangeDocument[]>([]);
  const [myInterests, setMyInterests] = useState<ShiftExchangeDocument[]>([]);
  const [matchedExchanges, setMatchedExchanges] = useState<ShiftExchangeDocument[]>([]);
  const [currentPhase, setCurrentPhase] = useState<BagPhase>(BagPhase.CLOSED);
  const [phaseConfig, setPhaseConfig] = useState<BagPhaseConfig | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState({
    totalExchanges: 0,
    pendingExchanges: 0,
    matchedExchanges: 0,
    validatedExchanges: 0
  });
  
  const { currentAssociation } = useAssociation();
  const { user: currentUser } = useCurrentUser();
  const { showToast } = useToast();
  
  const unsubscribeExchangesRef = useRef<(() => void) | null>(null);
  const unsubscribePhaseRef = useRef<(() => void) | null>(null);

  /**
   * Charger les données initiales et s'abonner aux changements
   */
  useEffect(() => {
    // Nettoyer les souscriptions précédentes
    if (unsubscribeExchangesRef.current) {
      unsubscribeExchangesRef.current();
      unsubscribeExchangesRef.current = null;
    }
    if (unsubscribePhaseRef.current) {
      unsubscribePhaseRef.current();
      unsubscribePhaseRef.current = null;
    }

    if (!currentAssociation || !currentUser) {
      setExchanges([]);
      setMySubmissions([]);
      setMyInterests([]);
      setMatchedExchanges([]);
      setLoading(false);
      return;
    }

    const repository = getShiftExchangeRepository(currentAssociation);

    // S'abonner aux changements de phase
    const unsubscribePhase = repository.subscribeToPhaseChanges(
      currentAssociation,
      async (phase, config) => {
        setCurrentPhase(phase);
        setPhaseConfig(config);
        
        // Vérifier si les soumissions sont ouvertes
        const canSubmitNow = await repository.canSubmitExchange(currentAssociation);
        setCanSubmit(canSubmitNow);
        
        // Charger les appariements si en phase de validation
        if (phase === BagPhase.VALIDATION) {
          const matched = await repository.getMatchedExchanges(currentUser.id, currentAssociation);
          setMatchedExchanges(matched);
        }
      }
    );

    // S'abonner aux échanges
    const unsubscribeExchanges = repository.subscribeToShiftExchanges(
      currentUser.id,
      currentAssociation,
      async (updatedExchanges) => {
        setExchanges(updatedExchanges);
        
        // Filtrer mes soumissions
        const submissions = await repository.getMySubmissions(currentUser.id, currentAssociation);
        setMySubmissions(submissions);
        
        // Filtrer mes intérêts
        const interests = await repository.getMyInterests(currentUser.id, currentAssociation);
        setMyInterests(interests);
        
        // Mettre à jour les statistiques
        const stats = await repository.getBagStatistics(currentAssociation);
        setStatistics({
          totalExchanges: stats.totalExchanges,
          pendingExchanges: stats.pendingExchanges,
          matchedExchanges: stats.matchedExchanges,
          validatedExchanges: stats.validatedExchanges
        });
        
        setLoading(false);
        setError(null);
      }
    );

    unsubscribeExchangesRef.current = unsubscribeExchanges;
    unsubscribePhaseRef.current = unsubscribePhase;

    // Nettoyer lors du démontage
    return () => {
      if (unsubscribeExchangesRef.current) {
        unsubscribeExchangesRef.current();
        unsubscribeExchangesRef.current = null;
      }
      if (unsubscribePhaseRef.current) {
        unsubscribePhaseRef.current();
        unsubscribePhaseRef.current = null;
      }
    };
  }, [currentAssociation, currentUser]);

  /**
   * Soumettre une garde à la bourse
   */
  const submitExchange = useCallback(async (
    assignment: ShiftAssignment,
    comment?: string
  ): Promise<ShiftExchangeDocument | null> => {
    if (!currentAssociation || !currentUser) {
      throw new Error('Association ou utilisateur non défini');
    }

    if (!canSubmit) {
      showToast({
        type: 'error',
        message: 'Les soumissions ne sont pas ouvertes actuellement'
      });
      return null;
    }

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      
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

      const exchange = await repository.createShiftExchange({
        userId: currentUser.id,
        date: assignment.date,
        period: periodEnum,
        shiftType: assignment.shiftType,
        timeSlot: assignment.timeSlot,
        comment: comment || '',
        status: 'pending',
        interestedUsers: [],
        operationTypes: [],
        lastModified: createParisDate().toISOString()
      }, currentAssociation);

      showToast({
        type: 'success',
        message: 'Garde soumise à la bourse avec succès'
      });

      return exchange;
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la soumission'
      });
      throw error;
    }
  }, [currentAssociation, currentUser, canSubmit, showToast]);

  /**
   * Annuler une soumission
   */
  const cancelExchange = useCallback(async (exchangeId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      await repository.cancelShiftExchange(exchangeId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Soumission annulée'
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de l\'annulation'
      });
      throw error;
    }
  }, [currentAssociation, showToast]);

  /**
   * Marquer son intérêt pour une garde
   */
  const addInterest = useCallback(async (exchangeId: string) => {
    if (!currentAssociation || !currentUser) return;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      await repository.addInterestedUser(exchangeId, currentUser.id, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Intérêt marqué'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'intérêt:', error);
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de l\'ajout'
      });
      throw error;
    }
  }, [currentAssociation, currentUser, showToast]);

  /**
   * Retirer son intérêt pour une garde
   */
  const removeInterest = useCallback(async (exchangeId: string) => {
    if (!currentAssociation || !currentUser) return;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      await repository.removeInterestedUser(exchangeId, currentUser.id, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Intérêt retiré'
      });
    } catch (error) {
      console.error('Erreur lors du retrait de l\'intérêt:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors du retrait'
      });
      throw error;
    }
  }, [currentAssociation, currentUser, showToast]);

  /**
   * Valider un appariement
   */
  const validateMatch = useCallback(async (exchangeId: string, matchedUserId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      await repository.validateMatch(exchangeId, matchedUserId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Échange validé'
      });
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      showToast({
        type: 'error',
        message: 'Erreur lors de la validation'
      });
      throw error;
    }
  }, [currentAssociation, showToast]);

  /**
   * Rejeter un appariement
   */
  const rejectMatch = useCallback(async (exchangeId: string) => {
    if (!currentAssociation) return;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      await repository.rejectMatch(exchangeId, currentAssociation);
      
      showToast({
        type: 'success',
        message: 'Échange rejeté'
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
    period?: ShiftPeriod;
    dateRange?: { start: Date; end: Date };
    showOwnShifts?: boolean;
    showMyInterests?: boolean;
  }): ShiftExchangeDocument[] => {
    let filtered = [...exchanges];

    if (filters.showOwnShifts) {
      filtered = filtered.filter(e => e.userId === currentUser?.id);
    } else if (!filters.showMyInterests) {
      filtered = filtered.filter(e => e.userId !== currentUser?.id);
    }

    if (filters.showMyInterests && currentUser) {
      filtered = filtered.filter(e => e.interestedUsers?.includes(currentUser.id));
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
   * Vérifier si l'utilisateur a une garde à une date/période
   */
  const userHasShiftAt = useCallback(async (
    date: string,
    period: ShiftPeriod
  ): Promise<boolean> => {
    if (!currentAssociation || !currentUser) return false;

    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      return await repository.userHasShiftAt(currentUser.id, date, period, currentAssociation);
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      return false;
    }
  }, [currentAssociation, currentUser]);

  /**
   * Rafraîchir les données
   */
  const refresh = useCallback(async () => {
    if (!currentAssociation || !currentUser) return;

    setLoading(true);
    try {
      const repository = getShiftExchangeRepository(currentAssociation);
      
      // Recharger les données
      const freshExchanges = await repository.getActiveShiftExchanges(currentAssociation);
      setExchanges(freshExchanges);
      
      // Recharger mes soumissions et intérêts
      const submissions = await repository.getMySubmissions(currentUser.id, currentAssociation);
      setMySubmissions(submissions);
      
      const interests = await repository.getMyInterests(currentUser.id, currentAssociation);
      setMyInterests(interests);
      
      // Recharger les statistiques
      const stats = await repository.getBagStatistics(currentAssociation);
      setStatistics({
        totalExchanges: stats.totalExchanges,
        pendingExchanges: stats.pendingExchanges,
        matchedExchanges: stats.matchedExchanges,
        validatedExchanges: stats.validatedExchanges
      });
      
      // Vérifier la phase
      const phase = await repository.getCurrentPhase(currentAssociation);
      setCurrentPhase(phase);
      
      if (phase === BagPhase.VALIDATION) {
        const matched = await repository.getMatchedExchanges(currentUser.id, currentAssociation);
        setMatchedExchanges(matched);
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      setError('Erreur lors du rafraîchissement des données');
    } finally {
      setLoading(false);
    }
  }, [currentAssociation, currentUser]);

  const value: ShiftExchangeContextType = {
    exchanges,
    mySubmissions,
    myInterests,
    matchedExchanges,
    loading,
    error,
    currentPhase,
    phaseConfig,
    canSubmit,
    submitExchange,
    cancelExchange,
    addInterest,
    removeInterest,
    validateMatch,
    rejectMatch,
    searchExchanges,
    userHasShiftAt,
    statistics,
    refresh
  };

  return (
    <ShiftExchangeContext.Provider value={value}>
      {children}
    </ShiftExchangeContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte de la bourse aux gardes
 */
export const useShiftExchanges = () => {
  const context = useContext(ShiftExchangeContext);
  if (context === undefined) {
    throw new Error('useShiftExchanges must be used within a ShiftExchangeProvider');
  }
  return context;
};