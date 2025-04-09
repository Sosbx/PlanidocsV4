import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import { BagPhaseConfig, defaultBagPhaseConfig } from '../types';
import { finalizeAllExchanges, restorePendingExchanges } from '../../../lib/firebase/shifts';

interface UseBagPhaseResult {
  config: BagPhaseConfig;
  updateConfig: (newConfig: BagPhaseConfig) => Promise<void>;
  isLoading: boolean;
}

const BAG_CONFIG_DOC = 'bag_phase_config';

/**
 * Hook pour gérer la phase de la bourse aux gardes
 * @returns Configuration de la phase et fonction pour la mettre à jour
 */
export const useBagPhase = (): UseBagPhaseResult => {
  const [config, setConfig] = useState<BagPhaseConfig>(defaultBagPhaseConfig);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    
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
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching bag phase config:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  return {
    config,
    updateConfig,
    isLoading
  };
};

export default useBagPhase;
