import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureFlags } from '../../../context/featureFlags/FeatureFlagsContext';
import { useSuperAdmin } from '../../../context/superAdmin/SuperAdminContext';
import { FeatureKey } from '../../../types/featureFlags';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../../../hooks/useToast';

interface FeatureProtectedRouteProps {
  children: React.ReactNode;
  feature: FeatureKey;
  requiredRoles?: Array<'isUser' | 'isManager' | 'isAdmin' | 'isPartTime' | 'isCAT' | 'isReplacement'>;
}

export const FeatureProtectedRoute: React.FC<FeatureProtectedRouteProps> = ({ 
  children, 
  feature,
  requiredRoles = []
}) => {
  const { canAccessFeature, getFeatureStatus } = useFeatureFlags();
  const { user } = useAuth();
  const { isSuperAdminMode, canAccessSuperAdmin } = useSuperAdmin();

  // Super admin en mode super admin a toujours accès
  if (canAccessSuperAdmin && isSuperAdminMode) {
    return <>{children}</>;
  }

  // Vérifier les rôles si spécifiés
  const userRoles = user?.roles ? Object.keys(user.roles).filter(role => user.roles[role]) : [];
  
  // Vérifier l'accès à la fonctionnalité
  if (!canAccessFeature(feature, userRoles)) {
    const status = getFeatureStatus(feature);
    
    // Si la fonctionnalité est désactivée
    if (status === 'disabled') {
      toast.error('Cette fonctionnalité n\'est pas disponible');
      return <Navigate to="/dashboard" replace />;
    }
    
    // Si la fonctionnalité est en développement
    if (status === 'dev') {
      toast.info('Cette fonctionnalité est en cours de développement');
    }
    
    // Si l'utilisateur n'a pas les rôles requis
    if (requiredRoles.length > 0 && !requiredRoles.some(role => user?.roles?.[role])) {
      toast.error('Vous n\'avez pas les permissions nécessaires');
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};