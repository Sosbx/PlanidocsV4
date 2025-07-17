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
import { FeatureFlag, FeatureFlagUpdate, DEFAULT_FEATURES, FeatureKey } from '../../types/featureFlags';

const FEATURE_FLAGS_COLLECTION = 'featureFlags';

export const featureFlagsService = {
  async initializeFeatureFlags(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(db, FEATURE_FLAGS_COLLECTION));
      const existingFlags = new Set(snapshot.docs.map(doc => doc.id));
      
      // Toujours vérifier et ajouter les fonctionnalités manquantes
      for (const [key, feature] of Object.entries(DEFAULT_FEATURES)) {
        if (!existingFlags.has(key)) {
          console.log(`Adding missing feature flag: ${key}`);
          await setDoc(doc(db, FEATURE_FLAGS_COLLECTION, key), {
            ...feature,
            id: key,
            lastUpdated: Timestamp.now(),
            updatedBy: 'system'
          });
        }
      }
      
      console.log('Feature flags synchronized successfully');
    } catch (error) {
      console.error('Error initializing feature flags:', error);
    }
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
        await updateDoc(docRef, {
          status: {
            ...currentData.status,
            [update.association]: update.status
          },
          lastUpdated: Timestamp.now(),
          updatedBy
        });
        
        console.log(`Feature ${update.featureId} updated for ${update.association} to ${update.status}`);
      }
    } catch (error) {
      console.error('Error updating feature flag:', error);
      throw error;
    }
  },

  subscribeToFeatureFlags(callback: (flags: FeatureFlag[]) => void): () => void {
    const unsubscribe = onSnapshot(
      collection(db, FEATURE_FLAGS_COLLECTION),
      (snapshot) => {
        const flags = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          lastUpdated: doc.data().lastUpdated?.toDate() || createParisDate()
        } as FeatureFlag));
        callback(flags);
      },
      (error) => {
        console.error('Error in feature flags subscription:', error);
      }
    );

    return unsubscribe;
  },

  async isFeatureEnabled(featureKey: FeatureKey, association: 'RD' | 'RG'): Promise<boolean> {
    const feature = await this.getFeatureFlag(featureKey);
    if (!feature) return false;
    return feature.status[association] === 'enabled';
  }
};