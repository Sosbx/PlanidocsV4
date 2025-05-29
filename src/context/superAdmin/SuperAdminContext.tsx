import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/hooks';

interface SuperAdminContextType {
  isSuperAdminMode: boolean;
  toggleSuperAdminMode: () => void;
  canAccessSuperAdmin: boolean;
}

const SuperAdminContext = createContext<SuperAdminContextType | undefined>(undefined);

export const SuperAdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(true);
  
  const canAccessSuperAdmin = user?.email === 'arkane.hilal@h24scm.com';

  useEffect(() => {
    // Restaurer le mode depuis localStorage
    const savedMode = localStorage.getItem('superAdminMode');
    if (savedMode !== null && canAccessSuperAdmin) {
      setIsSuperAdminMode(savedMode === 'true');
    }
  }, [canAccessSuperAdmin]);

  const toggleSuperAdminMode = () => {
    if (!canAccessSuperAdmin) return;
    
    const newMode = !isSuperAdminMode;
    setIsSuperAdminMode(newMode);
    localStorage.setItem('superAdminMode', newMode.toString());
    
    // Si on passe en mode super-admin, réinitialiser la sélection manuelle d'association
    if (newMode) {
      localStorage.removeItem('manualAssociationSelection');
    } else {
      // Si on passe en mode incognito, marquer que c'est une sélection manuelle
      localStorage.setItem('manualAssociationSelection', 'true');
    }
  };

  const value = {
    isSuperAdminMode: canAccessSuperAdmin && isSuperAdminMode,
    toggleSuperAdminMode,
    canAccessSuperAdmin
  };

  return (
    <SuperAdminContext.Provider value={value}>
      {children}
    </SuperAdminContext.Provider>
  );
};

export const useSuperAdmin = () => {
  const context = useContext(SuperAdminContext);
  if (context === undefined) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
};