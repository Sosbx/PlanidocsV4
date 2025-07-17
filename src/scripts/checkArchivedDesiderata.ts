import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '../utils/collectionUtils';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
  authDomain: "planego-696d3.firebaseapp.com",
  projectId: "planego-696d3",
  storageBucket: "planego-696d3.appspot.com",
  messagingSenderId: "688748545967",
  appId: "1:688748545967:web:1f241fc72beafe9ed3915a"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkArchivedDesiderata() {
  console.log('Vérification des desiderata archivés...\n');
  
  try {
    // Vérifier pour RD
    console.log('=== Association RD ===');
    const rdQuery = query(
      collection(db, COLLECTIONS.ARCHIVED_DESIDERATA),
      where('associationId', '==', 'RD')
    );
    const rdSnapshot = await getDocs(rdQuery);
    console.log(`Nombre de desiderata archivés pour RD: ${rdSnapshot.size}`);
    
    if (rdSnapshot.size > 0) {
      console.log('\nPériodes trouvées pour RD:');
      const periods = new Set<string>();
      rdSnapshot.forEach(doc => {
        const data = doc.data();
        periods.add(data.periodName);
      });
      periods.forEach(period => console.log(`- ${period}`));
    }
    
    // Vérifier pour RG
    console.log('\n=== Association RG ===');
    const rgQuery = query(
      collection(db, COLLECTIONS.ARCHIVED_DESIDERATA),
      where('associationId', '==', 'RG')
    );
    const rgSnapshot = await getDocs(rgQuery);
    console.log(`Nombre de desiderata archivés pour RG: ${rgSnapshot.size}`);
    
    if (rgSnapshot.size > 0) {
      console.log('\nPériodes trouvées pour RG:');
      const periods = new Set<string>();
      rgSnapshot.forEach(doc => {
        const data = doc.data();
        periods.add(data.periodName);
      });
      periods.forEach(period => console.log(`- ${period}`));
    }
    
    // Vérifier s'il y a des données sans association
    console.log('\n=== Sans association ===');
    const allSnapshot = await getDocs(collection(db, COLLECTIONS.ARCHIVED_DESIDERATA));
    let countWithoutAssoc = 0;
    allSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.associationId) {
        countWithoutAssoc++;
      }
    });
    console.log(`Nombre de desiderata archivés sans association: ${countWithoutAssoc}`);
    
    console.log(`\nTotal général: ${allSnapshot.size} desiderata archivés`);
    
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
  }
  
  process.exit(0);
}

// Exécuter la vérification
checkArchivedDesiderata();