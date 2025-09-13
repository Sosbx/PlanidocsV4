import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

interface DiagnosticReport {
  totalDocuments: number;
  documentsWithAssociationId: number;
  documentsWithoutAssociationId: number;
  differentStructures: {
    oldFormat: number;
    newFormat: number;
    unknown: number;
  };
  missingUsers: string[];
  errorDocuments: Array<{
    id: string;
    error: string;
    data: any;
  }>;
  summary: {
    needsMigration: boolean;
    canSafelyRestore: boolean;
    issues: string[];
  };
}

/**
 * Analyse complète de tous les documents dans exchange_history
 */
export const analyzeExchangeHistory = async (): Promise<DiagnosticReport> => {
  console.log('=== Début du diagnostic exchange_history ===');
  
  const report: DiagnosticReport = {
    totalDocuments: 0,
    documentsWithAssociationId: 0,
    documentsWithoutAssociationId: 0,
    differentStructures: {
      oldFormat: 0,
      newFormat: 0,
      unknown: 0
    },
    missingUsers: [],
    errorDocuments: [],
    summary: {
      needsMigration: false,
      canSafelyRestore: true,
      issues: []
    }
  };

  try {
    // Récupérer TOUS les documents sans filtre
    const snapshot = await getDocs(collection(db, 'exchange_history'));
    report.totalDocuments = snapshot.size;
    
    console.log(`Nombre total de documents: ${report.totalDocuments}`);
    
    const userCache = new Map<string, boolean>();
    const missingUsersSet = new Set<string>();
    
    // Analyser chaque document
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      try {
        // Vérifier la présence d'associationId
        if (data.associationId) {
          report.documentsWithAssociationId++;
        } else {
          report.documentsWithoutAssociationId++;
        }
        
        // Identifier la structure
        if (data.participants && data.exchanges && data.executedAt) {
          // Nouveau format
          report.differentStructures.newFormat++;
          
          // Vérifier les utilisateurs dans participants
          for (const participant of data.participants) {
            await checkUser(participant.userId, userCache, missingUsersSet);
          }
        } else if (data.originalUserId && data.newUserId && data.date && data.period) {
          // Ancien format
          report.differentStructures.oldFormat++;
          
          // Vérifier les utilisateurs
          await checkUser(data.originalUserId, userCache, missingUsersSet);
          await checkUser(data.newUserId, userCache, missingUsersSet);
        } else {
          // Format inconnu
          report.differentStructures.unknown++;
          report.errorDocuments.push({
            id: docId,
            error: 'Structure inconnue',
            data: data
          });
        }
        
        // Vérifier la cohérence des données
        if (data.isPermutation && !data.newShiftType && !data.originalShiftType) {
          report.errorDocuments.push({
            id: docId,
            error: 'Permutation sans types de garde',
            data: data
          });
        }
        
      } catch (error) {
        report.errorDocuments.push({
          id: docId,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          data: data
        });
      }
    }
    
    report.missingUsers = Array.from(missingUsersSet);
    
    // Générer le résumé
    if (report.documentsWithoutAssociationId > 0) {
      report.summary.needsMigration = true;
      report.summary.issues.push(
        `${report.documentsWithoutAssociationId} documents sans associationId`
      );
    }
    
    if (report.differentStructures.oldFormat > 0) {
      report.summary.needsMigration = true;
      report.summary.issues.push(
        `${report.differentStructures.oldFormat} documents en ancien format`
      );
    }
    
    if (report.differentStructures.unknown > 0) {
      report.summary.canSafelyRestore = false;
      report.summary.issues.push(
        `${report.differentStructures.unknown} documents avec structure inconnue`
      );
    }
    
    if (report.missingUsers.length > 0) {
      report.summary.issues.push(
        `${report.missingUsers.length} utilisateurs manquants`
      );
    }
    
    if (report.errorDocuments.length > 0) {
      report.summary.canSafelyRestore = false;
      report.summary.issues.push(
        `${report.errorDocuments.length} documents avec erreurs`
      );
    }
    
    // Afficher le rapport dans la console
    console.log('\n=== RAPPORT DE DIAGNOSTIC ===');
    console.log(`Total des documents: ${report.totalDocuments}`);
    console.log(`Avec associationId: ${report.documentsWithAssociationId}`);
    console.log(`Sans associationId: ${report.documentsWithoutAssociationId}`);
    console.log('\nStructures:');
    console.log(`- Ancien format: ${report.differentStructures.oldFormat}`);
    console.log(`- Nouveau format: ${report.differentStructures.newFormat}`);
    console.log(`- Format inconnu: ${report.differentStructures.unknown}`);
    console.log(`\nUtilisateurs manquants: ${report.missingUsers.length}`);
    console.log(`Documents avec erreurs: ${report.errorDocuments.length}`);
    console.log('\nRésumé:');
    console.log(`- Nécessite migration: ${report.summary.needsMigration ? 'OUI' : 'NON'}`);
    console.log(`- Restauration sûre: ${report.summary.canSafelyRestore ? 'OUI' : 'NON'}`);
    if (report.summary.issues.length > 0) {
      console.log('- Problèmes identifiés:');
      report.summary.issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    return report;
    
  } catch (error) {
    console.error('Erreur lors du diagnostic:', error);
    throw error;
  }
};

