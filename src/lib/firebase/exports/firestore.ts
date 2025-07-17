/**
 * Exports centralisés pour Firestore
 * Utiliser ce fichier pour importer les fonctions Firestore au lieu des imports directs
 */

export {
  // Document operations
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  
  // Collection operations
  collection,
  getDocs,
  addDoc,
  
  // Query operations
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  
  // Real-time operations
  onSnapshot,
  
  // Batch operations
  writeBatch,
  
  // Field operations
  deleteField,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  
  // Types
  type DocumentData,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type QuerySnapshot,
  type DocumentSnapshot,
  type Unsubscribe,
  type Timestamp,
  type FieldValue,
  type WriteBatch,
  type Transaction,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QueryFieldFilterConstraint,
  type QueryOrderByConstraint,
  type QueryLimitConstraint
} from 'firebase/firestore';