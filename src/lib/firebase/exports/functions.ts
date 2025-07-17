/**
 * Exports centralisés pour Firebase Functions
 * Utiliser ce fichier pour importer les fonctions Cloud Functions au lieu des imports directs
 */

export {
  // Functions instance
  getFunctions,
  connectFunctionsEmulator,
  
  // Function calls
  httpsCallable,
  httpsCallableFromURL,
  
  // Types
  type Functions,
  type HttpsCallable,
  type HttpsCallableResult,
  type HttpsCallableOptions
} from 'firebase/functions';