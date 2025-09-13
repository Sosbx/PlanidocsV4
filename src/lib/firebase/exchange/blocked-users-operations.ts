import { collection, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from './types';
import { blockedUsersManager } from './blocked-users-manager';

/**
 * Récupère le nom d'un utilisateur pour l'affichage
 */
async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
    if (!userDoc.empty) {
      const userData = userDoc.docs[0].data();
      return `${userData.firstName} ${userData.lastName}`;
    }
    return userId;
  } catch (error) {
    console.error('Erreur lors de la récupération du nom utilisateur:', error);
    return userId;
  }
}

/**
 * Recalcule les utilisateurs bloqués pour tous les échanges d'un créneau donné
 * Cette fonction est appelée après une annulation d'échange pour s'assurer
 * que les blocages sont toujours valides
 * 
 * @deprecated Utiliser blockedUsersManager.updateBlockedUsersForSlot() à la place
 */
export const recalculateBlockedUsersForSlot = async (
  date: string,
  period: string
): Promise<void> => {
  // Déléguer au nouveau gestionnaire
  return blockedUsersManager.updateBlockedUsersForSlot(date, period);
};

/**
 * Vérifie si des échanges sont devenus invalides suite à une annulation
 * Par exemple, une permutation où l'un des utilisateurs n'a plus la garde à échanger
 */
export const checkInvalidExchanges = async (
  date: string,
  period: string
): Promise<void> => {
  try {
    console.log(`Vérification des échanges invalides pour ${date} - ${period}`);
    
    // 1. Récupérer tous les échanges validés pour ce créneau
    const validatedExchangesQuery = query(
      collection(db, COLLECTIONS.HISTORY),
      where('date', '==', date),
      where('period', '==', period),
      where('status', '==', 'completed')
    );
    
    const validatedExchangesSnapshot = await getDocs(validatedExchangesQuery);
    const validatedExchanges = validatedExchangesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 2. Vérifier la cohérence de chaque échange
    for (const exchange of validatedExchanges) {
      // Pour une permutation, vérifier que les deux utilisateurs ont bien les gardes qu'ils échangent
      if (exchange.isPermutation) {
        // TODO: Implémenter la vérification des plannings
        // Si l'un des utilisateurs n'a plus la garde, marquer l'échange comme invalide
        console.log(`Vérification de la permutation ${exchange.id}`);
      }
    }
    
    console.log(`Vérification terminée pour ${date} - ${period}`);
  } catch (error) {
    console.error('Erreur lors de la vérification des échanges invalides:', error);
    throw error;
  }
};