/**
 * Implémentation de base pour tous les repositories Firebase
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { firebaseTimestampToParisDate } from '@/utils/timezoneUtils';
import { db } from '@/lib/firebase/config';
import { FirestoreDocument } from '@/types/firebase';
import { IRepository, QueryOptions } from '../interfaces/IRepository';
import { getCollectionName } from '@/utils/collectionUtils';

/**
 * Classe de base pour tous les repositories
 */
export abstract class BaseRepository<T extends FirestoreDocument> implements IRepository<T> {
  protected collectionName: string;
  protected associationId: string;

  constructor(collectionName: string, associationId: string = 'RD') {
    this.collectionName = collectionName;
    this.associationId = associationId;
  }

  /**
   * Obtenir le nom de la collection avec le préfixe d'association
   */
  protected getCollectionPath(): string {
    return getCollectionName(this.collectionName, this.associationId);
  }

  /**
   * Convertir un document Firestore en objet typé
   */
  protected documentToObject(id: string, data: DocumentData): T {
    return {
      ...data,
      id,
      createdAt: data.createdAt instanceof Timestamp ? firebaseTimestampToParisDate(data.createdAt).toISOString() : data.createdAt,
      lastModified: data.lastModified instanceof Timestamp ? firebaseTimestampToParisDate(data.lastModified).toISOString() : data.lastModified
    } as T;
  }

  /**
   * Construire les contraintes de requête
   */
  protected buildQueryConstraints(options?: QueryOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (options?.where) {
      options.where.forEach(condition => {
        constraints.push(where(condition.field, condition.operator, condition.value));
      });
    }

    if (options?.orderBy) {
      constraints.push(orderBy(options.orderBy, options.orderDirection || 'asc'));
    }

    if (options?.limit) {
      constraints.push(limit(options.limit));
    }

    return constraints;
  }

  /**
   * Récupérer un document par son ID
   */
  async getById(id: string): Promise<T | null> {
    try {
      const docRef = doc(db, this.getCollectionPath(), id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.documentToObject(docSnap.id, docSnap.data());
    } catch (error) {
      console.error(`Error getting document ${id} from ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer tous les documents
   */
  async getAll(options?: QueryOptions): Promise<T[]> {
    try {
      const collectionRef = collection(db, this.getCollectionPath());
      const constraints = this.buildQueryConstraints(options);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.documentToObject(doc.id, doc.data()));
    } catch (error) {
      console.error(`Error getting documents from ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Créer un nouveau document
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'lastModified'>): Promise<T> {
    try {
      const docRef = doc(collection(db, this.getCollectionPath()));
      const now = Timestamp.now();
      
      const documentData = {
        ...data,
        createdAt: now,
        lastModified: now
      };

      await setDoc(docRef, documentData);

      return this.documentToObject(docRef.id, documentData);
    } catch (error) {
      console.error(`Error creating document in ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour un document
   */
  async update(id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(db, this.getCollectionPath(), id);
      const updateData = {
        ...data,
        lastModified: Timestamp.now()
      };

      // Retirer les champs qui ne doivent pas être mis à jour
      delete (updateData as any).id;
      delete (updateData as any).createdAt;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error(`Error updating document ${id} in ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Supprimer un document
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.getCollectionPath(), id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${id} from ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Vérifier si un document existe
   */
  async exists(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.getCollectionPath(), id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(`Error checking existence of document ${id} in ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * S'abonner aux changements d'un document
   */
  subscribeToDocument(id: string, callback: (data: T | null) => void): () => void {
    const docRef = doc(db, this.getCollectionPath(), id);
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(this.documentToObject(doc.id, doc.data()));
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Error subscribing to document ${id} in ${this.collectionName}:`, error);
      callback(null);
    });
  }

  /**
   * S'abonner aux changements d'une collection
   */
  subscribeToCollection(
    callback: (data: T[]) => void,
    options?: QueryOptions
  ): () => void {
    const collectionRef = collection(db, this.getCollectionPath());
    const constraints = this.buildQueryConstraints(options);
    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => this.documentToObject(doc.id, doc.data()));
      callback(data);
    }, (error) => {
      console.error(`Error subscribing to collection ${this.collectionName}:`, error);
      callback([]);
    });
  }
}