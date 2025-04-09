import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { useBagPhase } from '../shiftExchange';
import { 
  PlanningPeriod as PlanningPeriodType, 
  BagPhaseConfig 
} from '../../types/planning';
import { 
  getPlanningPeriods, 
  createPlanningPeriod, 
  updatePlanningPeriod, 
  deletePlanningPeriod,
  validateBagAndMergePeriods
} from '../../lib/firebase/planning';
import { subDays, isBefore } from 'date-fns';

/**
 * Interface pour la période de planning simplifiée (compatibilité)
 */
interface SimplePlanningPeriod {
  startDate: Date;
  endDate: Date;
}

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
  const [currentPeriod, setCurrentPeriod] = useState<SimplePlanningPeriod>({
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 3))
  });
  const [futurePeriod, setFuturePeriod] = useState<SimplePlanningPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<PlanningPeriodType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Charger les périodes depuis Firestore (compatibilité)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'planning_periods'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        if (data.currentPeriod) {
          setCurrentPeriod({
            startDate: data.currentPeriod.startDate.toDate(),
            endDate: data.currentPeriod.endDate.toDate()
          });
        }
        
        if (data.futurePeriod) {
          setFuturePeriod({
            startDate: data.futurePeriod.startDate.toDate(),
            endDate: data.futurePeriod.endDate.toDate()
          });
        } else {
          setFuturePeriod(null);
        }
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Charger toutes les périodes
  useEffect(() => {
    const loadPeriods = async () => {
      setIsLoading(true);
      try {
        const periods = await getPlanningPeriods();
        setAllPeriods(periods);
      } catch (error) {
        console.error('Error loading planning periods:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPeriods();
    
    // Écouter les changements dans la collection planning_periods
    const unsubscribe = onSnapshot(collection(db, 'planning_periods'), (snapshot) => {
      const periods: PlanningPeriodType[] = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate(),
        status: doc.data().status,
        bagPhase: doc.data().bagPhase,
        isValidated: doc.data().isValidated,
        validatedAt: doc.data().validatedAt?.toDate() || null
      }));
      
      setAllPeriods(periods);
    });
    
    return () => unsubscribe();
  }, []);

  // Déterminer si la bourse aux gardes est active
  const isBagActive = bagPhaseConfig.phase !== 'completed' || !bagPhaseConfig.isValidated;

  /**
   * Vérifie si une date est dans la période de la bourse aux gardes
   * @param date - La date à vérifier
   * @returns true si la date est dans la période de la bourse aux gardes, false sinon
   */
  const isInBagPeriod = (date: Date): boolean => {
    if (!futurePeriod) return false;
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const startDate = new Date(futurePeriod.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(futurePeriod.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return checkDate >= startDate && checkDate <= endDate;
  };

  /**
   * Vérifie si une date est dans la période courante
   * @param date - La date à vérifier
   * @returns true si la date est dans la période courante, false sinon
   */
  const isInCurrentPeriod = (date: Date): boolean => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const startDate = new Date(currentPeriod.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(currentPeriod.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return checkDate >= startDate && checkDate <= endDate;
  };
  
  /**
   * Vérifie si une date est archivée (avant la veille)
   * @param date - La date à vérifier
   * @returns true si la date est archivée, false sinon
   */
  const isArchived = (date: Date): boolean => {
    const yesterday = subDays(new Date(), 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
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
    try {
      const periods = await getPlanningPeriods();
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
    try {
      const periodId = await createPlanningPeriod(period);
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
    try {
      await updatePlanningPeriod(periodId, updates);
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
    try {
      await deletePlanningPeriod(periodId);
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
    try {
      await validateBagAndMergePeriods(futurePeriodId);
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
