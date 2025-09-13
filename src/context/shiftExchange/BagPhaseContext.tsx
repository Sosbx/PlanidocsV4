import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { BagPhaseConfig, defaultBagPhaseConfig } from '../../types/planning';
import { finalizeAllExchanges, restorePendingExchanges, restoreNotTakenToPending } from '../../lib/firebase/exchange';

/**
 * Type pour le contexte de phase de la bourse aux gardes
 */
interface BagPhaseContextType {
  config: BagPhaseConfig;
  updateConfig: (newConfig: BagPhaseConfig) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const BagPhaseContext = createContext<BagPhaseContextType | undefined>(undefined);

const BAG_CONFIG_DOC = 'bag_phase_config';

/**
 * Provider optimisé pour le contexte de phase de la bourse aux gardes
 * - Réduit les re-renders inutiles
 * - Optimise les mises à jour de configuration
 * - Gère les erreurs de manière centralisée
 */
export const BagPhaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BagPhaseConfig>(defaultBagPhaseConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effet pour écouter les changements de configuration
  useEffect(() => {
    const configRef = doc(db, 'config', BAG_CONFIG_DOC);
    
    const unsubscribe = onSnapshot(
      configRef,
      (doc) => {
        try {
          if (doc.exists()) {
            const data = doc.data();
            setConfig({
              ...defaultBagPhaseConfig,
              ...data,
              submissionDeadline: data.submissionDeadline?.toDate() || createParisDate(),
              isConfigured: true,
            });
          } else {
            setConfig(defaultBagPhaseConfig);
          }
          setError(null);
        } catch (err) {
          console.error('Error processing config:', err);
          setError('Erreur lors du chargement de la configuration');
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to config:', err);
        setError('Erreur de connexion à la configuration');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Met à jour la configuration de manière optimisée
   * Utilise useCallback pour éviter les re-créations de fonction
   */
  const updateConfig = useCallback(async (newConfig: BagPhaseConfig) => {
    const configRef = doc(db, 'config', BAG_CONFIG_DOC);
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Gestion optimisée des transitions de phase
      if (newConfig.phase !== config.phase) {
        console.log(`Phase transition: ${config.phase} → ${newConfig.phase}`);
        
        // Passage à la phase "Distribution" - NE PAS finaliser les échanges
        if (newConfig.phase === 'distribution' && config.phase === 'submission') {
          console.log('Moving to distribution phase - keeping exchanges in pending/validated status');
          // Les échanges restent en status pending (sans preneur) ou validated (avec preneur)
          // Cela permet de voir les gardes sans preneur dans l'export
          await syncPlanningPeriodsWithBAG(newConfig.phase);
        }
        
        // Passage à la phase "Terminé" - Finaliser SEULEMENT maintenant
        else if (newConfig.phase === 'completed' && config.phase !== 'completed') {
          console.log('Moving to completed phase - finalizing all pending exchanges...');
          await finalizeAllExchanges();
          
          // Synchronisation avec les périodes de planning
          await syncPlanningPeriodsWithBAG(newConfig.phase);
        }
        
        // Retour depuis la phase "Terminé"
        else if (config.phase === 'completed' && newConfig.phase !== 'completed') {
          console.log('Leaving completed phase - restoring exchanges...');
          
          // Si on retourne en phase distribution, restaurer les gardes not_taken en pending
          if (newConfig.phase === 'distribution') {
            console.log('Returning to distribution phase - restoring not_taken exchanges to pending...');
            await restoreNotTakenToPending();
          }
          
          // Restaurer aussi les échanges unavailable qui n'ont pas d'historique
          await restorePendingExchanges();
          
          // Synchronisation avec les périodes de planning
          await syncPlanningPeriodsWithBAG(newConfig.phase);
        }
        
        // Autres changements de phase
        else {
          await syncPlanningPeriodsWithBAG(newConfig.phase);
        }
      }
      
      // Mise à jour de la configuration dans Firestore
      await setDoc(configRef, {
        ...newConfig,
        submissionDeadline: newConfig.submissionDeadline,
        updatedAt: serverTimestamp()
      });
      
    } catch (err) {
      console.error('Error updating config:', err);
      setError('Erreur lors de la mise à jour de la configuration');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [config.phase]);
  
  /**
   * Synchronise les périodes de planning avec la phase BAG
   * Fonction extraite pour éviter la duplication
   */
  const syncPlanningPeriodsWithBAG = useCallback(async (bagPhase: 'submission' | 'distribution' | 'completed') => {
    try {
      // Import dynamique pour éviter les dépendances circulaires
      const { getPlanningPeriods, updatePlanningPeriod } = await import('../../lib/firebase/planning');
      
      const periods = await getPlanningPeriods();
      const futurePeriod = periods.find(p => p.status === 'future');
      
      if (!futurePeriod) {
        console.log('Aucune période future trouvée à synchroniser');
        return;
      }
      
      console.log(`Synchronisation de la période ${futurePeriod.id} avec la phase BAG ${bagPhase}`);
      
      if (bagPhase === 'completed') {
        // Marquer la phase comme completed mais garder le statut 'future'
        // Le changement vers 'active' se fera lors de la validation finale
        await updatePlanningPeriod(futurePeriod.id, {
          bagPhase: 'completed'
          // Ne pas changer status ni isValidated ici
        });
        
        // Archiver l'ancienne période active
        const activePeriod = periods.find(p => p.status === 'active');
        if (activePeriod && activePeriod.id !== futurePeriod.id) {
          await updatePlanningPeriod(activePeriod.id, {
            status: 'archived'
          });
        }
      } else {
        // Mise à jour simple de la phase BAG
        await updatePlanningPeriod(futurePeriod.id, {
          bagPhase: bagPhase
        });
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation des périodes:', error);
      // Ne pas propager l'erreur pour ne pas bloquer la mise à jour principale
    }
  }, []);

  // Valeur mémorisée du contexte pour éviter les re-renders
  const contextValue = useMemo(() => ({
    config,
    updateConfig,
    isLoading,
    error
  }), [config, updateConfig, isLoading, error]);

  return (
    <BagPhaseContext.Provider value={contextValue}>
      {children}
    </BagPhaseContext.Provider>
  );
};

/**
 * Hook optimisé pour accéder au contexte de phase de la bourse aux gardes
 */
export const useBagPhase = () => {
  const context = useContext(BagPhaseContext);
  if (context === undefined) {
    throw new Error('useBagPhase must be used within a BagPhaseProvider');
  }
  return context;
};