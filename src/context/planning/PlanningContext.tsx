import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { PlanningConfig, defaultConfig } from '../../types/planning';

/**
 * Type pour le contexte de planification
 */
interface PlanningContextType {
  config: PlanningConfig;
  updateConfig: (newConfig: PlanningConfig) => Promise<void>;
  resetConfig: () => Promise<void>;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

const PLANNING_CONFIG_DOC = 'planning_config';

/**
 * Provider pour le contexte de planification
 * Gère la configuration du planning et les opérations associées
 */
export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlanningConfig>(defaultConfig);

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

    return () => unsubscribe();
  }, []);

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

  return (
    <PlanningContext.Provider value={{ config, updateConfig, resetConfig }}>
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
