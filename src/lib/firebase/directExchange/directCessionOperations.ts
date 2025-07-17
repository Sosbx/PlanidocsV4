import { collection, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { formatParisDate } from '@/utils/timezoneUtils';
import { db } from '../config';
import { format } from 'date-fns';
import { normalizePeriod } from '../../../utils/dateUtils';
import { COLLECTIONS } from './types';
import { validateExchangeData, checkExistingExchange, checkExistingShiftExchange, checkDesiderata, removeFromShiftExchange } from './core';
import { ExchangeData } from './directExchangeOperations';

/**
 * Ajouter une cession directe
 */
export const addDirectCession = async (
  cession: ExchangeData & { comment?: string }
): Promise<string> => {
  try {
    console.log('Ajout d\'une cession directe:', cession);
    
    // Validation des données
    validateExchangeData(cession);
    
    // Vérifier si une cession existe déjà
    const existingCession = await checkExistingExchange(
      cession.userId,
      cession.date,
      cession.period,
      'give'
    );
    
    if (existingCession) {
      console.warn('Une cession existe déjà pour cette garde:', {
        userId: cession.userId,
        date: cession.date,
        period: cession.period
      });
    }
    
    // Vérifier si la garde est déjà dans la bourse aux gardes
    const { exists: existingInShiftExchange, exchangeIds } = await checkExistingShiftExchange(
      cession.userId,
      cession.date,
      cession.period
    );
    
    if (existingInShiftExchange) {
      console.warn('Cette garde est déjà proposée dans la bourse aux gardes. Elle sera automatiquement retirée.');
    }
    
    // Vérifier si la garde est un désiderata
    const desiderataCheck = await checkDesiderata(
      cession.userId,
      cession.date,
      cession.period
    );
    
    if (desiderataCheck.isDesiderata) {
      console.warn(`Cette garde est un désiderata ${desiderataCheck.type}. Cela pourrait causer des conflits.`);
    }
    
    // Créer la cession
    const cessionRef = doc(collection(db, COLLECTIONS.DIRECT_CESSIONS));
    
    // Formater la date au format YYYY-MM-DD
    let formattedDate = cession.date;
    try {
      formattedDate = formatParisDate(new Date(cession.date), 'yyyy-MM-dd');
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      // Continuer avec la date originale si le formatage échoue
    }
    
    await runTransaction(db, async (transaction) => {
      // Vérifier que l'utilisateur a bien cette garde
      // Cette vérification sera implémentée plus tard
      
      // Si la garde existe déjà dans la bourse aux gardes, la supprimer
      if (existingInShiftExchange && exchangeIds.length > 0) {
        await removeFromShiftExchange(transaction, exchangeIds);
      }
      
      // Créer la cession
      transaction.set(cessionRef, {
        ...cession,
        date: formattedDate,
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        status: 'pending',
        interestedUsers: [],
        exchangeType: 'direct',
        operationType: 'give'
      });
    });
    
    console.log('Cession directe ajoutée avec succès, ID:', cessionRef.id);
    return cessionRef.id;
  } catch (error) {
    console.error('Error adding direct cession:', error);
    throw error;
  }
};
