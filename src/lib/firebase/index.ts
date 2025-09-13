/**
 * Point d'entrée centralisé pour tous les exports Firebase
 * Évite les imports redondants et garantit la cohérence
 */

// Configuration et base de données
export { db, auth, analytics } from './config';

// Collections
export { FIREBASE_COLLECTIONS, COLLECTIONS, type CollectionName } from '../../constants/collections';

// Types généraux
export type { User } from 'firebase/auth';
export type { 
  DocumentData, 
  DocumentReference, 
  CollectionReference,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
  Timestamp,
  FieldValue,
  Transaction,
  WriteBatch
} from 'firebase/firestore';

// Fonctions utilitaires Firebase
export {
  // Auth
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  
  // Firestore - Requêtes
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  
  // Firestore - Queries
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  
  // Firestore - Temps réel
  onSnapshot,
  
  // Firestore - Transactions
  runTransaction,
  writeBatch,
  
  // Firestore - Utilitaires
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
  
  // Types
  type Unsubscribe
} from 'firebase/firestore';

// Gestionnaires centralisés
export { historyManager } from './exchange/history-manager';
export { blockedUsersManager } from './exchange/blocked-users-manager';

// Fonctions d'échange
export * from './exchange';
export * from './directExchange';
export * from './planning';
export * from './shifts';
export * from './replacements';
export * from './users';

// Utilitaires
export * from './validation';
export * from './atomicOperations';