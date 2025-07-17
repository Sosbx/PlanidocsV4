import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBagPhase } from '../shiftExchange';
import { PlanningPeriod as PlanningPeriodType } from '../../types/planning';
import { subDays, isBefore } from 'date-fns';
import { useAssociation } from '../association/AssociationContext';
import { startOfDayParis, endOfDayParis, createParisDate, addMonthsParis } from '../../utils/timezoneUtils';
import { getPlanningRepository } from '../../api/implementations/PlanningRepository';
import { SimplePlanningPeriod } from '../../api/interfaces/IPlanningRepository';

/**
 * Type pour le contexte de période de planning
 */
interface PlanningPeriodContextType {
  // Périodes
  currentPeriod: SimplePlanningPeriod;
  futurePeriod: SimplePlanningPeriod | null;
  allPeriods: PlanningPeriodType[];
  
  // Statuts
  isBagActive: boolean;
  isLoading: boolean;
  
  // Fonctions de vérification
  isInBagPeriod: (date: Date) => boolean;
  isInCurrentPeriod: (date: Date) => boolean;
  isArchived: (date: Date) => boolean;
  
  // Gestion des périodes
  createPeriod: (period: Omit<PlanningPeriodType, 'id'>) => Promise<string>;
  updatePeriod: (periodId: string, updates: Partial<PlanningPeriodType>) => Promise<void>;
  deletePeriod: (periodId: string) => Promise<void>;
  validateBag: (futurePeriodId: string) => Promise<void>;
  
  // Récupération des périodes
  getActivePeriod: () => PlanningPeriodType | undefined;
  getFuturePeriod: () => PlanningPeriodType | undefined;
  refreshPeriods: () => Promise<void>;
}

const PlanningPeriodContext = createContext<PlanningPeriodContextType | undefined>(undefined);

/**
 * Provider pour le contexte de période de planning
 * Gère les périodes de planning courante et future
 */
