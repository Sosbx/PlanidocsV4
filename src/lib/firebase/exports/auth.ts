/**
 * Exports centralisés pour Firebase Auth
 * Utiliser ce fichier pour importer les fonctions Auth au lieu des imports directs
 */

export {
  // Auth instance
  getAuth,
  
  // Authentication methods
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  
  // User management
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  reload,
  
  // Auth state
  onAuthStateChanged,
  
  // Types
  type Auth,
  type User,
  type UserCredential,
  type AuthError,
  type NextOrObserver,
  type Unsubscribe
} from 'firebase/auth';