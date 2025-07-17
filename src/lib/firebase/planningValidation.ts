import { doc, runTransaction, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { finalizeAllExchanges } from './exchange';
import { addDirectExchange } from './directExchange';
import { ShiftExchange } from '../../types/planning';
import { ShiftPeriod } from '../../types/exchange';

/**
 * Valide le planning de la bourse aux gardes après la phase 3
 * Cette fonction marque le planning comme validé et met à jour les périodes
 * @returns Promise<void>
 */
export const validateBagPlanning = async (): Promise<void> => {
  try {
    // 1. Récupérer toutes les données nécessaires avant de commencer la transaction
    const configRef = doc(db, 'config', 'bag_phase_config');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      throw new Error('Configuration non trouvée');
    }
    
    const config = configDoc.data();
    
    // 2. Vérifier que nous sommes bien en phase 'completed'
    if (config.phase !== 'completed') {
      throw new Error('La bourse aux gardes n\'est pas en phase terminée');
    }
    
    // 3. Récupérer les périodes de planning
    const periodsRef = doc(db, 'config', 'planning_periods');
    const periodsDoc = await getDoc(periodsRef);
    
    // 4. Récupérer les échanges en attente
    const pendingExchangesQuery = query(
      collection(db, 'shift_exchanges'),
      where('status', '==', 'pending')
    );
    const pendingExchangesSnapshot = await getDocs(pendingExchangesQuery);
    
    // 5. Récupérer les échanges finalisés pour le transfert vers les échanges directs
    const finalizedExchangesQuery = query(
      collection(db, 'shift_exchanges'),
      where('status', '==', 'unavailable')
    );
    const finalizedExchangesSnapshot = await getDocs(finalizedExchangesQuery);
    
    // 6. Maintenant que toutes les lectures sont effectuées, commencer la transaction pour les écritures
    await runTransaction(db, async (transaction) => {
      // 6.1 Marquer le planning comme validé
      transaction.update(configRef, {
        isValidated: true,
        validatedAt: serverTimestamp()
      });
      
      // 6.2 Mettre à jour la période du planning courant
      let currentPeriod;
      
      if (periodsDoc.exists()) {
        const periods = periodsDoc.data();
        
        // Mettre à jour la période courante avec la période future
        if (periods.futurePeriod) {
          currentPeriod = periods.futurePeriod;
          transaction.update(periodsRef, {
            currentPeriod: periods.futurePeriod,
            futurePeriod: null
          });
        }
      } else {
        // Si le document n'existe pas, le créer
        currentPeriod = {
          startDate: createParisDate(),
          endDate: new Date(createParisDate().setMonth(createParisDate().getMonth() + 3))
        };
        
        transaction.set(periodsRef, {
          currentPeriod,
          futurePeriod: null
        });
      }
      
      // 6.3 Finaliser tous les échanges en attente
      pendingExchangesSnapshot.docs.forEach(docSnapshot => {
        transaction.update(docSnapshot.ref, {
          status: 'unavailable',
          lastModified: serverTimestamp(),
          finalizedAt: serverTimestamp()
        });
      });
      
      // 6.4 Créer des échanges directs pour les gardes finalisées qui sont dans la période courante
      if (currentPeriod) {
        const startDate = currentPeriod.startDate instanceof Date 
          ? currentPeriod.startDate 
          : firebaseTimestampToParisDate(currentPeriod.startDate);
        
        const endDate = currentPeriod.endDate instanceof Date 
          ? currentPeriod.endDate 
          : firebaseTimestampToParisDate(currentPeriod.endDate);
        
        for (const docSnapshot of finalizedExchangesSnapshot.docs) {
          const exchange = docSnapshot.data() as ShiftExchange;
          
          // Vérifier si l'échange est dans la période courante
          const exchangeDate = new Date(exchange.date);
          
          if (exchangeDate >= startDate && exchangeDate <= endDate) {
            // Créer un échange direct
            const directExchangesCollection = collection(db, 'direct_exchanges');
            const directExchangeRef = doc(directExchangesCollection);
            transaction.set(directExchangeRef, {
              userId: exchange.userId,
              date: exchange.date,
              period: exchange.period as any,
              shiftType: exchange.shiftType,
              timeSlot: exchange.timeSlot,
              comment: exchange.comment || '',
              operationType: 'exchange',
              operationTypes: ['exchange'],
              status: 'pending',
              lastModified: serverTimestamp(),
              createdAt: serverTimestamp(),
              interestedUsers: [],
              exchangeType: 'direct'
            });
          }
        }
      }
    });
    
    console.log('Planning validé avec succès');
    
  } catch (error) {
    console.error('Error validating BAG planning:', error);
    throw error;
  }
};

