import { 
  collection, 
  getDocs, 
  getDoc,
  setDoc,
  query, 
  where, 
  orderBy,
  limit,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config';
import { revertToExchange } from './history-operations';
import { restoreNotTakenToPending, restorePendingExchanges } from './core';
import { createParisDate } from '../../../utils/timezoneUtils';
import { ExchangeHistory, defaultBagPhaseConfig } from '../../../types/planning';

interface RestoreReport {
  totalExchanges: number;
  revertedExchanges: number;
  failedExchanges: Array<{
    id: string;
    error: string;
  }>;
  restoredNotTaken: number;
  restoredPending: number;
  phaseChanged: boolean;
  startTime: Date;
  endTime?: Date;
  duration?: string;
  backupCreated: boolean;
  backupId?: string;
}

interface BackupData {
  id: string;
  createdAt: any;
  createdBy?: string;
  reason: string;
  collections: {
    shift_exchanges: any[];
    planning_generated: any[];
    exchange_history: any[];
    bag_config: any;
  };
  metadata: {
    exchangeCount: number;
    shiftExchangeCount: number;
    planningsAffected: number;
    previousPhase: string;
  };
}

/**
 * Met à jour la phase de la bourse aux gardes
 * Fonction locale pour éviter les dépendances circulaires
 */
async function updateBagPhase(config: { phase: string }) {
  const configRef = doc(db, 'config', 'bag_phase_config');
  
  // Récupérer la configuration actuelle
  const configDoc = await getDoc(configRef);
  const currentConfig = configDoc.exists() 
    ? configDoc.data() 
    : defaultBagPhaseConfig;
  
  // Mettre à jour avec la nouvelle phase
  await setDoc(configRef, {
    ...currentConfig,
    phase: config.phase,
    updatedAt: serverTimestamp()
  });
}

/**
 * Supprime les anciens backups pour maintenir une limite
 * Garde les N backups les plus récents
 */
async function rotateBackups(keepCount: number = 10): Promise<void> {
  try {
    const backupsQuery = query(
      collection(db, 'bag_backups'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(backupsQuery);
    
    // Si on a plus de backups que la limite
    if (snapshot.docs.length > keepCount) {
      const batch = writeBatch(db);
      const docsToDelete = snapshot.docs.slice(keepCount);
      
      console.log(`Suppression de ${docsToDelete.length} anciens backups...`);
      
      for (const doc of docsToDelete) {
        // Supprimer le document principal
        batch.delete(doc.ref);
        
        // Supprimer aussi le sous-document des collections
        const collectionsRef = doc(db, 'bag_backups', doc.id, 'data', 'collections');
        batch.delete(collectionsRef);
      }
      
      await batch.commit();
      console.log(`${docsToDelete.length} anciens backups supprimés`);
    }
  } catch (error) {
    console.error('Erreur lors de la rotation des backups:', error);
    // Ne pas bloquer la création du nouveau backup
  }
}

/**
 * Crée une sauvegarde complète avant restauration
 * Sauvegarde toutes les collections affectées par la restauration
 */
async function createCompleteBackup(userId?: string): Promise<string> {
  console.log('Création d\'un backup complet...');
  
  try {
    // Rotation des anciens backups avant d'en créer un nouveau
    await rotateBackups(10);
    // 1. Récupérer la configuration actuelle de la BAG
    const configRef = doc(db, 'config', 'bag_phase_config');
    const configDoc = await getDoc(configRef);
    const currentConfig = configDoc.exists() ? configDoc.data() : defaultBagPhaseConfig;
    
    // 2. Récupérer tous les échanges en cours
    const shiftExchangesSnapshot = await getDocs(collection(db, 'shift_exchanges'));
    const shiftExchanges = shiftExchangesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 3. Récupérer tout l'historique des échanges
    const historySnapshot = await getDocs(collection(db, 'exchange_history'));
    const exchangeHistory = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 4. Récupérer tous les plannings générés
    const planningsSnapshot = await getDocs(collection(db, 'planning_generated'));
    const plannings = planningsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 5. Calculer les métadonnées
    const affectedUserIds = new Set<string>();
    exchangeHistory.forEach((exchange: any) => {
      if (exchange.status === 'completed') {
        affectedUserIds.add(exchange.originalUserId);
        affectedUserIds.add(exchange.newUserId);
      }
    });
    
    // 6. Créer le document de backup
    const backupRef = doc(collection(db, 'bag_backups'));
    const backupData: BackupData = {
      id: backupRef.id,
      createdAt: serverTimestamp(),
      createdBy: userId,
      reason: 'before_global_restore',
      collections: {
        shift_exchanges: shiftExchanges,
        planning_generated: plannings,
        exchange_history: exchangeHistory,
        bag_config: currentConfig
      },
      metadata: {
        exchangeCount: exchangeHistory.filter((e: any) => e.status === 'completed').length,
        shiftExchangeCount: shiftExchanges.length,
        planningsAffected: affectedUserIds.size,
        previousPhase: currentConfig.phase || 'unknown'
      }
    };
    
    // 7. Sauvegarder en plusieurs parties si trop gros
    const batch = writeBatch(db);
    
    // Document principal avec métadonnées
    batch.set(backupRef, {
      ...backupData,
      collections: null, // Les collections sont stockées séparément
      createdAt: serverTimestamp()
    });
    
    // Sauvegarder les collections dans des sous-documents
    const collectionsRef = doc(db, 'bag_backups', backupRef.id, 'data', 'collections');
    batch.set(collectionsRef, {
      shift_exchanges: JSON.stringify(shiftExchanges),
      planning_generated: JSON.stringify(plannings),
      exchange_history: JSON.stringify(exchangeHistory),
      bag_config: JSON.stringify(currentConfig)
    });
    
    await batch.commit();
    
    console.log(`Backup complet créé (ID: ${backupRef.id})`);
    console.log(`- ${shiftExchanges.length} échanges en cours`);
    console.log(`- ${exchangeHistory.length} échanges dans l'historique`);
    console.log(`- ${plannings.length} plannings sauvegardés`);
    console.log(`- ${affectedUserIds.size} utilisateurs affectés`);
    
    return backupRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du backup complet:', error);
    throw new Error('Impossible de créer le backup complet');
  }
}

/**
 * Restaure tous les échanges de la bourse aux gardes
 * Annule tous les échanges validés et remet la BAG en phase distribution
 */
export async function restoreAllBagExchanges(
  onProgress?: (progress: number, message: string) => void,
  userId?: string
): Promise<RestoreReport> {
  const report: RestoreReport = {
    totalExchanges: 0,
    revertedExchanges: 0,
    failedExchanges: [],
    restoredNotTaken: 0,
    restoredPending: 0,
    phaseChanged: false,
    startTime: createParisDate(),
    backupCreated: false
  };

  try {
    // Étape 1 : Créer un backup complet
    onProgress?.(5, 'Création d\'une sauvegarde complète...');
    try {
      const backupId = await createCompleteBackup(userId);
      report.backupCreated = true;
      report.backupId = backupId;
    } catch (error) {
      console.error('Erreur lors de la création du backup:', error);
      // Ne pas continuer si le backup échoue pour la sécurité
      throw new Error('Impossible de créer le backup. Restauration annulée par sécurité.');
    }

    // Étape 2 : Récupérer tous les échanges validés
    onProgress?.(10, 'Récupération des échanges...');
    const historyQuery = query(
      collection(db, 'exchange_history'),
      where('status', '==', 'completed'),
      orderBy('executedAt', 'desc')
    );
    
    const snapshot = await getDocs(historyQuery);
    const exchanges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ExchangeHistory[];
    
    report.totalExchanges = exchanges.length;
    console.log(`${report.totalExchanges} échanges à annuler`);
    
    // Étape 3 : Annuler chaque échange dans l'ordre inverse
    for (let i = 0; i < exchanges.length; i++) {
      const exchange = exchanges[i];
      const progress = 10 + (i / exchanges.length) * 60; // 10% à 70%
      
      onProgress?.(
        Math.round(progress), 
        `Annulation de l'échange ${i + 1}/${exchanges.length}...`
      );
      
      try {
        await revertToExchange(exchange.id);
        report.revertedExchanges++;
        console.log(`Échange ${exchange.id} annulé (${i + 1}/${exchanges.length})`);
      } catch (error) {
        console.error(`Erreur lors de l'annulation de l'échange ${exchange.id}:`, error);
        report.failedExchanges.push({
          id: exchange.id,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
      
      // Petite pause pour éviter de surcharger Firebase
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Étape 4 : Restaurer les échanges non pris
    onProgress?.(75, 'Restauration des échanges non pris...');
    try {
      report.restoredNotTaken = await restoreNotTakenToPending();
      console.log(`${report.restoredNotTaken} échanges not_taken restaurés`);
    } catch (error) {
      console.error('Erreur lors de la restauration des not_taken:', error);
    }
    
    // Étape 5 : Restaurer les échanges indisponibles
    onProgress?.(85, 'Restauration des échanges indisponibles...');
    try {
      report.restoredPending = await restorePendingExchanges();
      console.log(`${report.restoredPending} échanges unavailable restaurés`);
    } catch (error) {
      console.error('Erreur lors de la restauration des unavailable:', error);
    }
    
    // Étape 6 : Changer la phase vers distribution
    onProgress?.(95, 'Changement de phase...');
    try {
      await updateBagPhase({ phase: 'distribution' });
      report.phaseChanged = true;
      console.log('Phase changée vers distribution');
    } catch (error) {
      console.error('Erreur lors du changement de phase:', error);
    }
    
    // Finaliser le rapport
    report.endTime = createParisDate();
    const duration = report.endTime.getTime() - report.startTime.getTime();
    report.duration = `${Math.round(duration / 1000)} secondes`;
    
    // Afficher le rapport
    console.log('\n=== RAPPORT DE RESTAURATION ===');
    console.log(`Total des échanges: ${report.totalExchanges}`);
    console.log(`Échanges annulés avec succès: ${report.revertedExchanges}`);
    console.log(`Échanges en erreur: ${report.failedExchanges.length}`);
    console.log(`Échanges not_taken restaurés: ${report.restoredNotTaken}`);
    console.log(`Échanges unavailable restaurés: ${report.restoredPending}`);
    console.log(`Phase changée: ${report.phaseChanged ? 'OUI' : 'NON'}`);
    console.log(`Durée totale: ${report.duration}`);
    
    if (report.failedExchanges.length > 0) {
      console.log('\nÉchanges en erreur:');
      report.failedExchanges.forEach(err => {
        console.log(`- ${err.id}: ${err.error}`);
      });
    }
    
    onProgress?.(100, 'Restauration terminée');
    
    return report;
    
  } catch (error) {
    console.error('Erreur lors de la restauration globale:', error);
    throw error;
  }
}

/**
 * Vérifie si une restauration globale est possible
 */
export async function canRestoreAllExchanges(): Promise<{
  canRestore: boolean;
  exchangeCount: number;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // Vérifier le nombre d'échanges
    const snapshot = await getDocs(
      query(
        collection(db, 'exchange_history'),
        where('status', '==', 'completed')
      )
    );
    
    const exchangeCount = snapshot.size;
    
    if (exchangeCount === 0) {
      issues.push('Aucun échange à restaurer');
    }
    
    // Vérifier la phase actuelle
    const configDoc = await getDocs(
      query(collection(db, 'bag_config'), where('isActive', '==', true))
    );
    
    if (!configDoc.empty) {
      const config = configDoc.docs[0].data();
      if (config.phase === 'submission') {
        issues.push('La bourse est déjà en phase de soumission');
      }
    }
    
    return {
      canRestore: issues.length === 0,
      exchangeCount,
      issues
    };
    
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    return {
      canRestore: false,
      exchangeCount: 0,
      issues: ['Erreur lors de la vérification']
    };
  }
}

/**
 * Restaure depuis un backup
 * Permet d'annuler une restauration en restaurant l'état précédent
 */
export async function restoreFromBackup(
  backupId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  success: boolean;
  restoredCollections: string[];
  errors: string[];
}> {
  const result = {
    success: false,
    restoredCollections: [] as string[],
    errors: [] as string[]
  };

  try {
    onProgress?.(5, 'Récupération du backup...');
    
    // 1. Récupérer le backup
    const backupRef = doc(db, 'bag_backups', backupId);
    const backupDoc = await getDoc(backupRef);
    
    if (!backupDoc.exists()) {
      throw new Error('Backup introuvable');
    }
    
    const backupMetadata = backupDoc.data();
    console.log(`Restauration depuis le backup du ${backupMetadata.createdAt?.toDate?.() || 'date inconnue'}`);
    
    // 2. Récupérer les données des collections
    const collectionsRef = doc(db, 'bag_backups', backupId, 'data', 'collections');
    const collectionsDoc = await getDoc(collectionsRef);
    
    if (!collectionsDoc.exists()) {
      throw new Error('Données du backup introuvables');
    }
    
    const collectionsData = collectionsDoc.data();
    
    // 3. Parser les données JSON
    const shiftExchanges = JSON.parse(collectionsData.shift_exchanges || '[]');
    const plannings = JSON.parse(collectionsData.planning_generated || '[]');
    const exchangeHistory = JSON.parse(collectionsData.exchange_history || '[]');
    const bagConfig = JSON.parse(collectionsData.bag_config || '{}');
    
    // 4. Restaurer shift_exchanges
    onProgress?.(20, 'Restauration des échanges en cours...');
    try {
      // Supprimer tous les documents actuels
      const currentExchanges = await getDocs(collection(db, 'shift_exchanges'));
      const deleteBatch = writeBatch(db);
      currentExchanges.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      
      // Restaurer les documents du backup
      const restoreBatch = writeBatch(db);
      for (const exchange of shiftExchanges) {
        const docRef = doc(db, 'shift_exchanges', exchange.id);
        const { id, ...data } = exchange;
        restoreBatch.set(docRef, data);
      }
      await restoreBatch.commit();
      result.restoredCollections.push('shift_exchanges');
      console.log(`${shiftExchanges.length} échanges restaurés`);
    } catch (error) {
      console.error('Erreur lors de la restauration des shift_exchanges:', error);
      result.errors.push(`shift_exchanges: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    // 5. Restaurer exchange_history
    onProgress?.(40, 'Restauration de l\'historique...');
    try {
      // Supprimer tous les documents actuels
      const currentHistory = await getDocs(collection(db, 'exchange_history'));
      const deleteBatch = writeBatch(db);
      currentHistory.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      
      // Restaurer les documents du backup
      const restoreBatch = writeBatch(db);
      for (const history of exchangeHistory) {
        const docRef = doc(db, 'exchange_history', history.id);
        const { id, ...data } = history;
        restoreBatch.set(docRef, data);
      }
      await restoreBatch.commit();
      result.restoredCollections.push('exchange_history');
      console.log(`${exchangeHistory.length} historiques restaurés`);
    } catch (error) {
      console.error('Erreur lors de la restauration de exchange_history:', error);
      result.errors.push(`exchange_history: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    // 6. Restaurer planning_generated
    onProgress?.(60, 'Restauration des plannings...');
    try {
      const restoreBatch = writeBatch(db);
      for (const planning of plannings) {
        const docRef = doc(db, 'planning_generated', planning.id);
        const { id, ...data } = planning;
        restoreBatch.set(docRef, data);
      }
      await restoreBatch.commit();
      result.restoredCollections.push('planning_generated');
      console.log(`${plannings.length} plannings restaurés`);
    } catch (error) {
      console.error('Erreur lors de la restauration des plannings:', error);
      result.errors.push(`planning_generated: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    // 7. Restaurer la configuration BAG
    onProgress?.(80, 'Restauration de la configuration...');
    try {
      const configRef = doc(db, 'config', 'bag_phase_config');
      await setDoc(configRef, {
        ...bagConfig,
        updatedAt: serverTimestamp()
      });
      result.restoredCollections.push('bag_config');
      console.log(`Configuration BAG restaurée (phase: ${bagConfig.phase})`);
    } catch (error) {
      console.error('Erreur lors de la restauration de la configuration:', error);
      result.errors.push(`bag_config: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    // 8. Marquer le backup comme utilisé
    onProgress?.(95, 'Finalisation...');
    await setDoc(backupRef, {
      ...backupMetadata,
      restoredAt: serverTimestamp(),
      restoredCollections: result.restoredCollections
    }, { merge: true });
    
    result.success = result.errors.length === 0;
    onProgress?.(100, 'Restauration terminée');
    
    console.log('=== RAPPORT DE RESTAURATION ===');
    console.log(`Collections restaurées: ${result.restoredCollections.join(', ')}`);
    if (result.errors.length > 0) {
      console.log(`Erreurs: ${result.errors.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Erreur lors de la restauration depuis le backup:', error);
    result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue');
    return result;
  }
}

/**
 * Liste les backups disponibles
 */
export async function listAvailableBackups(maxCount: number = 10): Promise<Array<{
  id: string;
  createdAt: Date;
  createdBy?: string;
  reason: string;
  metadata: any;
  restoredAt?: Date;
}>> {
  try {
    const backupsQuery = query(
      collection(db, 'bag_backups'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    
    const snapshot = await getDocs(backupsQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        reason: data.reason,
        metadata: data.metadata,
        restoredAt: data.restoredAt?.toDate()
      };
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des backups:', error);
    return [];
  }
}