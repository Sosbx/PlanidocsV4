import { useState, useCallback } from 'react';
import { getDesiderata, saveDesiderata, validateDesiderata } from '../../../lib/firebase/desiderata';
import { useAuth } from '../../../features/auth/hooks';
import { useUsers } from '../../../features/auth/hooks';
import type { PeriodSelection } from '../types';

/**
 * Hook pour gérer les desiderata (préférences de planning) d'un utilisateur
 * Permet de sauvegarder et valider les desiderata
 */
export const useDesiderata = () => {
  const { user } = useAuth();
  const { updateUser } = useUsers();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sauvegarde les desiderata d'un utilisateur
   * @param selections - Les sélections de périodes (primary, secondary ou null)
   * @returns true si la sauvegarde a réussi, false sinon
   */
  const saveUserDesiderata = useCallback(async (selections: Record<string, PeriodSelection['type']>) => {
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

  /**
   * Valide les desiderata d'un utilisateur
   * @param userId - L'identifiant de l'utilisateur
   * @returns true si la validation a réussi, false sinon
   */
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

export default useDesiderata;
