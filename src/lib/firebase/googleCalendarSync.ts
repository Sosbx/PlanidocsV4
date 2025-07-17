import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { createParisDate, firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { getCollectionName } from '../../utils/collectionUtils';
import type { CalendarSyncRecord } from '../../types/googleCalendar';

const SYNC_COLLECTION = 'google_calendar_sync';

/**
 * Obtenir tous les enregistrements de synchronisation pour un utilisateur
 */
export async function getUserSyncRecords(
  userId: string,
  associationId?: string
): Promise<CalendarSyncRecord[]> {
  try {
    const syncCollection = collection(db, getCollectionName(SYNC_COLLECTION, associationId));
    const q = query(syncCollection, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      lastSyncedAt: doc.data().lastSyncedAt?.toDate() || createParisDate(),
    })) as CalendarSyncRecord[];
  } catch (error) {
    console.error('Error fetching sync records:', error);
    return [];
  }
}

/**
 * Sauvegarder un enregistrement de synchronisation
 */
export async function saveSyncRecord(
  record: CalendarSyncRecord,
  associationId?: string
): Promise<void> {
  try {
    const syncCollection = collection(db, getCollectionName(SYNC_COLLECTION, associationId));
    const docRef = doc(syncCollection, `${record.userId}_${record.assignmentKey}`);
    
    await setDoc(docRef, {
      ...record,
      lastSyncedAt: Timestamp.fromDate(record.lastSyncedAt),
    });
  } catch (error) {
    console.error('Error saving sync record:', error);
    throw error;
  }
}

/**
 * Sauvegarder plusieurs enregistrements en batch
 */
export async function saveSyncRecordsBatch(
  records: CalendarSyncRecord[],
  associationId?: string
): Promise<void> {
  if (records.length === 0) return;
  
  try {
    const batch = writeBatch(db);
    const syncCollection = collection(db, getCollectionName(SYNC_COLLECTION, associationId));
    
    records.forEach(record => {
      const docRef = doc(syncCollection, `${record.userId}_${record.assignmentKey}`);
      batch.set(docRef, {
        ...record,
        lastSyncedAt: Timestamp.fromDate(record.lastSyncedAt),
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error saving sync records batch:', error);
    throw error;
  }
}

/**
 * Supprimer un enregistrement de synchronisation
 */
export async function deleteSyncRecord(
  userId: string,
  assignmentKey: string,
  associationId?: string
): Promise<void> {
  try {
    const syncCollection = collection(db, getCollectionName(SYNC_COLLECTION, associationId));
    const docRef = doc(syncCollection, `${userId}_${assignmentKey}`);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting sync record:', error);
    throw error;
  }
}

/**
 * Supprimer plusieurs enregistrements en batch
 */
export async function deleteSyncRecordsBatch(
  recordIds: Array<{ userId: string; assignmentKey: string }>,
  associationId?: string
): Promise<void> {
  if (recordIds.length === 0) return;
  
  try {
    const batch = writeBatch(db);
    const syncCollection = collection(db, getCollectionName(SYNC_COLLECTION, associationId));
    
    recordIds.forEach(({ userId, assignmentKey }) => {
      const docRef = doc(syncCollection, `${userId}_${assignmentKey}`);
      batch.delete(docRef);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting sync records batch:', error);
    throw error;
  }
}

/**
 * Nettoyer tous les enregistrements de synchronisation pour un utilisateur
 */
export async function clearUserSyncRecords(
  userId: string,
  associationId?: string
): Promise<void> {
  try {
    const records = await getUserSyncRecords(userId, associationId);
    const recordIds = records.map(r => ({
      userId: r.userId,
      assignmentKey: r.assignmentKey,
    }));
    
    await deleteSyncRecordsBatch(recordIds, associationId);
  } catch (error) {
    console.error('Error clearing user sync records:', error);
    throw error;
  }
}