export const PlanningPeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config: bagPhaseConfig } = useBagPhase();
  const { currentAssociation } = useAssociation();
  const [currentPeriod, setCurrentPeriod] = useState<SimplePlanningPeriod>({
    startDate: createParisDate(),
    endDate: addMonthsParis(createParisDate(), 3)
  });
  const [futurePeriod, setFuturePeriod] = useState<SimplePlanningPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<PlanningPeriodType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const repository = getPlanningRepository();

  // Charger les périodes depuis Firestore (compatibilité)
  useEffect(() => {
    if (!currentAssociation) return;
    
    const unsubscribe = repository.subscribeToPeriodsConfig(currentAssociation, (data) => {
      if (data.currentPeriod) {
        setCurrentPeriod(data.currentPeriod);
      }
      
      if (data.futurePeriod) {
        setFuturePeriod(data.futurePeriod);
      } else {
        setFuturePeriod(null);
      }
    });
    
    return () => unsubscribe();
  }, [currentAssociation, repository]);

  // Charger toutes les périodes
  useEffect(() => {
    if (!currentAssociation) return;
    
    const loadPeriods = async () => {
      setIsLoading(true);
      try {
        const periods = await repository.getPlanningPeriods(currentAssociation);
        setAllPeriods(periods);
      } catch (error) {
        console.error('Error loading planning periods:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPeriods();
    
    // Écouter les changements dans la collection planning_periods
    const unsubscribe = repository.subscribeToPlanningPeriods(currentAssociation, (periods) => {
      setAllPeriods(periods);
    });
    
    return () => unsubscribe();
  }, [currentAssociation, repository]);

  // Déterminer si la bourse aux gardes est active
  const isBagActive = bagPhaseConfig.phase !== 'completed' || !bagPhaseConfig.isValidated;

  /**
   * Vérifie si une date est dans la période de la bourse aux gardes
   * @param date - La date à vérifier
   * @returns true si la date est dans la période de la bourse aux gardes, false sinon
   */
  const isInBagPeriod = (date: Date): boolean => {
    if (!futurePeriod) return false;
    
    const checkDate = startOfDayParis(date);
    const startDate = startOfDayParis(futurePeriod.startDate);
    const endDate = endOfDayParis(futurePeriod.endDate);
    
    return checkDate >= startDate && checkDate <= endDate;
  };

  /**
   * Vérifie si une date est dans la période courante
   * @param date - La date à vérifier
   * @returns true si la date est dans la période courante, false sinon
   */
  const isInCurrentPeriod = (date: Date): boolean => {
    const checkDate = startOfDayParis(date);
    const startDate = startOfDayParis(currentPeriod.startDate);
    const endDate = endOfDayParis(currentPeriod.endDate);
    
    return checkDate >= startDate && checkDate <= endDate;
  };
  
  /**
   * Vérifie si une date est archivée (avant la veille)
   * @param date - La date à vérifier
   * @returns true si la date est archivée, false sinon
   */
  const isArchived = (date: Date): boolean => {
    const yesterday = startOfDayParis(subDays(createParisDate(), 1));
    const checkDate = startOfDayParis(date);
    
    return isBefore(checkDate, yesterday);
  };
  
  /**
   * Récupère la période active
   * @returns La période active ou undefined si non trouvée
   */
  const getActivePeriod = (): PlanningPeriodType | undefined => {
    return allPeriods.find(p => p.status === 'active');
  };
  
  /**
   * Récupère la période future
   * @returns La période future ou undefined si non trouvée
   */
  const getFuturePeriod = (): PlanningPeriodType | undefined => {
    return allPeriods.find(p => p.status === 'future');
  };
  
  /**
   * Rafraîchit la liste des périodes
   */
  const refreshPeriods = async (): Promise<void> => {
    if (!currentAssociation) return;
    
    try {
      const periods = await repository.getPlanningPeriods(currentAssociation);
      setAllPeriods(periods);
    } catch (error) {
      console.error('Error refreshing planning periods:', error);
      throw error;
    }
  };
  
  /**
   * Crée une nouvelle période
   * @param period - Données de la période
   * @returns ID de la période créée
   */
  const createPeriod = async (period: Omit<PlanningPeriodType, 'id'>): Promise<string> => {
    if (!currentAssociation) throw new Error('Association non définie');
    
    try {
      const periodId = await repository.createPlanningPeriod(period, currentAssociation);
      await refreshPeriods();
      return periodId;
    } catch (error) {
      console.error('Error creating period:', error);
      throw error;
    }
  };
  
  /**
   * Met à jour une période
   * @param periodId - ID de la période
   * @param updates - Mises à jour à appliquer
   */
  const updatePeriod = async (
    periodId: string, 
    updates: Partial<PlanningPeriodType>
  ): Promise<void> => {
    if (!currentAssociation) throw new Error('Association non définie');
    
    try {
      await repository.updatePlanningPeriod(periodId, updates, currentAssociation);
      await refreshPeriods();
    } catch (error) {
      console.error('Error updating period:', error);
      throw error;
    }
  };
  
  /**
   * Supprime une période
   * @param periodId - ID de la période
   */
  const deletePeriod = async (periodId: string): Promise<void> => {
    if (!currentAssociation) throw new Error('Association non définie');
    
    try {
      await repository.deletePlanningPeriod(periodId, currentAssociation);
      await refreshPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      throw error;
    }
  };
  
  /**
   * Valide la BAG et fusionne la période future avec la période active
   * @param futurePeriodId - ID de la période future
   */
  const validateBag = async (futurePeriodId: string): Promise<void> => {
    if (!currentAssociation) throw new Error('Association non définie');
    
    try {
      await repository.validateBagAndMergePeriods(futurePeriodId, currentAssociation);
      await refreshPeriods();
    } catch (error) {
      console.error('Error validating BAG:', error);
      throw error;
    }
  };

  return (
    <PlanningPeriodContext.Provider value={{
      currentPeriod,
      futurePeriod,
      allPeriods,
      isBagActive,
      isLoading,
      isInBagPeriod,
      isInCurrentPeriod,
      isArchived,
      createPeriod,
      updatePeriod,
      deletePeriod,
      validateBag,
      getActivePeriod,
      getFuturePeriod,
      refreshPeriods
    }}>
      {children}
    </PlanningPeriodContext.Provider>
  );
};

/**
 * Hook pour accéder au contexte de période de planning
 */
export const usePlanningPeriod = () => {
  const context = useContext(PlanningPeriodContext);
  if (context === undefined) {
    throw new Error('usePlanningPeriod must be used within a PlanningPeriodProvider');
  }
  return context;
};