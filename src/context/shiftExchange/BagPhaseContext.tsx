import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection, onSnapshot as onCollectionSnapshot } from 'firebase/firestore';
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
 * Initialise les listeners pour la synchronisation des échanges
 */
export const initializeExchangeSyncListeners = () => {
  // Initialiser les imports asynchrones pour éviter les erreurs require/import dans des transactions
  let notifyExchangeSystem: any = null;
  let syncValidatedExchangeWithPlanning: any = null;
  
  // On charge les fonctions au démarrage mais de manière asynchrone
  import('../../lib/firebase/planningEventService').then(module => {
    notifyExchangeSystem = module.notifyExchangeSystem;
    syncValidatedExchangeWithPlanning = module.syncValidatedExchangeWithPlanning;
    console.log('Exchange sync services loaded successfully');
  }).catch(error => {
    console.error('Failed to load exchange sync services', error);
  });

  // Listener pour les modifications de planning
  const planningsListener = onCollectionSnapshot(
    collection(db, 'generated_plannings'),
    (snapshot) => {
      // Pour chaque modification de planning
      snapshot.docChanges().forEach(async (change) => {
        const userId = change.doc.id;
        const planningData = change.doc.data();
        
        // Si le document est modifié ou ajouté
        if (change.type === 'added' || change.type === 'modified') {
          try {
            // Vérifier toute période activée dans ce planning
            if (planningData.periods && notifyExchangeSystem) {
              for (const periodId in planningData.periods) {
                const periodData = planningData.periods[periodId];
                
                // Si la période et ses données sont valides
                if (periodData && periodData.assignments) {
                  // Vérifier si c'est une période archivée ou non
                  const isArchived = periodData.isArchived === true;
                  
                  // Ne notifier que pour les périodes non archivées
                  if (!isArchived) {
                    await notifyExchangeSystem(
                      userId, 
                      periodId, 
                      periodData.assignments, 
                      'update'
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error in planning change listener:', error);
          }
        }
      });
    }
  );
  
  // Listener pour les validations d'échanges
  const exchangeHistoryListener = onCollectionSnapshot(
    collection(db, 'exchange_history'),
    (snapshot) => {
      // Pour chaque nouvel échange validé
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const exchangeId = change.doc.id;
          const historyData = change.doc.data();
          
          // Si c'est un échange complété et que les données sont valides
          if (historyData && historyData.status === 'completed' && syncValidatedExchangeWithPlanning) {
            try {
              await syncValidatedExchangeWithPlanning(exchangeId);
            } catch (error) {
              console.error('Error syncing exchange with planning:', error);
            }
          }
        }
      });
    }
  );
  
  // Retourner une fonction pour désinscrire les listeners
  return () => {
    planningsListener();
    exchangeHistoryListener();
  };
};

/**
 * Provider pour le contexte de phase de la bourse aux gardes
 * Gère la configuration de la phase et les opérations associées
 */
export const BagPhaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BagPhaseConfig>(defaultBagPhaseConfig);

  useEffect(() => {
    // Écouter les changements de configuration
    const configUnsubscribe = onSnapshot(doc(db, 'config', BAG_CONFIG_DOC), (doc) => {
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
    
    // Initialiser les listeners pour la synchronisation
    const syncListenersCleanup = initializeExchangeSyncListeners();

    return () => {
      configUnsubscribe();
      syncListenersCleanup();
    };
  }, []);

  /**
   * Met à jour la configuration de la phase de la bourse aux gardes
   * et synchronise avec les périodes de planning
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
      const { getPlanningPeriods, updatePlanningPeriod } = await import('../../lib/firebase/planning');
      
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
            validatedAt: new Date()
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