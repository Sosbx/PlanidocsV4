import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { ASSOCIATIONS, ASSOCIATION_NAMES } from '../../constants/associations';
import { useAuth } from '../../features/auth/hooks';
import { getCollectionName } from '../../utils/collectionUtils';

/**
 * Type pour le contexte d'association
 */
export interface AssociationContextType {
  currentAssociation: 'RD' | 'RG';
  setCurrentAssociation: (associationId: 'RD' | 'RG') => void;
  associationName: string;
  getCollectionName: (baseCollection: string) => string;
  isRiveDroite: boolean;
  isRiveGauche: boolean;
}

/**
 * Création du contexte d'association
 */
const AssociationContext = createContext<AssociationContextType | undefined>(undefined);

/**
 * Fournisseur du contexte d'association
 */
export const AssociationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Utiliser une référence pour suivre si l'initialisation a déjà eu lieu
  const isInitializedRef = React.useRef(false);
  // Stocker l'association actuelle dans le localStorage pour la persistance entre les sessions
  const [currentAssociation, setCurrentAssociation] = useState<'RD' | 'RG'>(() => {
    // Lors de l'initialisation, vérifier si une association est stockée dans localStorage
    const storedAssociation = localStorage.getItem('currentAssociation');
    // console.log('AssociationContext: Association stockée dans localStorage:', storedAssociation); // Removed for performance
    // S'assurer que la valeur stockée est valide ('RD' ou 'RG')
    return (storedAssociation === 'RD' || storedAssociation === 'RG') ? storedAssociation as 'RD' | 'RG' : ASSOCIATIONS.RIVE_DROITE as 'RD';
  });

  // Fonction pour mettre à jour l'association avec persistance (mémoïsée)
  const updateAssociation = useCallback((associationId: 'RD' | 'RG') => {
    // console.log('AssociationContext: Mise à jour de l\'association vers:', associationId); // Removed for performance
    // Mettre à jour l'état local
    setCurrentAssociation(associationId);
    // Persister dans localStorage
    localStorage.setItem('currentAssociation', associationId);
  }, []);

  // Réinitialiser l'association lors de la déconnexion
  useEffect(() => {
    if (!user && isInitializedRef.current) {
      console.log('AssociationContext: Utilisateur déconnecté, réinitialisation de l\'association');
      // Effacer l'association stockée lors de la déconnexion
      localStorage.removeItem('currentAssociation');
      // Revenir à l'association par défaut
      setCurrentAssociation(ASSOCIATIONS.RIVE_DROITE as 'RD');
    }
    isInitializedRef.current = true;
  }, [user]);

  // Mettre à jour l'association courante en fonction de l'utilisateur connecté
  useEffect(() => {
    // Ne pas mettre à jour automatiquement si le super-admin a déjà sélectionné une association
    const manuallySelectedAssociation = localStorage.getItem('manualAssociationSelection');
    const isSuperAdmin = user?.email === 'arkane.hilal@h24scm.com';
    
    if (isSuperAdmin && manuallySelectedAssociation === 'true') {
      // Le super-admin a manuellement sélectionné une association, ne pas la changer
      return;
    }
    
    if (user?.associationId) {
      console.log('AssociationContext: Utilisateur connecté:', user.id, 'Association:', user.associationId);
      // Vérifier si l'association a changé pour éviter les mises à jour inutiles
      if (currentAssociation !== user.associationId) {
        console.log('AssociationContext: Mise à jour de l\'association courante:', user.associationId);
        // Vérifier que l'association est valide ('RD' ou 'RG')
        if (user.associationId === 'RD' || user.associationId === 'RG') {
          updateAssociation(user.associationId);
        } else {
          console.warn('AssociationContext: Association invalide:', user.associationId);
          updateAssociation(ASSOCIATIONS.RIVE_DROITE as 'RD');
        }
      }
    } else if (user) {
      console.log('AssociationContext: Aucune association définie pour l\'utilisateur, utilisation de l\'association par défaut:', ASSOCIATIONS.RIVE_DROITE);
      if (!isSuperAdmin) {
        updateAssociation(ASSOCIATIONS.RIVE_DROITE as 'RD');
      }
    }
  }, [user, currentAssociation]);

  // Mémoïser les valeurs dérivées
  const associationName = useMemo(() => 
    ASSOCIATION_NAMES[currentAssociation] || ASSOCIATION_NAMES[ASSOCIATIONS.RIVE_DROITE],
    [currentAssociation]
  );

  // Fonction utilitaire pour obtenir le nom de collection (mémoïsée)
  const getCollectionNameForCurrentAssociation = useCallback((baseCollection: string): string => {
    return getCollectionName(baseCollection, currentAssociation);
  }, [currentAssociation]);

  // Mémoïser les vérifications booléennes
  const isRiveDroite = useMemo(() => 
    currentAssociation === ASSOCIATIONS.RIVE_DROITE, [currentAssociation]
  );
  const isRiveGauche = useMemo(() => 
    currentAssociation === ASSOCIATIONS.RIVE_GAUCHE, [currentAssociation]
  );

  // Fonction pour définir manuellement l'association (mémoïsée)
  const setCurrentAssociationManual = useCallback((associationId: 'RD' | 'RG') => {
    const isSuperAdmin = user?.email === 'arkane.hilal@h24scm.com';
    if (isSuperAdmin) {
      localStorage.setItem('manualAssociationSelection', 'true');
    }
    updateAssociation(associationId);
  }, [user?.email, updateAssociation]);

  // Mémoïser la valeur du contexte pour éviter les re-renders
  const value = useMemo(() => ({
    currentAssociation,
    setCurrentAssociation: setCurrentAssociationManual,
    associationName,
    getCollectionName: getCollectionNameForCurrentAssociation,
    isRiveDroite,
    isRiveGauche
  }), [
    currentAssociation,
    setCurrentAssociationManual,
    associationName,
    getCollectionNameForCurrentAssociation,
    isRiveDroite,
    isRiveGauche
  ]);

  return (
    <AssociationContext.Provider value={value}>
      {children}
    </AssociationContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte d'association
 */
export const useAssociation = (): AssociationContextType => {
  const context = useContext(AssociationContext);
  if (context === undefined) {
    throw new Error('useAssociation doit être utilisé à l\'intérieur d\'un AssociationProvider');
  }
  return context;
};
