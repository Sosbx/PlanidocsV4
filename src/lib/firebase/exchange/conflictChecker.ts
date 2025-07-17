import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config';
import { getCollectionName, COLLECTIONS as COLLECTION_NAMES } from '../../../utils/collectionUtils';
import { normalizePeriod } from '../../../utils/dateUtils';

/**
 * Interface pour le résultat de vérification de conflit
 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictSource?: 'bag' | 'direct' | null;
  conflictDetails?: {
    exchangeIds: string[];
    status: string[];
  };
}

/**
 * Vérifie si une garde est déjà proposée dans la bourse aux gardes
 */
export const checkShiftExchangeConflict = async (
  userId: string,
  date: string,
  period: string,
  associationId: string = 'RD'
): Promise<{ exists: boolean, exchangeIds: string[] }> => {
  try {
    const normalizedPeriod = normalizePeriod(period);
    
    const q = query(
      collection(db, getCollectionName(COLLECTION_NAMES.SHIFT_EXCHANGES, associationId)),
      where('userId', '==', userId),
      where('date', '==', date),
      where('period', '==', normalizedPeriod),
      where('status', 'in', ['pending', 'unavailable'])
    );
    
    const querySnapshot = await getDocs(q);
    const exchangeIds = querySnapshot.docs.map(doc => doc.id);
    
    return { 
      exists: !querySnapshot.empty, 
      exchangeIds 
    };
  } catch (error) {
    console.error('Erreur lors de la vérification dans la bourse aux gardes:', error);
    return { exists: false, exchangeIds: [] };
  }
};

/**
 * Vérifie si une garde est déjà proposée dans les échanges directs
 */
export const checkDirectExchangeConflict = async (
  userId: string,
  date: string,
  period: string,
  associationId: string = 'RD'
): Promise<{ exists: boolean, exchangeIds: string[] }> => {
  try {
    const normalizedPeriod = normalizePeriod(period);
    
    // Vérifier dans direct_exchanges (échanges et cessions)
    const directExchangesQuery = query(
      collection(db, getCollectionName('direct_exchanges', associationId)),
      where('userId', '==', userId),
      where('date', '==', date),
      where('period', '==', normalizedPeriod),
      where('status', '==', 'pending')
    );
    
    // Vérifier dans direct_replacements
    const directReplacementsQuery = query(
      collection(db, getCollectionName('direct_replacements', associationId)),
      where('originalUserId', '==', userId),
      where('date', '==', date),
      where('period', '==', normalizedPeriod),
      where('status', '==', 'pending')
    );
    
    const [exchangesSnapshot, replacementsSnapshot] = await Promise.all([
      getDocs(directExchangesQuery),
      getDocs(directReplacementsQuery)
    ]);
    
    const exchangeIds = [
      ...exchangesSnapshot.docs.map(doc => doc.id),
      ...replacementsSnapshot.docs.map(doc => doc.id)
    ];
    
    return { 
      exists: !exchangesSnapshot.empty || !replacementsSnapshot.empty, 
      exchangeIds 
    };
  } catch (error) {
    console.error('Erreur lors de la vérification dans les échanges directs:', error);
    return { exists: false, exchangeIds: [] };
  }
};

/**
 * Vérifie les conflits entre les systèmes d'échange (BaG et échanges directs)
 * @returns Détails sur le conflit s'il existe
 */
export const checkCrossSystemConflict = async (
  userId: string,
  date: string,
  period: string,
  associationId: string = 'RD'
): Promise<ConflictCheckResult> => {
  try {
    const [bagCheck, directCheck] = await Promise.all([
      checkShiftExchangeConflict(userId, date, period, associationId),
      checkDirectExchangeConflict(userId, date, period, associationId)
    ]);
    
    if (bagCheck.exists) {
      return {
        hasConflict: true,
        conflictSource: 'bag',
        conflictDetails: {
          exchangeIds: bagCheck.exchangeIds,
          status: ['pending', 'unavailable']
        }
      };
    }
    
    if (directCheck.exists) {
      return {
        hasConflict: true,
        conflictSource: 'direct',
        conflictDetails: {
          exchangeIds: directCheck.exchangeIds,
          status: ['pending']
        }
      };
    }
    
    return {
      hasConflict: false,
      conflictSource: null
    };
  } catch (error) {
    console.error('Erreur lors de la vérification des conflits entre systèmes:', error);
    // En cas d'erreur, on retourne false pour ne pas bloquer l'utilisateur
    return {
      hasConflict: false,
      conflictSource: null
    };
  }
};

/**
 * Génère un message d'erreur approprié selon la source du conflit
 */
export const getConflictErrorMessage = (conflictSource: 'bag' | 'direct' | null): string => {
  switch (conflictSource) {
    case 'bag':
      return 'Cette garde est déjà proposée dans la bourse aux gardes. Veuillez la retirer de la bourse avant de la proposer en échange direct.';
    case 'direct':
      return 'Cette garde est déjà proposée en échange direct. Veuillez annuler l\'échange direct avant de la proposer dans la bourse aux gardes.';
    default:
      return 'Cette garde est déjà proposée dans un autre système d\'échange.';
  }
};