import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { featureFlagsService } from '../../lib/firebase/featureFlags';
import { FeatureFlag, FeatureFlagUpdate, FeatureKey, FeatureStatus } from '../../types/featureFlags';
import { useAssociation } from '../association/AssociationContext';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useSuperAdmin } from '../superAdmin/SuperAdminContext';

interface FeatureFlagsContextType {
  featureFlags: FeatureFlag[];
  loading: boolean;
  isFeatureEnabled: (featureKey: FeatureKey) => boolean;
  getFeatureStatus: (featureKey: FeatureKey) => FeatureStatus | null;
  updateFeatureFlag: (update: FeatureFlagUpdate) => Promise<void>;
  canAccessFeature: (featureKey: FeatureKey, userRoles?: string[]) => boolean;
  isSuperAdmin: boolean;
  hasUnauthorizedChanges: boolean;
  getFeatureDiagnostics: (featureKey: FeatureKey) => {
    updatedBy: string;
    lastUpdated: Date;
  } | null;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnauthorizedChanges, setHasUnauthorizedChanges] = useState(false);
  const [lastKnownFlags, setLastKnownFlags] = useState<Map<string, FeatureFlag>>(new Map());
  const { currentAssociation } = useAssociation();
  const { user } = useAuth();
  const { isSuperAdminMode } = useSuperAdmin();

  const isSuperAdmin = user?.email === 'arkane.hilal@h24scm.com' && isSuperAdminMode;

  useEffect(() => {
    const initializeAndSubscribe = async () => {
      setLoading(true);
      
      // Plus besoin d'initialiser car les flags sont gérés manuellement
      
      // Subscribe to feature flags changes
      const unsubscribe = featureFlagsService.subscribeToFeatureFlags((flags) => {
        // Détecter les changements non autorisés
        if (lastKnownFlags.size > 0) {
          flags.forEach(flag => {
            const lastKnown = lastKnownFlags.get(flag.id);
            if (lastKnown) {
              // Vérifier si un flag a été modifié par quelqu'un d'autre
              if ((lastKnown.status.RD !== flag.status.RD || lastKnown.status.RG !== flag.status.RG) && 
                  flag.updatedBy !== user?.email) {
                console.warn(`[FeatureFlags] Changement externe détecté pour ${flag.id} par ${flag.updatedBy}`);
                setHasUnauthorizedChanges(true);
              }
            }
          });
        }
        
        // Mettre à jour le cache local
        const newLastKnown = new Map<string, FeatureFlag>();
        flags.forEach(flag => newLastKnown.set(flag.id, flag));
        setLastKnownFlags(newLastKnown);
        
        setFeatureFlags(flags);
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribe = initializeAndSubscribe();

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, []);

  const isFeatureEnabled = useCallback((featureKey: FeatureKey): boolean => {
    // Super admin has access to everything
    if (isSuperAdmin) return true;
    
    const feature = featureFlags.find(f => f.id === featureKey);
    if (!feature) return false;
    
    const status = feature.status[currentAssociation];
    return status === 'enabled' || status === 'dev';
  }, [featureFlags, currentAssociation, isSuperAdmin]);

  const getFeatureStatus = useCallback((featureKey: FeatureKey): FeatureStatus | null => {
    const feature = featureFlags.find(f => f.id === featureKey);
    if (!feature) return null;
    
    return feature.status[currentAssociation];
  }, [featureFlags, currentAssociation]);

  const canAccessFeature = useCallback((featureKey: FeatureKey, userRoles?: string[]): boolean => {
    // Super admin can access everything
    if (isSuperAdmin) return true;
    
    const feature = featureFlags.find(f => f.id === featureKey);
    if (!feature) return false;
    
    // Check if feature is enabled for the association
    const status = feature.status[currentAssociation];
    if (status === 'disabled') return false;
    
    // Check role requirements
    if (feature.requiredRoles && feature.requiredRoles.length > 0 && userRoles) {
      return feature.requiredRoles.some(role => userRoles.includes(role));
    }
    
    return true;
  }, [featureFlags, currentAssociation, isSuperAdmin]);

  const updateFeatureFlag = useCallback(async (update: FeatureFlagUpdate): Promise<void> => {
    // Permettre la mise à jour si l'utilisateur est le super admin (peu importe le mode)
    if (!user || user.email !== 'arkane.hilal@h24scm.com') {
      throw new Error('Only super admin can update feature flags');
    }
    
    await featureFlagsService.updateFeatureFlag(update, user.email || 'unknown');
  }, [user]);

  const getFeatureDiagnostics = useCallback((featureKey: FeatureKey) => {
    const feature = featureFlags.find(f => f.id === featureKey);
    if (!feature) return null;
    
    return {
      updatedBy: feature.updatedBy,
      lastUpdated: feature.lastUpdated
    };
  }, [featureFlags]);

  const value: FeatureFlagsContextType = {
    featureFlags,
    loading,
    isFeatureEnabled,
    getFeatureStatus,
    updateFeatureFlag,
    canAccessFeature,
    isSuperAdmin,
    hasUnauthorizedChanges,
    getFeatureDiagnostics
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};