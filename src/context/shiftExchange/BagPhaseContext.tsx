import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { BagPhaseConfig, defaultBagPhaseConfig } from '../../types/planning';
import { finalizeAllExchanges, restorePendingExchanges } from '../../lib/firebase/exchange';

/**
 * Type pour le contexte de phase de la bourse aux gardes
 */
interface BagPhaseContextType {
  config: BagPhaseConfig;
  updateConfig: (newConfig: BagPhaseConfig) => Promise<void>;
}

const BagPhaseContext = createContext<BagPhaseContextType | undefined>(undefined);

const BAG_CONFIG_DOC = 'bag_phase_config';

/**
 * Provider pour le contexte de phase de la bourse aux gardes
 * Gère la configuration de la phase et les opérations associées
 */
export const BagPhaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BagPhaseConfig>(defaultBagPhaseConfig);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', BAG_CONFIG_DOC), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig({
          ...defaultBagPhaseConfig,
          ...data,
          submissionDeadline: data.submissionDeadline.toDate(),
          isConfigured: true,
        });
      } else {
        setConfig(defaultBagPhaseConfig);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Met à jour la configuration de la phase de la bourse aux gardes
   * @param newConfig - La nouvelle configuration
   */
  const updateConfig = async (newConfig: BagPhaseConfig) => {
    const configRef = doc(db, 'config', BAG_CONFIG_DOC);
    
    // Si on passe à la phase "Terminé", finaliser tous les échanges
    if (newConfig.phase === 'completed' && config.phase !== 'completed') {
      try {
        console.log('Finalizing all pending exchanges...');
        await finalizeAllExchanges();
        console.log('All exchanges finalized successfully');
      } catch (error) {
        console.error('Error finalizing exchanges:', error);
        throw error;
      }
    }
    
    // Si on revient de la phase "Terminé", restaurer les échanges
    if (config.phase === 'completed' && newConfig.phase !== 'completed') {
      try {
        console.log('Restoring pending exchanges...');
        await restorePendingExchanges();
        console.log('Exchanges restored successfully');
      } catch (error) {
        console.error('Error restoring exchanges:', error);
        throw error;
      }
    }
    
    await setDoc(configRef, {
      ...newConfig,
      submissionDeadline: newConfig.submissionDeadline,
    });
  };

  return (
    <BagPhaseContext.Provider value={{ config, updateConfig }}>
      {children}
    </BagPhaseContext.Provider>
  );
};

/**
 * Hook pour accéder au contexte de phase de la bourse aux gardes
 */
export const useBagPhase = () => {
  const context = useContext(BagPhaseContext);
  if (context === undefined) {
    throw new Error('useBagPhase must be used within a BagPhaseProvider');
  }
  return context;
};
