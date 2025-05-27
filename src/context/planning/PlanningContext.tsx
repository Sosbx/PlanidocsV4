import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, writeBatch, query, orderBy, where } from 'firebase/firestore';
import { db } from "../../lib/firebase/config";
import { PlanningConfig, defaultConfig } from '../../types/planning';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAssociation } from '../association/AssociationContext';
import { getCollectionName } from '../../lib/firebase/desiderata';
import { ASSOCIATIONS } from '../../constants/associations';

/**
 * Interface pour une période archivée
 */
export interface ArchivedPeriod {
  id: string;
  config: PlanningConfig;
  archivedAt: Date;
  name: string;
  validatedDesiderataCount: number;
  associationId: string; // Ajouter l'associationId
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

// Fonction pour obtenir le nom du document de configuration en fonction de l'association
const getPlanningConfigDoc = (associationId: string) => {
  if (associationId === ASSOCIATIONS.RIVE_DROITE) {
    return 'planning_config'; // Garder le nom original pour RD
  }
  return `planning_config_${associationId}`; // Ex: planning_config_RG
};

// Fonction pour obtenir le nom de la collection des périodes archivées en fonction de l'association
const getArchivedPeriodsCollection = (associationId: string) => {
  return getCollectionName('archived_planning_periods', associationId);
};

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

  // Effet pour réinitialiser la configuration lors du changement d'association
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
    // pour éviter d'afficher temporairement les données de l'ancienne association
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
    const configDoc = getPlanningConfigDoc(currentAssociation);
    
    // IMPORTANT: Vérifier que l'utilisateur a accès à cette association
    if (!canAccessAssociation(currentAssociation)) {
      console.error(`PlanningContext: L'utilisateur n'a pas accès à l'association ${currentAssociation}`);
      setConfig({
        ...defaultConfig,
        associationId: currentAssociation
      });
      return;
    }
    
    const unsubscribe = onSnapshot(doc(db, 'config', configDoc), (doc) => {
      // Vérifier à nouveau que l'utilisateur a toujours accès à cette association
      if (!canAccessAssociation(currentAssociation)) {
        console.error(`PlanningContext: L'utilisateur n'a plus accès à l'association ${currentAssociation}`);
        return;
      }
      
      if (doc.exists()) {
        const data = doc.data();
        // Vérifier que l'association n'a pas changé entre-temps
        if (currentAssociation === lastLoadedAssociationRef.current) {
          console.log(`PlanningContext: Configuration chargée pour l'association ${currentAssociation}`);
          setConfig({
            ...data,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            deadline: data.deadline.toDate(),
            primaryDesiderataLimit: data.primaryDesiderataLimit || 0,
            secondaryDesiderataLimit: data.secondaryDesiderataLimit || 0,
            isConfigured: true,
            associationId: currentAssociation // Ajouter l'associationId à la configuration
          });
        } else {
          console.log(`PlanningContext: Ignorer les données obsolètes pour l'association ${currentAssociation}`);
        }
      } else {
        // Vérifier que l'association n'a pas changé entre-temps
        if (currentAssociation === lastLoadedAssociationRef.current) {
          console.log(`PlanningContext: Aucune configuration trouvée pour l'association ${currentAssociation}`);
          setConfig({
            ...defaultConfig,
            associationId: currentAssociation // Ajouter l'associationId à la configuration par défaut
          });
        }
      }
    });

    // Charger les périodes archivées au démarrage
    loadArchivedPeriods();

