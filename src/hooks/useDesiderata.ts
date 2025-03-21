import { useState, useCallback } from 'react';
import { getDesiderata, saveDesiderata, validateDesiderata } from '../lib/firebase/desiderata';
import { useAuth } from './useAuth';
import { useUsers } from '../context/UserContext';

export const useDesiderata = () => {
  const { user } = useAuth();
  const { updateUser } = useUsers();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveUserDesiderata = useCallback(async (selections: Record<string, 'primary' | 'secondary' | null>) => {
    if (!user) return false;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await saveDesiderata(user.id, selections);
      if (Object.keys(selections).length === 0) {
        await updateUser(user.id, { hasValidatedPlanning: false });
        return true;
      }
      return true;
    } catch (err) {
      console.error('Error saving desiderata:', err);
      setError('Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, updateUser]);

  const validateUserDesiderata = useCallback(async (userId: string) => {
    if (!user) return false;
    
    try {
      setIsSaving(true);
      setError(null);

      const desiderata = await getDesiderata(userId);
      
      // Si aucun desiderata n'existe, on valide avec un tableau vide
      const selections = desiderata?.selections || {};
      await validateDesiderata(userId, selections);
      await updateUser(userId, { hasValidatedPlanning: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la validation';
      console.error('Error validating desiderata:', { error: err, userId });
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, updateUser]);

  return {
    isSaving,
    error,
    saveDesiderata: saveUserDesiderata,
    validateDesiderata: validateUserDesiderata
  };
};