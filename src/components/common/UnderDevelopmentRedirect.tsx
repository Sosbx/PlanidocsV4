import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useToastContext } from '../../context/toast';
import { useFeatureFlags } from '../../context/featureFlags/FeatureFlagsContext';
import { FeatureKey } from '../../types/featureFlags';

interface UnderDevelopmentRedirectProps {
  featureName: string;
  featureKey?: FeatureKey;
  redirectTo: string;
}

// Variable globale pour suivre les toasts récemment affichés
const recentToasts: Record<string, number> = {};

/**
 * Composant qui affiche un message toast et redirige vers une autre page
 * Utilisé pour les fonctionnalités en cours de développement ou désactivées
 */
const UnderDevelopmentRedirect: React.FC<UnderDevelopmentRedirectProps> = ({ 
  featureName, 
  featureKey,
  redirectTo 
}) => {
  const location = useLocation();
  const { getFeatureStatus, isSuperAdmin } = useFeatureFlags();
  const { showToast } = useToastContext();
  
  useEffect(() => {
    // Super admin a toujours accès
    if (isSuperAdmin) {
      return;
    }

    let message = `${featureName} en développement`;
    
    // Si une featureKey est fournie, vérifier le statut
    if (featureKey) {
      const status = getFeatureStatus(featureKey);
      
      if (status === 'enabled') {
        // La fonctionnalité est activée, ne pas rediriger
        return;
      } else if (status === 'dev') {
        message = `${featureName} en développement`;
      } else if (status === 'disabled') {
        message = `${featureName} n'est pas disponible`;
      }
    }
    
    // Vérifier si un toast pour cette fonctionnalité a été affiché récemment
    const now = Date.now();
    const lastToastTime = recentToasts[featureName] || 0;
    
    // N'afficher le toast que si aucun n'a été affiché dans les 5 dernières secondes
    if (now - lastToastTime > 5000) {
      // Afficher un message plus court
      showToast(message, 'info');
      
      // Enregistrer le moment où ce toast a été affiché
      recentToasts[featureName] = now;
    }
  }, [featureName, featureKey, location.pathname, getFeatureStatus, isSuperAdmin]);

  // Super admin ou feature activée : ne pas rediriger
  if (isSuperAdmin || (featureKey && getFeatureStatus(featureKey) === 'enabled')) {
    return null;
  }

  // Rediriger vers la page spécifiée
  return <Navigate to={redirectTo} replace />;
};

export default UnderDevelopmentRedirect;