/**
 * Définit la période du prochain planning pour la bourse aux gardes
 * @param startDate Date de début du prochain planning
 * @param endDate Date de fin du prochain planning
 * @returns Promise<void>
 */
export const setNextPlanningPeriod = async (startDate: Date, endDate: Date): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      const periodsRef = doc(db, 'config', 'planning_periods');
      const periodsDoc = await transaction.get(periodsRef);
      
      if (periodsDoc.exists()) {
        // Mettre à jour la période future
        transaction.update(periodsRef, {
          futurePeriod: {
            startDate,
            endDate
          }
        });
      } else {
        // Si le document n'existe pas, le créer
        transaction.set(periodsRef, {
          currentPeriod: {
            startDate: createParisDate(),
            endDate: new Date(createParisDate().setMonth(createParisDate().getMonth() + 3))
          },
          futurePeriod: {
            startDate,
            endDate
          }
        });
      }
      
      // Mettre à jour la configuration de la bourse aux gardes
      const configRef = doc(db, 'config', 'bag_phase_config');
      const configDoc = await transaction.get(configRef);
      
      if (configDoc.exists()) {
        transaction.update(configRef, {
          nextPlanningStartDate: startDate
        });
      }
    });
  } catch (error) {
    console.error('Error setting next planning period:', error);
    throw error;
  }
};

/**
 * Vérifie si une date est dans la période de la bourse aux gardes
 * @param date Date à vérifier
 * @returns Promise<boolean>
 */
/**
 * Transfère les gardes du planning validé vers les échanges directs
 * Cette fonction est appelée après la validation du planning
 * @returns Promise<void>
 */
const transferToDirectExchanges = async (): Promise<void> => {
  try {
    // Récupérer les périodes de planning
    const periodsRef = doc(db, 'config', 'planning_periods');
    const periodsDoc = await getDoc(periodsRef);
    
    if (!periodsDoc.exists()) {
      console.warn('Périodes de planning non trouvées');
      return;
    }
    
    const periods = periodsDoc.data();
    const currentPeriod = periods.currentPeriod;
    
    if (!currentPeriod) {
      console.warn('Période courante non définie');
      return;
    }
    
    // Récupérer les échanges de la bourse aux gardes qui ont été finalisés
    const exchangesRef = collection(db, 'shift_exchanges');
    const q = query(
      exchangesRef,
      where('status', '==', 'unavailable')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Pour chaque échange, créer un échange direct
    for (const docSnapshot of querySnapshot.docs) {
      const exchange = docSnapshot.data() as ShiftExchange;
      
      // Vérifier si l'échange est dans la période courante
      const exchangeDate = new Date(exchange.date);
      const startDate = new Date(firebaseTimestampToParisDate(currentPeriod.startDate));
      const endDate = new Date(firebaseTimestampToParisDate(currentPeriod.endDate));
      
      if (exchangeDate >= startDate && exchangeDate <= endDate) {
        try {
          // Créer un échange direct
          await addDirectExchange({
            userId: exchange.userId,
            date: exchange.date,
            period: exchange.period as any,
            shiftType: exchange.shiftType,
            timeSlot: exchange.timeSlot,
            comment: exchange.comment || '',
            operationType: 'exchange',
            operationTypes: ['exchange'],
            status: 'pending',
            lastModified: createParisDate().toISOString(),
            interestedUsers: []
          });
        } catch (error) {
          console.error('Error creating direct exchange:', error);
          // Continue même en cas d'erreur
        }
      }
    }
  } catch (error) {
    console.error('Error transferring to direct exchanges:', error);
    // Ne pas propager l'erreur pour ne pas bloquer la validation du planning
  }
};

export const isDateInBagPeriod = async (date: Date): Promise<boolean> => {
  try {
    const periodsRef = doc(db, 'config', 'planning_periods');
    const periodsDoc = await getDoc(periodsRef);
    
    if (!periodsDoc.exists()) {
      return false;
    }
    
    const periods = periodsDoc.data();
    
    if (!periods?.futurePeriod) {
      return false;
    }
    
    const futurePeriod = periods.futurePeriod;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const startDate = new Date(firebaseTimestampToParisDate(futurePeriod.startDate));
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(firebaseTimestampToParisDate(futurePeriod.endDate));
    endDate.setHours(23, 59, 59, 999);
    
    return checkDate >= startDate && checkDate <= endDate;
  } catch (error) {
    console.error('Error checking if date is in BAG period:', error);
    return false;
  }
};
