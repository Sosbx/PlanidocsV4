import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

/**
 * Fonction utilitaire pour examiner la collection shift_exchanges
 * À utiliser dans la console du navigateur pour debug
 */
export const debugShiftExchanges = async () => {
  try {
    console.log('=== Analyse de la collection shift_exchanges ===');
    console.log('Connexion à Firebase...');
    
    // Vérifier la connexion
    if (!db) {
      console.error('Base de données non initialisée');
      return;
    }
    
    // Récupérer un échantillon de documents
    console.log('Récupération des documents...');
    const q = query(
      collection(db, 'shift_exchanges'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`Nombre total de documents récupérés: ${snapshot.size}`);
    console.log('');
    
    // Analyser chaque document
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n--- Document ${index + 1} (ID: ${doc.id}) ---`);
      console.log('Structure complète:', data);
      
      // Afficher les champs principaux
      console.log('\nChamps principaux:');
      console.log('- userId:', data.userId);
      console.log('- date:', data.date);
      console.log('- period:', data.period);
      console.log('- shiftType:', data.shiftType);
      console.log('- timeSlot:', data.timeSlot);
      console.log('- status:', data.status);
      console.log('- exchangeType:', data.exchangeType);
      console.log('- operationType:', data.operationType);
      console.log('- operationTypes:', data.operationTypes);
      console.log('- interestedUsers:', data.interestedUsers);
      console.log('- createdAt:', data.createdAt);
      console.log('- associationId:', data.associationId || 'NON DÉFINI');
      
      // Vérifier les champs manquants
      const expectedFields = ['userId', 'date', 'period', 'shiftType', 'timeSlot', 'status'];
      const missingFields = expectedFields.filter(field => !data[field]);
      if (missingFields.length > 0) {
        console.log('\n⚠️  Champs manquants:', missingFields);
      }
    });
    
    // Statistiques
    console.log('\n\n=== Statistiques ===');
    const statusCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      statusCount[data.status || 'undefined'] = (statusCount[data.status || 'undefined'] || 0) + 1;
      typeCount[data.exchangeType || 'undefined'] = (typeCount[data.exchangeType || 'undefined'] || 0) + 1;
    });
    
    console.log('\nRépartition par statut:', statusCount);
    console.log('Répartition par type:', typeCount);
    
    // Retourner les données pour analyse
    return {
      documents: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      statusCount,
      typeCount
    };
    
  } catch (error) {
    console.error('Erreur lors de la lecture de shift_exchanges:', error);
    throw error;
  }
};

/**
 * Fonction pour compter tous les documents dans shift_exchanges
 */
export const countAllShiftExchanges = async () => {
  try {
    console.log('Comptage de tous les documents...');
    const snapshot = await getDocs(collection(db, 'shift_exchanges'));
    console.log(`Nombre total de documents dans shift_exchanges: ${snapshot.size}`);
    
    // Compter par statut
    const statusCount: Record<string, number> = {};
    const withAssociationId = { yes: 0, no: 0 };
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'undefined';
      statusCount[status] = (statusCount[status] || 0) + 1;
      
      // Vérifier la présence d'associationId
      if (data.associationId) {
        withAssociationId.yes++;
      } else {
        withAssociationId.no++;
      }
    });
    
    console.log('Répartition par statut:', statusCount);
    console.log('Documents avec associationId:', withAssociationId);
    
    return {
      total: snapshot.size,
      statusCount,
      withAssociationId
    };
  } catch (error) {
    console.error('Erreur:', error);
    throw error;
  }
};

// Exposer les fonctions globalement pour la console
if (typeof window !== 'undefined') {
  (window as any).debugShiftExchanges = debugShiftExchanges;
  (window as any).countAllShiftExchanges = countAllShiftExchanges;
}