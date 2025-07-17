import { useState, useEffect } from 'react';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from "../../../lib/firebase/config";
import { BagPhaseConfig, defaultBagPhaseConfig } from '../types';
import { finalizeAllExchanges, restorePendingExchanges } from '../../../lib/firebase/exchange';

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
          submissionDeadline: firebaseTimestampToParisDate(data.submissionDeadline),
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
        
        // Synchroniser le changement avec les périodes de planning
        await syncPlanningPeriodsWithBAG(newConfig.phase);
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
        
        // Synchroniser le changement avec les périodes de planning
        await syncPlanningPeriodsWithBAG(newConfig.phase);
      } catch (error) {
        console.error('Error restoring exchanges:', error);
        throw error;
      }
    }
    
    // Si la phase change mais n'implique pas de passage à ou depuis completed
    if (newConfig.phase !== config.phase && 
        !(newConfig.phase === 'completed' && config.phase !== 'completed') &&
        !(config.phase === 'completed' && newConfig.phase !== 'completed')) {
      // Synchroniser le changement avec les périodes de planning
      await syncPlanningPeriodsWithBAG(newConfig.phase);
    }
    
    await setDoc(configRef, {
      ...newConfig,
      submissionDeadline: newConfig.submissionDeadline,
    });
  };
  
  /**
   * Synchronise les périodes de planning avec la phase BAG
   * @param bagPhase - La nouvelle phase BAG
   */
  const syncPlanningPeriodsWithBAG = async (bagPhase: 'submission' | 'distribution' | 'completed') => {
    try {
      // Importer getPlanningPeriods et updatePlanningPeriod de façon dynamique
      const { getPlanningPeriods, updatePlanningPeriod } = await import('../../../lib/firebase/planning');
      
      // Récupérer toutes les périodes
      const periods = await getPlanningPeriods();
      
      // Filtrer pour trouver la période future (BAG)
      const futurePeriod = periods.find(p => p.status === 'future');
      
      if (futurePeriod) {
        console.log(`Synchronisation de la période ${futurePeriod.id} avec la phase BAG ${bagPhase}`);
        
        // Si on passe en phase "completed", marquer la période comme active
        if (bagPhase === 'completed') {
          await updatePlanningPeriod(futurePeriod.id, {
            bagPhase: 'completed',
            status: 'active',
            isValidated: true,
            validatedAt: createParisDate()
          });
          
          // Trouver la période active actuelle et la marquer comme archivée
          const activePeriod = periods.find(p => p.status === 'active');
          if (activePeriod) {
            await updatePlanningPeriod(activePeriod.id, {
              status: 'archived'
            });
          }
        } else {
          // Si on passe à une autre phase, mettre à jour uniquement la phase BAG
          await updatePlanningPeriod(futurePeriod.id, {
            bagPhase: bagPhase
          });
        }
      } else {
        console.log('Aucune période future trouvée à synchroniser');
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation des périodes de planning:', error);
      // Ne pas propager l'erreur pour ne pas bloquer la mise à jour principale
    }
  };

  return {
    config,
    updateConfig,
    isLoading
  };
};

export default useBagPhase;