/**
 * Vérifie si un utilisateur existe
 */
async function checkUser(
  userId: string, 
  cache: Map<string, boolean>, 
  missingUsers: Set<string>
): Promise<void> {
  if (!userId) return;
  
  // Vérifier le cache d'abord
  if (cache.has(userId)) {
    if (!cache.get(userId)) {
      missingUsers.add(userId);
    }
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const exists = userDoc.exists();
    cache.set(userId, exists);
    
    if (!exists) {
      missingUsers.add(userId);
    }
  } catch (error) {
    cache.set(userId, false);
    missingUsers.add(userId);
  }
}

/**
 * Affiche les détails des documents problématiques
 */
export const showProblematicDocuments = async (): Promise<void> => {
  const report = await analyzeExchangeHistory();
  
  if (report.errorDocuments.length === 0) {
    console.log('Aucun document problématique trouvé');
    return;
  }
  
  console.log('\n=== DOCUMENTS PROBLÉMATIQUES ===');
  report.errorDocuments.forEach((errorDoc, index) => {
    console.log(`\n--- Document ${index + 1} ---`);
    console.log(`ID: ${errorDoc.id}`);
    console.log(`Erreur: ${errorDoc.error}`);
    console.log('Données:', errorDoc.data);
  });
};

/**
 * Compte les échanges par utilisateur
 */
export const countExchangesByUser = async (): Promise<Record<string, number>> => {
  const snapshot = await getDocs(collection(db, 'exchange_history'));
  const userCounts: Record<string, number> = {};
  
  snapshot.docs.forEach(docSnapshot => {
    const data = docSnapshot.data();
    
    // Compter pour l'ancien format
    if (data.originalUserId) {
      userCounts[data.originalUserId] = (userCounts[data.originalUserId] || 0) + 1;
    }
    if (data.newUserId) {
      userCounts[data.newUserId] = (userCounts[data.newUserId] || 0) + 1;
    }
    
    // Compter pour le nouveau format
    if (data.participants) {
      data.participants.forEach((p: any) => {
        if (p.userId) {
          userCounts[p.userId] = (userCounts[p.userId] || 0) + 1;
        }
      });
    }
  });
  
  return userCounts;
};

// Exposer les fonctions globalement pour la console
if (typeof window !== 'undefined') {
  (window as any).analyzeExchangeHistory = analyzeExchangeHistory;
  (window as any).showProblematicDocuments = showProblematicDocuments;
  (window as any).countExchangesByUser = countExchangesByUser;
}