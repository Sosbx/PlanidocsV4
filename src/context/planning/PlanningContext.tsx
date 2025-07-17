import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { formatParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { PlanningConfig, defaultConfig } from '../../types/planning';
import { format } from 'date-fns';
import { frLocale } from '../../utils/dateLocale';
import { useAssociation } from '../association/AssociationContext';
import { getCollectionName } from '../../utils/collectionUtils';
import { ASSOCIATIONS } from '../../constants/associations';
import { getPlanningRepository } from '../../api/implementations/PlanningRepository';
import { ArchivedPeriod } from '../../api/interfaces/IPlanningRepository';

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

/**
 * Provider pour le contexte de planification
 * Gère la configuration du planning et les opérations associées
 */
export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlanningConfig>({...defaultConfig});
  const [archivedPeriods, setArchivedPeriods] = useState<ArchivedPeriod[]>([]);
  const { currentAssociation } = useAssociation();
  // Référence pour suivre la dernière association chargée
  const lastLoadedAssociationRef = React.useRef<string | null>(null);
  const repository = getPlanningRepository();

  // Fonction pour vérifier si l'utilisateur a accès à une association
  const canAccessAssociation = (associationId: string) => {
    // Si l'utilisateur n'est pas connecté, on utilise l'association par défaut
    if (!currentAssociation) return associationId === ASSOCIATIONS.RIVE_DROITE;
    
    // Sinon, on vérifie que l'association demandée correspond à celle de l'utilisateur
    return associationId === currentAssociation;
  };

  useEffect(() => {
    if (!currentAssociation) return;
    
    // Si l'association a changé, réinitialiser immédiatement la configuration
    if (lastLoadedAssociationRef.current && lastLoadedAssociationRef.current !== currentAssociation) {
      console.log(`PlanningContext: Changement d'association détecté de ${lastLoadedAssociationRef.current} à ${currentAssociation}`);
      console.log(`PlanningContext: Réinitialisation de la configuration pour éviter les conflits de cache`);
      
      // Réinitialiser la configuration avec les valeurs par défaut pour la nouvelle association
      setConfig({
        ...defaultConfig,
        associationId: currentAssociation
      });
      
      // Réinitialiser les périodes archivées
      setArchivedPeriods([]);
    }
    
    // Mettre à jour la référence de l'association
    lastLoadedAssociationRef.current = currentAssociation;
    
    console.log(`PlanningContext: Chargement de la configuration pour l'association ${currentAssociation}`);
    
    // IMPORTANT: Vérifier que l'utilisateur a accès à cette association
    if (!canAccessAssociation(currentAssociation)) {
      console.error(`PlanningContext: L'utilisateur n'a pas accès à l'association ${currentAssociation}`);
      setConfig({
        ...defaultConfig,
        associationId: currentAssociation
      });
      return;
    }
    
    const unsubscribe = repository.subscribeToConfig(currentAssociation, (configData) => {
      // Vérifier à nouveau que l'utilisateur a toujours accès à cette association
      if (!canAccessAssociation(currentAssociation)) {
        console.error(`PlanningContext: L'utilisateur n'a plus accès à l'association ${currentAssociation}`);
        return;
      }
      
      if (configData) {
        // Vérifier que l'association n'a pas changé entre-temps
        if (currentAssociation === lastLoadedAssociationRef.current) {
          console.log(`PlanningContext: Configuration chargée pour l'association ${currentAssociation}`);
          setConfig(configData);
        } else {
          console.log(`PlanningContext: Ignorer les données obsolètes pour l'association ${currentAssociation}`);
        }
      } else {
        // Vérifier que l'association n'a pas changé entre-temps
        if (currentAssociation === lastLoadedAssociationRef.current) {
          console.log(`PlanningContext: Aucune configuration trouvée pour l'association ${currentAssociation}`);
          setConfig({
            ...defaultConfig,
            associationId: currentAssociation
          });
        }
      }
    });

    return () => {
      console.log(`PlanningContext: Désabonnement pour l'association ${currentAssociation}`);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAssociation]);

  /**
   * Charge les périodes archivées depuis Firestore
   */
  const loadArchivedPeriods = useCallback(async () => {
    if (!currentAssociation) return;
    
    try {
      console.log(`PlanningContext: Chargement des périodes archivées pour l'association ${currentAssociation}`);
      const periods = await repository.getArchivedPeriods(currentAssociation);
      setArchivedPeriods(periods);
    } catch (error) {
      console.error(`Error loading archived periods for association ${currentAssociation}:`, error);
    }
  }, [currentAssociation, repository]);  

  /**
   * Met à jour la configuration du planning
   * @param newConfig - La nouvelle configuration
   */
  const updateConfig = useCallback(async (newConfig: PlanningConfig) => {
    if (!currentAssociation) return;
    
    console.log(`PlanningContext: Mise à jour de la configuration pour l'association ${currentAssociation}`);
    await repository.updateConfig(currentAssociation, newConfig);
  }, [currentAssociation, repository]);

  /**
   * Réinitialise la configuration du planning et les données associées
   */
  const resetConfig = useCallback(async () => {
    if (!currentAssociation) return;
    
    try {
      console.log(`PlanningContext: Réinitialisation de la configuration pour l'association ${currentAssociation}`);
      await repository.resetPlanningForAssociation(currentAssociation);
      
      // Réinitialiser l'état local
      setConfig({
        ...defaultConfig,
        associationId: currentAssociation
      });
    } catch (error) {
      console.error(`Error resetting planning for association ${currentAssociation}:`, error);
      throw error;
    }
  }, [currentAssociation, repository]);

  /**
   * Archive la période de planning actuelle et crée une nouvelle période
   * @param newConfig - Configuration partielle pour la nouvelle période (optionnel)
   * @returns L'ID de la période archivée
   */
  const archivePlanningPeriod = useCallback(async (newConfig?: Partial<PlanningConfig>): Promise<string> => {
    if (!currentAssociation) throw new Error('Association non définie');
    
    try {
      console.log(`PlanningContext: Archivage de la période pour l'association ${currentAssociation}`);
      
      // 1. Récupérer la configuration actuelle
      const currentConfig = { ...config };
      
      // 2. Récupérer tous les desiderata validés pour cette association
      const validatedDesiderata: Record<string, any> = {};
      const desiderataCollection = getCollectionName('desiderata', currentAssociation);
      const desiderataSnapshot = await getDocs(collection(db, desiderataCollection));
      
      desiderataSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.validatedAt) {
          validatedDesiderata[doc.id] = data;
        }
      });
      
      // 3. Créer le nom de la période
      const periodName = `${formatParisDate(currentConfig.startDate, 'MMM yyyy', { locale: frLocale })} - ${formatParisDate(currentConfig.endDate, 'MMM yyyy', { locale: frLocale })}`;
      
      // 4. Compter le nombre total d'utilisateurs
      const usersCollection = getCollectionName('users', currentAssociation);
      const usersSnapshot = await getDocs(
        query(collection(db, usersCollection), 
          where("roles.isUser", "==", true)
        )
      );
      const totalUsers = usersSnapshot.size;
      
      // 5. Archiver la période
      const archivedId = await repository.archivePeriod(
        currentAssociation,
        currentConfig,
        validatedDesiderata,
        periodName,
        totalUsers
      );
      
      // 6. Réinitialiser ou mettre à jour la configuration pour la nouvelle période
      if (newConfig) {
        // Mettre à jour avec la nouvelle configuration
        await updateConfig({
          ...currentConfig,
          ...newConfig,
          associationId: currentAssociation,
          isConfigured: true
        } as PlanningConfig);
      } else {
        // Réinitialiser complètement
        await resetConfig();
      }
      
      // 7. Recharger les périodes archivées
      await loadArchivedPeriods();
      
      return archivedId;
    } catch (error) {
      console.error(`Error archiving planning period for association ${currentAssociation}:`, error);
      throw error;
    }
  }, [currentAssociation, config, repository, updateConfig, resetConfig, loadArchivedPeriods]);

  // Memoïser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    config, 
    updateConfig, 
    resetConfig, 
    archivePlanningPeriod,
    archivedPeriods,
    loadArchivedPeriods
  }), [config, updateConfig, resetConfig, archivePlanningPeriod, archivedPeriods, loadArchivedPeriods]);

  return (
    <PlanningContext.Provider value={contextValue}>
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