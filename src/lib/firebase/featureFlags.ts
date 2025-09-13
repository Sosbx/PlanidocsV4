import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  onSnapshot,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { FeatureFlag, FeatureFlagUpdate, FEATURE_TEMPLATES, FeatureKey } from '../../types/featureFlags';

const FEATURE_FLAGS_COLLECTION = 'featureFlags';

export const featureFlagsService = {
  async initializeFeatureFlags(): Promise<void> {
    // Cette fonction n'est plus nécessaire car nous ne créons plus de flags automatiquement
    // Gardée pour compatibilité mais ne fait plus rien
    console.log('[FeatureFlags] Initialisation ignorée - les flags sont gérés manuellement');
  },

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    try {
      const snapshot = await getDocs(collection(db, FEATURE_FLAGS_COLLECTION));
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        lastUpdated: doc.data().lastUpdated?.toDate() || createParisDate()
      } as FeatureFlag));
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      return [];
    }
  },

  async getFeatureFlag(featureId: string): Promise<FeatureFlag | null> {
    try {
      const docRef = await getDoc(doc(db, FEATURE_FLAGS_COLLECTION, featureId));
      if (docRef.exists()) {
        return {
          ...docRef.data(),
          id: docRef.id,
          lastUpdated: docRef.data().lastUpdated?.toDate() || createParisDate()
        } as FeatureFlag;
      }
      return null;
    } catch (error) {
      console.error('Error fetching feature flag:', error);
      return null;
    }
  },

  async updateFeatureFlag(update: FeatureFlagUpdate, updatedBy: string): Promise<void> {
    try {
      const docRef = doc(db, FEATURE_FLAGS_COLLECTION, update.featureId);
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        const currentData = docSnapshot.data();
        const now = Timestamp.now();
        
        // Préparer les données de mise à jour
        const updateData: any = {
          status: {
            ...currentData.status,
            [update.association]: update.status
          },
          lastUpdated: now,
          updatedBy
        };
        
        await updateDoc(docRef, updateData);
        
        console.log(`[FeatureFlags] ${update.featureId} mis à jour pour ${update.association}: ${update.status} par ${updatedBy}`);
      }
    } catch (error) {
      console.error('[FeatureFlags] Erreur lors de la mise à jour:', error);
      throw error;
    }
  },

  subscribeToFeatureFlags(callback: (flags: FeatureFlag[]) => void): () => void {
    let previousFlags: Map<string, FeatureFlag> = new Map();
    
    const unsubscribe = onSnapshot(
      collection(db, FEATURE_FLAGS_COLLECTION),
      (snapshot) => {
        const flags = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            lastUpdated: data.lastUpdated?.toDate() || createParisDate()
          } as FeatureFlag;
        });
        
        // Détecter les changements
        flags.forEach(flag => {
          const prevFlag = previousFlags.get(flag.id);
          if (prevFlag) {
            // Vérifier les changements de statut
            if (prevFlag.status.RD !== flag.status.RD || prevFlag.status.RG !== flag.status.RG) {
              console.log(`[FeatureFlags] Changement détecté pour ${flag.id}:`);
              if (prevFlag.status.RD !== flag.status.RD) {
                console.log(`  - RD: ${prevFlag.status.RD} → ${flag.status.RD}`);
              }
              if (prevFlag.status.RG !== flag.status.RG) {
                console.log(`  - RG: ${prevFlag.status.RG} → ${flag.status.RG}`);
              }
              console.log(`  - Modifié par: ${flag.updatedBy} à ${flag.lastUpdated.toLocaleString('fr-FR')}`);
            }
          }
        });
        
        // Mettre à jour le cache
        previousFlags.clear();
        flags.forEach(flag => previousFlags.set(flag.id, flag));
        
        callback(flags);
      },
      (error) => {
        console.error('[FeatureFlags] Erreur dans la souscription:', error);
      }
    );

    return unsubscribe;
  },

  async isFeatureEnabled(featureKey: FeatureKey, association: 'RD' | 'RG'): Promise<boolean> {
    const feature = await this.getFeatureFlag(featureKey);
    if (!feature) return false;
    return feature.status[association] === 'enabled';
  },

  async createFeatureFlag(featureKey: FeatureKey, createdBy: string): Promise<void> {
    try {
      // Vérifier si le flag existe déjà
      const existingFlag = await this.getFeatureFlag(featureKey);
      if (existingFlag) {
        throw new Error(`Feature flag ${featureKey} already exists`);
      }

      // Utiliser le template si disponible
      const template = FEATURE_TEMPLATES[featureKey];
      if (!template) {
        throw new Error(`No template found for feature ${featureKey}`);
      }

      // Créer le nouveau flag
      await setDoc(doc(db, FEATURE_FLAGS_COLLECTION, featureKey), {
        ...template,
        id: featureKey,
        lastUpdated: Timestamp.now(),
        updatedBy: createdBy
      });

      console.log(`[FeatureFlags] Nouveau flag créé: ${featureKey} par ${createdBy}`);
    } catch (error) {
      console.error('[FeatureFlags] Erreur lors de la création du flag:', error);
      throw error;
    }
  },

  async getAllPossibleFeatures(): Promise<string[]> {
    // Retourne la liste de toutes les features possibles depuis les templates
    return Object.keys(FEATURE_TEMPLATES);
  },

  async getMissingFeatures(): Promise<string[]> {
    try {
      const existingFlags = await this.getFeatureFlags();
      const existingKeys = new Set(existingFlags.map(f => f.id));
      const allKeys = Object.keys(FEATURE_TEMPLATES);
      
      return allKeys.filter(key => !existingKeys.has(key));
    } catch (error) {
      console.error('[FeatureFlags] Erreur lors de la récupération des features manquantes:', error);
      return [];
    }
  }
};