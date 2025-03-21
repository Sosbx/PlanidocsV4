import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED,
  collection,
  getDocs,
  setLogLevel
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Admin email constant
const SYSTEM_ADMIN_EMAIL = 'secretariatrd@h24scm.com';

const firebaseConfig = {
  apiKey: "AIzaSyC59Syrl04sY7E1zmJW_jFs1m5I7rHORB4",
  authDomain: "planego-696d3.firebaseapp.com",
  projectId: "planego-696d3",
  storageBucket: "planego-696d3.appspot.com",
  messagingSenderId: "688748545967",
  appId: "1:688748545967:web:1f241fc72beafe9ed3915a"
};

// Instance principale de Firebase pour l'application
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialiser Firestore avec des paramètres optimisés
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: false,
  experimentalAutoDetectLongPolling: true
});

export const functions = getFunctions(app, 'europe-west1');

// Instance séparée pour la création d'utilisateurs
export const userCreationApp = initializeApp(firebaseConfig, 'userCreation');
export const userCreationAuth = getAuth(userCreationApp);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  const errorMessage = err.code === 'failed-precondition'
    ? 'La persistence est désactivée : plusieurs onglets sont ouverts'
    : err.code === 'unimplemented'
    ? 'La persistence n\'est pas supportée par ce navigateur'
    : 'Erreur lors de l\'activation de la persistence';

  console.warn('Firebase persistence error:', {
    code: err.code,
    message: errorMessage,
    details: err
  });
});

// Configurer le comportement de mise en cache
if (process.env.NODE_ENV === 'development') {
  setLogLevel('debug');
}

// Précharger les collections fréquemment utilisées
export const precacheCollections = async () => {
  try {
    const collections = ['users', 'desiderata', 'generated_plannings', 'shift_exchanges'];
    await Promise.all(collections.map(async (collectionName) => {
      const ref = collection(db, collectionName);
      await getDocs(ref);
    }));
  } catch (error) {
    console.warn('Error precaching collections:', error);
  }
};

export { SYSTEM_ADMIN_EMAIL };