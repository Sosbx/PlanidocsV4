import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const useUnsavedChanges = (hasChanges: boolean) => {
  const { user } = useAuth();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !user?.hasValidatedPlanning) {
        const message = "Vous avez des modifications non validées. Si vous quittez maintenant, vos sélections seront perdues.";
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, user?.hasValidatedPlanning]);
};