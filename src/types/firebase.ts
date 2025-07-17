/**
 * Types pour les structures de données Firebase/Firestore
 */

import { Timestamp } from 'firebase/firestore';
import { firebaseTimestampToParisDate } from '@/utils/timezoneUtils';

/**
 * Interface de base pour tous les documents Firestore
 */
export interface FirestoreDocument {
  id: string;
  createdAt: string | Timestamp;
  lastModified: string | Timestamp;
}

/**
 * Métadonnées d'un document Firestore
 */
export interface DocumentMetadata {
  exists: boolean;
  hasPendingWrites: boolean;
  fromCache: boolean;
}

/**
 * Réponse d'une requête Firestore
 */
export interface FirestoreQueryResult<T> {
  data: T[];
  metadata: DocumentMetadata;
  size: number;
}

/**
 * Options pour les requêtes Firestore
 */
export interface FirestoreQueryOptions {
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  startAfter?: unknown;
  endBefore?: unknown;
}

/**
 * Données d'un batch write
 */
export interface BatchWriteData {
  collection: string;
  documentId: string;
  data: Record<string, unknown>;
  operation: 'set' | 'update' | 'delete';
}

/**
 * Résultat d'une transaction
 */
export interface TransactionResult {
  success: boolean;
  error?: Error;
  data?: unknown;
}

/**
 * Callback pour les listeners Firestore
 */
export type FirestoreUnsubscribe = () => void;

/**
 * Callback pour les snapshots
 */
export type SnapshotCallback<T> = (data: T[]) => void;

/**
 * Callback pour les erreurs
 */
export type ErrorCallback = (error: Error) => void;

/**
 * Options de souscription
 */
export interface SubscriptionOptions<T> {
  onData: SnapshotCallback<T>;
  onError?: ErrorCallback;
  includeMetadataChanges?: boolean;
}

/**
 * Convertir un Timestamp en string ISO
 */
export function timestampToISO(timestamp: Timestamp | string): string {
  if (typeof timestamp === 'string') return timestamp;
  return firebaseTimestampToParisDate(timestamp).toISOString();
}

/**
 * Convertir une date en Timestamp
 */
export function dateToTimestamp(date: Date | string): Timestamp {
  if (typeof date === 'string') {
    return Timestamp.fromDate(new Date(date));
  }
  return Timestamp.fromDate(date);
}

/**
 * Type guard pour vérifier si c'est un Timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * Normaliser les dates d'un document
 */
export function normalizeDocumentDates<T extends Record<string, unknown>>(doc: T): T {
  const normalized = { ...doc };
  
  if ('createdAt' in normalized && isTimestamp(normalized.createdAt)) {
    normalized.createdAt = timestampToISO(normalized.createdAt as Timestamp);
  }
  
  if ('lastModified' in normalized && isTimestamp(normalized.lastModified)) {
    normalized.lastModified = timestampToISO(normalized.lastModified as Timestamp);
  }
  
  return normalized;
}