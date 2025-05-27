import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

interface UnderDevelopmentRedirectProps {
  featureName: string;
  redirectTo: string;
}

// Variable globale pour suivre les toasts récemment affichés
const recentToasts: Record<string, number> = {};

/**
 * Composant qui affiche un message toast et redirige vers une autre page
 * Utilisé pour les fonctionnalités en cours de développement
 */
const UnderDevelopmentRedirect: React.FC<UnderDevelopmentRedirectProps> = ({ 
  featureName, 
  redirectTo 
}) => {
  const location = useLocation();
  
  useEffect(() => {
    // Vérifier si un toast pour cette fonctionnalité a été affiché récemment
    const now = Date.now();
    const lastToastTime = recentToasts[featureName] || 0;
    
    // N'afficher le toast que si aucun n'a été affiché dans les 5 dernières secondes
    if (now - lastToastTime > 5000) {
      // Afficher un message plus court
      toast.info(`${featureName} en développement`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
      
      // Enregistrer le moment où ce toast a été affiché
      recentToasts[featureName] = now;
    }
  }, [featureName, location.pathname]);

  // Rediriger vers la page spécifiée
  return <Navigate to={redirectTo} replace />;
};

export default UnderDevelopmentRedirect;