    return () => {
      console.log(`PlanningContext: Désabonnement pour l'association ${currentAssociation}`);
      unsubscribe();
    };
  }, [currentAssociation]);  // Réagir aux changements d'association

  /**
   * Charge les périodes archivées depuis Firestore
   */
  const loadArchivedPeriods = useCallback(async () => {
    if (!currentAssociation) return;
    
    try {
      console.log(`PlanningContext: Chargement des périodes archivées pour l'association ${currentAssociation}`);
      const archivedCollection = getArchivedPeriodsCollection(currentAssociation);
      
      const periodsQuery = query(
        collection(db, archivedCollection),
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
            associationId: currentAssociation // Ajouter l'associationId
          },
          archivedAt: data.archivedAt.toDate(),
          name: data.name,
          validatedDesiderataCount: data.validatedDesiderataCount || 0,
          associationId: currentAssociation // Ajouter l'associationId
        } as ArchivedPeriod;
      });
      
      setArchivedPeriods(periodsData);
    } catch (error) {
      console.error(`Error loading archived periods for association ${currentAssociation}:`, error);
    }
  }, [currentAssociation]);  

  /**
   * Met à jour la configuration du planning
   * @param newConfig - La nouvelle configuration
   */
  const updateConfig = useCallback(async (newConfig: PlanningConfig) => {
    if (!currentAssociation) return;
    
    console.log(`PlanningContext: Mise à jour de la configuration pour l'association ${currentAssociation}`);
    const configDoc = getPlanningConfigDoc(currentAssociation);
    const configRef = doc(db, 'config', configDoc);
    
    await setDoc(configRef, {
      ...newConfig,
      startDate: newConfig.startDate,
      endDate: newConfig.endDate,
      deadline: newConfig.deadline,
      associationId: currentAssociation // S'assurer que l'associationId est bien enregistré
    });
  }, [currentAssociation]);

  /**
   * Réinitialise la configuration du planning et les données associées
   */
  const resetConfig = async () => {
    if (!currentAssociation) return;
    
    try {
      console.log(`PlanningContext: Réinitialisation de la configuration pour l'association ${currentAssociation}`);
      const batch = writeBatch(db);

      // 1. Supprimer la configuration actuelle
      const configDoc = getPlanningConfigDoc(currentAssociation);
      const configRef = doc(db, 'config', configDoc);
      batch.delete(configRef);

      // 2. Supprimer tous les desiderata existants pour cette association
      const desiderataCollection = getCollectionName('desiderata', currentAssociation);
      const desiderataSnapshot = await getDocs(collection(db, desiderataCollection));
      desiderataSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 3. Réinitialiser le statut de validation pour tous les utilisateurs de cette association
      const usersCollection = getCollectionName('users', currentAssociation);
      const usersSnapshot = await getDocs(
        query(collection(db, usersCollection), 
              where("associationId", "==", currentAssociation))
      );
      
      // Pour Rive Droite, inclure aussi les utilisateurs sans associationId
      if (currentAssociation === ASSOCIATIONS.RIVE_DROITE) {
        const legacyUsersSnapshot = await getDocs(
          query(collection(db, usersCollection), 
                where("associationId", "==", null))
        );
        
        legacyUsersSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { hasValidatedPlanning: false });
        });
      }
      
      usersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { hasValidatedPlanning: false });
      });

      // 4. Exécuter toutes les opérations en une seule transaction
      await batch.commit();

      // 5. Réinitialiser l'état local
      setConfig({
        ...defaultConfig,
        associationId: currentAssociation
      });
    } catch (error) {
      console.error(`Error resetting planning for association ${currentAssociation}:`, error);
      throw error;
    }
  };

  /**
   * Archive la période de planning actuelle et crée une nouvelle période
   * @param newConfig - Configuration partielle pour la nouvelle période (optionnel)
   * @returns L'ID de la période archivée
   */
  const archivePlanningPeriod = async (newConfig?: Partial<PlanningConfig>): Promise<string> => {
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
      
      // 3. Créer un document dans la collection archived_planning_periods spécifique à l'association
      const periodName = `${format(currentConfig.startDate, 'MMM yyyy', { locale: fr })} - ${format(currentConfig.endDate, 'MMM yyyy', { locale: fr })}`;
      const archivedCollection = getArchivedPeriodsCollection(currentAssociation);
      const archivedPeriodRef = doc(collection(db, archivedCollection));
      
      await setDoc(archivedPeriodRef, {
        config: currentConfig,
        archivedAt: new Date(),
        name: periodName,
        associationId: currentAssociation,
        validatedDesiderataCount: Object.keys(validatedDesiderata).length
      });
      
      // 4. Stocker les desiderata validés dans une sous-collection
      const desiderataCollectionRef = collection(archivedPeriodRef, desiderataCollection);
      const batch = writeBatch(db);
      
      Object.entries(validatedDesiderata).forEach(([userId, data]) => {
        batch.set(doc(desiderataCollectionRef, userId), data);
      });
      
      // 5. Réinitialiser l'état des réponses des utilisateurs de cette association
      const usersCollection = getCollectionName('users', currentAssociation);
      
      // Traiter les utilisateurs selon l'association
      if (currentAssociation === ASSOCIATIONS.RIVE_DROITE) {
        // Pour RD, inclure aussi les utilisateurs sans associationId
        const usersWithAssocSnapshot = await getDocs(
          query(collection(db, usersCollection), where("associationId", "==", currentAssociation))
        );
        
        const usersWithoutAssocSnapshot = await getDocs(
          query(collection(db, usersCollection), where("associationId", "==", null))
        );
        
        // Traiter les utilisateurs avec associationId=RD
        usersWithAssocSnapshot.docs.forEach(userDoc => {
          // Réinitialiser hasValidatedPlanning à false
          batch.update(userDoc.ref, { hasValidatedPlanning: false });
          
          // Supprimer les desiderata existants
          const desiderataRef = doc(db, desiderataCollection, userDoc.id);
          batch.delete(desiderataRef);
        });
        
        // Traiter les utilisateurs sans associationId (legacy)
        usersWithoutAssocSnapshot.docs.forEach(userDoc => {
          // Réinitialiser hasValidatedPlanning à false
          batch.update(userDoc.ref, { hasValidatedPlanning: false });
          
          // Supprimer les desiderata existants
          const desiderataRef = doc(db, desiderataCollection, userDoc.id);
          batch.delete(desiderataRef);
        });
      } else {
        // Pour les autres associations, filtrer strictement par associationId
        const usersSnapshot = await getDocs(
          query(collection(db, usersCollection), where("associationId", "==", currentAssociation))
        );
        
        usersSnapshot.docs.forEach(userDoc => {
          // Réinitialiser hasValidatedPlanning à false
          batch.update(userDoc.ref, { hasValidatedPlanning: false });
          
          // Supprimer les desiderata existants
          const desiderataRef = doc(db, desiderataCollection, userDoc.id);
          batch.delete(desiderataRef);
        });
      }
      
      // Exécuter toutes les opérations en une seule transaction
      await batch.commit();
      
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
      
      return archivedPeriodRef.id;
    } catch (error) {
      console.error(`Error archiving planning period for association ${currentAssociation}:`, error);
      throw error;
    }
  };

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
