/**
 * Point d'entrée principal pour les exports Firebase
 * Préférer importer depuis les fichiers spécifiques pour un meilleur tree-shaking
 */

export * from './firestore';
export * from './auth';
export * from './functions';

// Re-export common instances
export { db } from '../config';
export { auth } from '../config';
export { functions } from '../config';