import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { PlanningConfig, defaultConfig } from '../../types/planning';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Interface pour une période archivée
 */
export interface ArchivedPeriod {
  id: string;
  config: PlanningConfig;
  archivedAt: Date;
  name: string;
  validatedDesiderataCount: number;
}

/**
 * Type pour le contexte de planification
 */
interface PlanningContextType {
  config: PlanningConfig;
  updateConfig: (newConfig: PlanningConfig) => Promise<void>;
  resetConfig: () => Promise<void>;
  archivePlanningPeriod: (newConfig?: Partial<PlanningConfig>) => Promise<string>;
  archivedPeriods: ArchivedPeriod[];
  loadArchivedPeriods: () => Promise<void>;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

const PLANNING_CONFIG_DOC = 'planning_config';
const ARCHIVED_PERIODS_COLLECTION = 'archived_planning_periods';

/**
 * Provider pour le contexte de planification
 * Gère la configuration du planning et les opérations associées
 */
export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlanningConfig>(defaultConfig);
  const [archivedPeriods, setArchivedPeriods] = useState<ArchivedPeriod[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', PLANNING_CONFIG_DOC), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig({
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          deadline: data.deadline.toDate(),
          primaryDesiderataLimit: data.primaryDesiderataLimit || 0,
          secondaryDesiderataLimit: data.secondaryDesiderataLimit || 0,
          isConfigured: true,
        });
      } else {
        setConfig(defaultConfig);
      }
    });

    // Charger les périodes archivées au démarrage
    loadArchivedPeriods();

    return () => unsubscribe();
  }, []);

  /**
   * Charge les périodes archivées depuis Firestore
   */
  const loadArchivedPeriods = async () => {
    try {
      const periodsQuery = query(
        collection(db, ARCHIVED_PERIODS_COLLECTION),
        orderBy('archivedAt', 'desc')
      );
      
      const periodsSnapshot = await getDocs(periodsQuery);
      const periodsData = periodsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          config: {
            ...data.config,
            startDate: data.config.startDate.toDate(),
            endDate: data.config.endDate.toDate(),
            deadline: data.config.deadline.toDate(),
          },
          archivedAt: data.archivedAt.toDate(),
          name: data.name,
          validatedDesiderataCount: data.validatedDesiderataCount || 0
        } as ArchivedPeriod;
      });
      
      setArchivedPeriods(periodsData);
    } catch (error) {
      console.error('Error loading archived periods:', error);
    }
  };

  /**
   * Met à jour la configuration du planning
   * @param newConfig - La nouvelle configuration
   */
  const updateConfig = async (newConfig: PlanningConfig) => {
    const configRef = doc(db, 'config', PLANNING_CONFIG_DOC);
    await setDoc(configRef, {
      ...newConfig,
      startDate: newConfig.startDate,
      endDate: newConfig.endDate,
      deadline: newConfig.deadline,
    });
  };

  /**
   * Réinitialise la configuration du planning et les données associées
   */
  const resetConfig = async () => {
    try {
      const batch = writeBatch(db);

      // 1. Supprimer la configuration actuelle
      const configRef = doc(db, 'config', PLANNING_CONFIG_DOC);
      batch.delete(configRef);

      // 2. Supprimer tous les desiderata existants
      const desiderataSnapshot = await getDocs(collection(db, 'desiderata'));
      desiderataSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 3. Réinitialiser le statut de validation pour tous les utilisateurs
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { hasValidatedPlanning: false });
      });

      // 4. Exécuter toutes les opérations en une seule transaction
      await batch.commit();

      // 5. Réinitialiser l'état local
      setConfig(defaultConfig);
    } catch (error) {
      console.error('Error resetting planning:', error);
      throw error;
    }
  };

  /**
   * Archive la période de planning actuelle et crée une nouvelle période
   * @param newConfig - Configuration partielle pour la nouvelle période (optionnel)
   * @returns L'ID de la période archivée
   */
  const archivePlanningPeriod = async (newConfig?: Partial<PlanningConfig>): Promise<string> => {
    try {
      // 1. Récupérer la configuration actuelle
      const currentConfig = { ...config };
      
      // 2. Récupérer tous les desiderata validés
      const validatedDesiderata: Record<string, any> = {};
      const desiderataSnapshot = await getDocs(collection(db, 'desiderata'));
      
      desiderataSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.validatedAt) {
          validatedDesiderata[doc.id] = data;
        }
      });
      
      // 3. Créer un document dans la collection archived_planning_periods
      const periodName = `${format(currentConfig.startDate, 'MMM yyyy', { locale: fr })} - ${format(currentConfig.endDate, 'MMM yyyy', { locale: fr })}`;
      const archivedPeriodRef = doc(collection(db, ARCHIVED_PERIODS_COLLECTION));
      
      await setDoc(archivedPeriodRef, {
        config: currentConfig,
        archivedAt: new Date(),
        name: periodName,
        validatedDesiderataCount: Object.keys(validatedDesiderata).length
      });
      
      // 4. Stocker les desiderata validés dans une sous-collection
      const desiderataCollectionRef = collection(archivedPeriodRef, 'desiderata');
      const batch = writeBatch(db);
      
      Object.entries(validatedDesiderata).forEach(([userId, data]) => {
        batch.set(doc(desiderataCollectionRef, userId), data);
      });
      
      // 5. Réinitialiser l'état des réponses des utilisateurs
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.docs.forEach(userDoc => {
        // Réinitialiser hasValidatedPlanning à false pour tous les utilisateurs
        batch.update(userDoc.ref, { hasValidatedPlanning: false });
        
        // Supprimer les desiderata existants
        const desiderataRef = doc(db, 'desiderata', userDoc.id);
        batch.delete(desiderataRef);
      });
      
      // Exécuter toutes les opérations en une seule transaction
      await batch.commit();
      
      // 6. Réinitialiser ou mettre à jour la configuration pour la nouvelle période
      if (newConfig) {
        // Mettre à jour avec la nouvelle configuration
        await updateConfig({
          ...currentConfig,
          ...newConfig,
          isConfigured: true
        } as PlanningConfig);
      } else {
        // Réinitialiser complètement
        await resetConfig();
      }
      
      // 7. Recharger les périodes archivées
      await loadArchivedPeriods();
      
      return archivedPeriodRef.id;
    } catch (error) {
      console.error('Error archiving planning period:', error);
      throw error;
    }
  };

  return (
    <PlanningContext.Provider value={{ 
      config, 
      updateConfig, 
      resetConfig, 
      archivePlanningPeriod,
      archivedPeriods,
      loadArchivedPeriods
    }}>
      {children}
    </PlanningContext.Provider>
  );
};

/**
 * Hook pour accéder au contexte de planification
 */
export const usePlanningConfig = () => {
  const context = useContext(PlanningContext);
  if (context === undefined) {
    throw new Error('usePlanningConfig must be used within a PlanningProvider');
  }
  return context;
};
