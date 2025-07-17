import { collection, doc, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { createParisDate } from '@/utils/timezoneUtils';
import { db } from './config';
import { COLLECTIONS } from '../../utils/collectionUtils';
import type { Selections } from '../../types/planning';
import { formatParisDate } from '../../utils/timezoneUtils';

export interface ArchivedDesiderata {
  userId: string;
  selections: Selections;
  validatedAt: Date | string;
  archivedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  associationId: string;
  periodName: string;
  totalUsers: number;
}

/**
 * Archive les desiderata d'une période de planning
 * @param desiderataData - Map des desiderata validés (userId -> data)
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @param associationId - ID de l'association (RD ou RG)
 * @param totalUsers - Nombre total d'utilisateurs de l'association
 */
export async function archiveDesiderata(
  desiderataData: Record<string, any>,
  periodStart: Date,
  periodEnd: Date,
  associationId: string,
  totalUsers: number
): Promise<void> {
  try {
    console.log(`Archivage des desiderata pour l'association ${associationId}`);
    
    const batch = writeBatch(db);
    const periodName = `${formatParisDate(periodStart, 'dd/MM/yyyy')} - ${formatParisDate(periodEnd, 'dd/MM/yyyy')}`;
    
    // Pour chaque utilisateur avec des desiderata validés
    Object.entries(desiderataData).forEach(([userId, data]) => {
      if (data.validatedAt && data.selections) {
        const docRef = doc(collection(db, COLLECTIONS.ARCHIVED_DESIDERATA));
        
        const archivedData: ArchivedDesiderata = {
          userId,
          selections: data.selections,
          validatedAt: data.validatedAt,
          archivedAt: createParisDate(),
          periodStart,
          periodEnd,
          associationId,
          periodName,
          totalUsers
        };
        
        batch.set(docRef, archivedData);
      }
    });
    
    await batch.commit();
    console.log(`${Object.keys(desiderataData).length} desiderata archivés pour ${associationId}`);
  } catch (error) {
    console.error('Erreur lors de l\'archivage des desiderata:', error);
    throw error;
  }
}

/**
 * Récupère les desiderata archivés pour une association et une période
 * @param associationId - ID de l'association
 * @param periodStart - Date de début de la période (optionnel)
 * @param periodEnd - Date de fin de la période (optionnel)
 */
export async function getArchivedDesiderata(
  associationId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<ArchivedDesiderata[]> {
  try {
    let q = query(
      collection(db, COLLECTIONS.ARCHIVED_DESIDERATA),
      where('associationId', '==', associationId)
    );
    
    if (periodStart && periodEnd) {
      q = query(
        collection(db, COLLECTIONS.ARCHIVED_DESIDERATA),
        where('associationId', '==', associationId),
        where('periodStart', '>=', periodStart),
        where('periodEnd', '<=', periodEnd)
      );
    }
    
    const snapshot = await getDocs(q);
    const archivedData: ArchivedDesiderata[] = [];
    
    snapshot.forEach(doc => {
      archivedData.push(doc.data() as ArchivedDesiderata);
    });
    
    return archivedData;
  } catch (error) {
    console.error('Erreur lors de la récupération des desiderata archivés:', error);
    throw error;
  }
}