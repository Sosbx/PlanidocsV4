import React, { createContext, useState, useContext, useEffect } from 'react';
import { ASSOCIATIONS, ASSOCIATION_NAMES } from '../../constants/associations';
import { useAuth } from '../../features/auth/hooks';
import { getCollectionName } from '../../lib/firebase/desiderata';

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
    console.log('AssociationContext: Association stockée dans localStorage:', storedAssociation);
    // S'assurer que la valeur stockée est valide ('RD' ou 'RG')
    return (storedAssociation === 'RD' || storedAssociation === 'RG') ? storedAssociation as 'RD' | 'RG' : ASSOCIATIONS.RIVE_DROITE as 'RD';
  });

  // Fonction pour mettre à jour l'association avec persistance
  const updateAssociation = (associationId: 'RD' | 'RG') => {
    console.log('AssociationContext: Mise à jour de l\'association vers:', associationId);
    // Mettre à jour l'état local
    setCurrentAssociation(associationId);
    // Persister dans localStorage
    localStorage.setItem('currentAssociation', associationId);
  };

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
      updateAssociation(ASSOCIATIONS.RIVE_DROITE as 'RD');
    }
  }, [user, currentAssociation]);

  // Obtenir le nom complet de l'association courante
  const associationName = ASSOCIATION_NAMES[currentAssociation] || ASSOCIATION_NAMES[ASSOCIATIONS.RIVE_DROITE];

  // Fonction utilitaire pour obtenir le nom de collection en fonction de l'association courante
  const getCollectionNameForCurrentAssociation = (baseCollection: string): string => {
    return getCollectionName(baseCollection, currentAssociation);
  };

  // Vérifier si l'association courante est Rive Droite ou Rive Gauche
  const isRiveDroite = currentAssociation === ASSOCIATIONS.RIVE_DROITE;
  const isRiveGauche = currentAssociation === ASSOCIATIONS.RIVE_GAUCHE;

  const value = {
    currentAssociation,
    setCurrentAssociation,
    associationName,
    getCollectionName: getCollectionNameForCurrentAssociation,
    isRiveDroite,
    isRiveGauche
  };

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
