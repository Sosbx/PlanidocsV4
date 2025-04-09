import { collection, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../config';
import { format } from 'date-fns';
import { normalizePeriod } from '../../../utils/dateUtils';
import { ShiftPeriod } from '../../../types/exchange';
import { COLLECTIONS } from './types';
import { validateExchangeData, checkExistingExchange, checkExistingShiftExchange, checkDesiderata } from './core';
import { ExchangeData } from './directExchangeOperations';
import { ShiftExchange as PlanningShiftExchange } from '../../../types/planning';
import { createReplacement } from '../replacements';

/**
 * Ajouter un remplacement direct
 */
export const addDirectReplacement = async (
  replacement: ExchangeData & { comment?: string }
): Promise<string> => {
  try {
    console.log('Ajout d\'un remplacement direct:', replacement);
    
    // Validation des données
    validateExchangeData(replacement);
    
    // Vérifier si un remplacement existe déjà
    const existingReplacement = await checkExistingExchange(
      replacement.userId,
      replacement.date,
      replacement.period,
      'replacement'
    );
    
    if (existingReplacement) {
      console.warn('Un remplacement existe déjà pour cette garde:', {
        userId: replacement.userId,
        date: replacement.date,
        period: replacement.period
      });
    }
    
    // Vérifier si la garde est déjà dans la bourse aux gardes
    const existingInShiftExchange = await checkExistingShiftExchange(
      replacement.userId,
      replacement.date,
      replacement.period
    );
    
    if (existingInShiftExchange) {
      console.warn('Cette garde est déjà proposée dans la bourse aux gardes. Cela pourrait causer des conflits.');
    }
    
    // Vérifier si la garde est un désiderata
    const desiderataCheck = await checkDesiderata(
      replacement.userId,
      replacement.date,
      replacement.period
    );
    
    if (desiderataCheck.isDesiderata) {
      console.warn(`Cette garde est un désiderata ${desiderataCheck.type}. Cela pourrait causer des conflits.`);
    }
    
    // Créer le remplacement
    const replacementRef = doc(collection(db, COLLECTIONS.DIRECT_REPLACEMENTS));
    
    // Formater la date au format YYYY-MM-DD
    let formattedDate = replacement.date;
    try {
      formattedDate = format(new Date(replacement.date), 'yyyy-MM-dd');
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      // Continuer avec la date originale si le formatage échoue
    }
    
    await runTransaction(db, async (transaction) => {
      // Vérifier que l'utilisateur a bien cette garde
      // Cette vérification sera implémentée plus tard
      
      // Créer le remplacement uniquement dans la collection DIRECT_REPLACEMENTS
      transaction.set(replacementRef, {
        ...replacement,
        date: formattedDate,
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        status: 'pending',
        interestedUsers: [],
        exchangeType: 'direct',
        operationType: 'replacement'
      });
      
      // Ne pas créer de document dans la collection remplacements
      // La collection DIRECT_REPLACEMENTS est la seule à utiliser
    });
    
    console.log('Remplacement direct ajouté avec succès, ID:', replacementRef.id);
    return replacementRef.id;
  } catch (error) {
    console.error('Error adding direct replacement:', error);
    throw error;
  }
};
