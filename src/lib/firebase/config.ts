import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Initialiser Firestore avec des paramètres optimisés et persistance locale
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: false,
  experimentalAutoDetectLongPolling: true,
  // Utilisation de l'API recommandée pour la persistance
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
});

export const functions = getFunctions(app, 'europe-west1');

// Instance séparée pour la création d'utilisateurs
export const userCreationApp = initializeApp(firebaseConfig, 'userCreation');
export const userCreationAuth = getAuth(userCreationApp);

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