import { collection, getDocs, query, where, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import type { ShiftReplacement, ShiftExchange } from '../../types/planning';
import { Timestamp } from 'firebase/firestore';

/**
 * Récupère les remplacements proposés pour un utilisateur spécifique
 * @param userId ID de l'utilisateur
 * @returns Liste des remplacements proposés par l'utilisateur
 */
export const getReplacementsForUser = async (userId: string): Promise<ShiftReplacement[]> => {
  try {
    const replacementsQuery = query(
      collection(db, 'remplacements'),
      where('originalUserId', '==', userId)
    );
    
    const querySnapshot = await getDocs(replacementsQuery);
    const replacements = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ShiftReplacement[];
    
    return replacements;
  } catch (error) {
    console.error('Error getting replacements:', error);
    return [];
  }
};

/**
 * Crée un nouveau remplacement à partir d'un échange
 * @param exchange L'échange à proposer aux remplaçants
 * @returns ID du document créé
 */
export const createReplacement = async (exchange: ShiftExchange): Promise<string> => {
  try {
    // Vérifier si un remplacement existe déjà pour cet échange
    const existingQuery = query(
      collection(db, 'remplacements'),
      where('exchangeId', '==', exchange.id)
    );
    
    const querySnapshot = await getDocs(existingQuery);
    
    // Si un remplacement existe déjà, retourner son ID
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    
    // Créer un nouveau document de remplacement
    const replacementData: Omit<ShiftReplacement, 'id'> = {
      exchangeId: exchange.id,
      date: exchange.date,
      period: exchange.period,
      shiftType: exchange.shiftType,
      timeSlot: exchange.timeSlot,
      originalUserId: exchange.userId,
      createdAt: createParisDate().toISOString(),
      status: 'pending',
      notifiedUsers: []
    };
    
    const docRef = await addDoc(collection(db, 'remplacements'), {
      ...replacementData,
      createdAt: Timestamp.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating replacement:', error);
    throw error;
  }
};

/**
 * Supprime un remplacement associé à un échange
 * @param exchangeId ID de l'échange
 * @returns void
 */
export const deleteReplacement = async (exchangeId: string): Promise<void> => {
  try {
    // Rechercher le remplacement par exchangeId
    const replacementsQuery = query(
      collection(db, 'remplacements'),
      where('exchangeId', '==', exchangeId)
    );
    
    const querySnapshot = await getDocs(replacementsQuery);
    
    // Si un remplacement est trouvé, le supprimer
    if (!querySnapshot.empty) {
      const replacementDoc = querySnapshot.docs[0];
      await deleteDoc(doc(db, 'remplacements', replacementDoc.id));
    }
  } catch (error) {
    console.error('Error deleting replacement:', error);
    throw error;
  }
};

/**
 * Récupère tous les remplacements
 * @returns Liste de tous les remplacements
 */
export const getAllReplacements = async (): Promise<ShiftReplacement[]> => {
  try {
    const replacementsQuery = query(collection(db, 'remplacements'));
    
    const querySnapshot = await getDocs(replacementsQuery);
    const replacements = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ShiftReplacement[];
    
    return replacements;
  } catch (error) {
    console.error('Error getting all replacements:', error);
    return [];
  }
};
