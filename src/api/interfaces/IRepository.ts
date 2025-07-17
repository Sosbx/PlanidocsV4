/**
 * Interface de base pour tous les repositories
 */

import { FirestoreDocument } from '@/types/firebase';

/**
 * Options de requête génériques
 */
export interface QueryOptions {
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: WhereCondition[];
}

/**
 * Condition de filtrage
 */
export interface WhereCondition {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: unknown;
}

/**
 * Interface de base pour tous les repositories
 */
export interface IRepository<T extends FirestoreDocument> {
  /**
   * Récupérer un document par son ID
   */
  getById(id: string): Promise<T | null>;

  /**
   * Récupérer tous les documents
   */
  getAll(options?: QueryOptions): Promise<T[]>;

  /**
   * Créer un nouveau document
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'lastModified'>): Promise<T>;

  /**
   * Mettre à jour un document
   */
  update(id: string, data: Partial<T>): Promise<void>;

  /**
   * Supprimer un document
   */
  delete(id: string): Promise<void>;

  /**
   * Vérifier si un document existe
   */
  exists(id: string): Promise<boolean>;

  /**
   * S'abonner aux changements d'un document
   */
  subscribeToDocument(
    id: string,
    callback: (data: T | null) => void
  ): () => void;

  /**
   * S'abonner aux changements d'une collection
   */
  subscribeToCollection(
    callback: (data: T[]) => void,
    options?: QueryOptions
  ): () => void;
}

/**
 * Interface pour les repositories avec support de batch
 */
export interface IBatchRepository<T extends FirestoreDocument> extends IRepository<T> {
  /**
   * Créer plusieurs documents en une seule transaction
   */
  createBatch(items: Array<Omit<T, 'id' | 'createdAt' | 'lastModified'>>): Promise<T[]>;

  /**
   * Mettre à jour plusieurs documents en une seule transaction
   */
  updateBatch(updates: Array<{ id: string; data: Partial<T> }>): Promise<void>;

  /**
   * Supprimer plusieurs documents en une seule transaction
   */
  deleteBatch(ids: string[]): Promise<void>;
}

/**
 * Interface pour les repositories avec cache
 */
export interface ICachedRepository<T extends FirestoreDocument> extends IRepository<T> {
  /**
   * Vider le cache
   */
  clearCache(): void;

  /**
   * Invalider un élément du cache
   */
  invalidateCache(id: string): void;

  /**
   * Récupérer depuis le cache ou la base de données
   */
  getFromCacheOrFetch(id: string): Promise<T | null>;
}