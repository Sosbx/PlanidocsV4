import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  Timestamp,
  getDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { createParisDate } from './timezoneUtils';

interface MigrationReport {
  totalDocuments: number;
  migratedDocuments: number;
  skippedDocuments: number;
  errorDocuments: Array<{
    id: string;
    error: string;
  }>;
  dryRun: boolean;
  startTime: Date;
  endTime?: Date;
  duration?: string;
}

/**
 * Migre tous les documents exchange_history vers le nouveau format
 * @param dryRun Si true, simule la migration sans modifier les données
 * @param batchSize Nombre de documents à traiter par batch (max 500 pour Firestore)
 */
export const migrateExchangeHistory = async (
  dryRun: boolean = true,
  batchSize: number = 100
): Promise<MigrationReport> => {
  const report: MigrationReport = {
    totalDocuments: 0,
    migratedDocuments: 0,
    skippedDocuments: 0,
    errorDocuments: [],
    dryRun,
    startTime: createParisDate()
  };

  console.log(`=== Début de la migration (${dryRun ? 'MODE TEST' : 'MODE RÉEL'}) ===`);
  
  try {
    // Récupérer tous les documents
    const snapshot = await getDocs(collection(db, 'exchange_history'));
    report.totalDocuments = snapshot.size;
    
    console.log(`Documents à traiter: ${report.totalDocuments}`);
    
    // Cache pour les utilisateurs
    const userCache = new Map<string, any>();
    
    // Traiter par batch
    const batches = [];
    let currentBatch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      try {
        // Vérifier si le document est déjà au nouveau format
        if (data.participants && data.exchanges && data.executedAt) {
          report.skippedDocuments++;
          continue;
        }
        
        // Vérifier que c'est bien l'ancien format
        if (!data.originalUserId || !data.newUserId || !data.date || !data.period) {
          report.errorDocuments.push({
            id: docId,
            error: 'Structure invalide - champs requis manquants'
          });
          continue;
        }
        
        // Récupérer les informations des utilisateurs
        const originalUser = await getUserWithCache(data.originalUserId, userCache);
        const newUser = await getUserWithCache(data.newUserId, userCache);
        
        // Déterminer l'associationId
        let associationId = data.associationId;
        if (!associationId) {
          // Essayer de déterminer depuis les utilisateurs
          if (originalUser?.associationId) {
            associationId = originalUser.associationId;
          } else if (newUser?.associationId) {
            associationId = newUser.associationId;
          } else {
            associationId = 'RD'; // Par défaut
          }
        }
        
        // Créer la structure du nouveau format
        const newData = {
          // Conserver tous les champs existants
          ...data,
          
          // Ajouter les nouveaux champs
          participants: [
            {
              userId: data.originalUserId,
              userName: originalUser 
                ? `${originalUser.firstName || ''} ${originalUser.lastName || ''}`.trim() || 'Utilisateur inconnu'
                : 'Utilisateur inconnu'
            },
            {
              userId: data.newUserId,
              userName: newUser
                ? `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || 'Utilisateur inconnu'
                : 'Utilisateur inconnu'
            }
          ],
          
          exchanges: data.isPermutation ? [
            {
              date: data.date,
              shiftType: data.originalShiftType || data.shiftType,
              period: data.period,
              timeSlot: data.timeSlot,
              previousAssignment: { userId: data.originalUserId },
              newAssignment: { userId: data.newUserId }
            },
            {
              date: data.date,
              shiftType: data.newShiftType || data.shiftType,
              period: data.period,
              timeSlot: data.timeSlot,
              previousAssignment: { userId: data.newUserId },
              newAssignment: { userId: data.originalUserId }
            }
          ] : [
            {
              date: data.date,
              shiftType: data.shiftType,
              period: data.period,
              timeSlot: data.timeSlot,
              previousAssignment: { userId: data.originalUserId },
              newAssignment: { userId: data.newUserId }
            }
          ],
          
          executedAt: data.exchangedAt 
            ? (typeof data.exchangedAt === 'string' 
              ? Timestamp.fromDate(new Date(data.exchangedAt))
              : data.exchangedAt)
            : Timestamp.now(),
          
          associationId,
          
          // Marquer comme migré
          migratedAt: Timestamp.now(),
          migratedFrom: 'oldFormat'
        };
        
        // Ajouter au batch si pas en mode test
        if (!dryRun) {
          currentBatch.update(doc(db, 'exchange_history', docId), newData);
          batchCount++;
          
          // Si le batch est plein, le committer et en créer un nouveau
          if (batchCount >= batchSize) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        }
        
        report.migratedDocuments++;
        
        if (report.migratedDocuments % 10 === 0) {
          console.log(`Progression: ${report.migratedDocuments}/${report.totalDocuments}`);
        }
        
      } catch (error) {
        report.errorDocuments.push({
          id: docId,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }
    
    // Ajouter le dernier batch s'il contient des documents
    if (batchCount > 0 && !dryRun) {
      batches.push(currentBatch);
    }
    
    // Exécuter tous les batches
    if (!dryRun && batches.length > 0) {
      console.log(`Exécution de ${batches.length} batches...`);
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`Batch ${i + 1}/${batches.length} exécuté`);
      }
    }
    
    // Finaliser le rapport
    report.endTime = createParisDate();
    const duration = report.endTime.getTime() - report.startTime.getTime();
    report.duration = `${Math.round(duration / 1000)} secondes`;
    
    // Afficher le rapport
    console.log('\n=== RAPPORT DE MIGRATION ===');
    console.log(`Mode: ${report.dryRun ? 'TEST' : 'RÉEL'}`);
    console.log(`Total des documents: ${report.totalDocuments}`);
    console.log(`Documents migrés: ${report.migratedDocuments}`);
    console.log(`Documents ignorés (déjà au nouveau format): ${report.skippedDocuments}`);
    console.log(`Documents en erreur: ${report.errorDocuments.length}`);
    console.log(`Durée: ${report.duration}`);
    
    if (report.errorDocuments.length > 0) {
      console.log('\nDocuments en erreur:');
      report.errorDocuments.forEach(err => {
        console.log(`- ${err.id}: ${err.error}`);
      });
    }
    
    if (report.dryRun) {
      console.log('\n⚠️  ATTENTION: Ceci était un test. Aucune donnée n\'a été modifiée.');
      console.log('Pour exécuter la migration réelle, appelez: migrateExchangeHistory(false)');
    } else {
      console.log('\n✅ Migration terminée avec succès!');
    }
    
    return report;
    
  } catch (error) {
    console.error('Erreur lors de la migration:', error);
    throw error;
  }
};

/**
 * Récupère un utilisateur avec cache
 */
async function getUserWithCache(
  userId: string, 
  cache: Map<string, any>
): Promise<any> {
  if (!userId) return null;
  
  if (cache.has(userId)) {
    return cache.get(userId);
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : null;
    cache.set(userId, userData);
    return userData;
  } catch (error) {
    cache.set(userId, null);
    return null;
  }
}

/**
 * Vérifie si la migration est nécessaire
 */
export const checkMigrationNeeded = async (): Promise<{
  needed: boolean;
  oldFormatCount: number;
  newFormatCount: number;
  totalCount: number;
}> => {
  const snapshot = await getDocs(collection(db, 'exchange_history'));
  let oldFormatCount = 0;
  let newFormatCount = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.participants && data.exchanges && data.executedAt) {
      newFormatCount++;
    } else if (data.originalUserId && data.newUserId) {
      oldFormatCount++;
    }
  });
  
  return {
    needed: oldFormatCount > 0,
    oldFormatCount,
    newFormatCount,
    totalCount: snapshot.size
  };
};

// Exposer les fonctions globalement pour la console
if (typeof window !== 'undefined') {
  (window as any).migrateExchangeHistory = migrateExchangeHistory;
  (window as any).checkMigrationNeeded = checkMigrationNeeded;
}