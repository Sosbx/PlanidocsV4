import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, DocumentSnapshot, collection, getDocs, query, Query, QuerySnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { db } from "../lib/firebase/config";
import { generateUserCacheKey } from "../lib/firebase/userIsolatedCache";
import { useCurrentUser } from './useCurrentUser';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface FirestoreCacheHook<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

type QueryOptions = {
  cacheDuration?: number; // Durée du cache en millisecondes
  subscribe?: boolean;    // Abonner aux changements en temps réel
  cacheKey?: string;      // Clé unique pour l'entrée de cache
};

// Singleton pour le cache global avec isolation par utilisateur
class FirestoreCache {
  private static instance: FirestoreCache;
  private cache: Map<string, CacheEntry<any>>;
  private subscribers: Map<string, Set<(data: any) => void>>;
  private DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes par défaut
  private currentUserId: string | null = null;
  private currentAssociationId: string | null = null;
  
  private constructor() {
    this.cache = new Map();
    this.subscribers = new Map();
    
    // Nettoyage périodique du cache
    setInterval(() => this.cleanExpiredEntries(), 60 * 1000); // Toutes les minutes
  }
  
  public static getInstance(): FirestoreCache {
    if (!FirestoreCache.instance) {
      FirestoreCache.instance = new FirestoreCache();
    }
    return FirestoreCache.instance;
  }
  
  public set<T>(key: string, data: T, duration: number = this.DEFAULT_CACHE_DURATION): void {
    // Générer une clé isolée par utilisateur
    const isolatedKey = this.getIsolatedKey(key);
    const now = Date.now();
    this.cache.set(isolatedKey, {
      data,
      timestamp: now,
      expiresAt: now + duration
    });
    
    // Notifier les abonnés
    this.notifySubscribers(isolatedKey, data);
  }
  
  public get<T>(key: string): T | null {
    // Utiliser la clé isolée par utilisateur
    const isolatedKey = this.getIsolatedKey(key);
    const entry = this.cache.get(isolatedKey) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    // Vérifier si l'entrée est expirée
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(isolatedKey);
      return null;
    }
    
    return entry.data;
  }
  
  public subscribe<T>(key: string, callback: (data: T) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback);
    
    // Retourner une fonction pour se désabonner
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
  
  private notifySubscribers<T>(key: string, data: T): void {
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }
  
  private cleanExpiredEntries(): void {
    const now = Date.now();
    
    // Supprimer les entrées expirées
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  public invalidate(keyPrefix: string): void {
    // Ajouter l'isolation utilisateur au préfixe
    const isolatedPrefix = this.getIsolatedKey(keyPrefix);
    
    // Invalider toutes les entrées dont la clé commence par le préfixe isolé
    for (const key of this.cache.keys()) {
      if (key.startsWith(isolatedPrefix)) {
        this.cache.delete(key);
      }
    }
  }
  
  public clear(): void {
    this.cache.clear();
  }
  
  /**
   * Définit l'utilisateur actuel pour l'isolation du cache
   */
  public setCurrentUser(userId: string | null, associationId: string | null): void {
    // Si on change d'utilisateur, nettoyer le cache de l'ancien utilisateur
    if (this.currentUserId && this.currentUserId !== userId) {
      this.clearUserCache();
    }
    
    this.currentUserId = userId;
    this.currentAssociationId = associationId;
  }
  
  /**
   * Génère une clé isolée incluant l'utilisateur et l'association
   */
  private getIsolatedKey(baseKey: string): string {
    if (!this.currentUserId || !this.currentAssociationId) {
      // Si pas d'utilisateur, utiliser une clé temporaire
      return `temp_${baseKey}`;
    }
    
    try {
      return generateUserCacheKey(baseKey);
    } catch {
      // Fallback si le service d'isolation n'est pas prêt
      return `${this.currentUserId}_${this.currentAssociationId}_${baseKey}`;
    }
  }
  
  /**
   * Nettoie le cache de l'utilisateur actuel
   */
  private clearUserCache(): void {
    if (!this.currentUserId || !this.currentAssociationId) return;
    
    const prefix = `${this.currentUserId}_${this.currentAssociationId}_`;
    
    // Supprimer toutes les entrées de l'utilisateur actuel
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Hook pour récupérer un document Firestore avec mise en cache optimisée
 * @param collectionPath Chemin de la collection
 * @param docId ID du document
 * @param options Options de cache et de temps réel
 * @returns Objet avec les données, état de chargement, erreur et fonction de rechargement
 */
export function useFirestoreDocument<T = DocumentData>(
  collectionPath: string,
  docId: string,
  options: QueryOptions = {}
): FirestoreCacheHook<T> {
  const { cacheDuration = 5 * 60 * 1000, subscribe = false, cacheKey } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useCurrentUser();
  
  // Générer une clé de cache unique
  const cacheKeyValue = cacheKey || `doc:${collectionPath}/${docId}`;
  const cache = FirestoreCache.getInstance();
  
  // Mettre à jour l'utilisateur actuel dans le cache
  useEffect(() => {
    if (user) {
      cache.setCurrentUser(user.id, user.associationId || 'RD');
    } else {
      cache.setCurrentUser(null, null);
    }
  }, [user]);
  
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Vérifier si les données sont déjà en cache
      const cachedData = cache.get<T>(cacheKeyValue);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }
      
      // Sinon, récupérer depuis Firestore
      const docRef = doc(db, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const documentData = { id: docSnap.id, ...docSnap.data() } as T;
        
        // Mettre en cache
        cache.set<T>(cacheKeyValue, documentData, cacheDuration);
        
        setData(documentData);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error(`Erreur lors de la récupération du document ${collectionPath}/${docId}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [collectionPath, docId, cacheKeyValue, cacheDuration]);
  
  useEffect(() => {
    // Récupérer les données immédiatement
    fetchDocument();
    
    // Si subscribe est activé, configurer l'abonnement en temps réel
    if (subscribe) {
      const docRef = doc(db, collectionPath, docId);
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap: DocumentSnapshot) => {
          if (docSnap.exists()) {
            const documentData = { id: docSnap.id, ...docSnap.data() } as T;
            
            // Mettre à jour le cache et les données
            cache.set<T>(cacheKeyValue, documentData, cacheDuration);
            setData(documentData);
            setLoading(false);
          } else {
            setData(null);
            setLoading(false);
          }
        },
        (err) => {
          console.error(`Erreur lors de l'écoute du document ${collectionPath}/${docId}:`, err);
          setError(err);
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    }
    
    // S'abonner aux mises à jour du cache
    return cache.subscribe<T>(cacheKeyValue, (updatedData) => {
      setData(updatedData);
    });
  }, [collectionPath, docId, subscribe, cacheDuration, cacheKeyValue, fetchDocument]);
  
  const refetch = useCallback(async () => {
    await fetchDocument();
  }, [fetchDocument]);
  
  return { data, loading, error, refetch };
}

/**
 * Hook pour récupérer une collection Firestore avec mise en cache optimisée
 * @param queryOrPath Query Firestore ou chemin de collection
 * @param options Options de cache et de temps réel
 * @returns Objet avec les données, état de chargement, erreur et fonction de rechargement
 */
export function useFirestoreCollection<T = DocumentData>(
  queryOrPath: Query | string,
  options: QueryOptions = {}
): FirestoreCacheHook<T[]> {
  const { cacheDuration = 5 * 60 * 1000, subscribe = false, cacheKey } = options;
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useCurrentUser();
  
  // Déterminer si c'est une requête ou un chemin
  const isQuery = typeof queryOrPath !== 'string';
  
  // Générer une clé de cache unique pour la requête
  const cacheKeyValue = cacheKey || (
    isQuery 
      ? `query:${JSON.stringify(queryOrPath)}` 
      : `collection:${queryOrPath}`
  );
  
  const cache = FirestoreCache.getInstance();
  
  // Mettre à jour l'utilisateur actuel dans le cache
  useEffect(() => {
    if (user) {
      cache.setCurrentUser(user.id, user.associationId || 'RD');
    } else {
      cache.setCurrentUser(null, null);
    }
  }, [user]);
  
  const fetchCollection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Vérifier si les données sont déjà en cache
      const cachedData = cache.get<T[]>(cacheKeyValue);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }
      
      // Exécuter la requête appropriée
      let querySnapshot: QuerySnapshot;
      if (isQuery) {
        querySnapshot = await getDocs(queryOrPath as Query);
      } else {
        const collectionRef = collection(db, queryOrPath as string);
        querySnapshot = await getDocs(collectionRef);
      }
      
      // Transformer les résultats
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      // Mettre en cache
      cache.set<T[]>(cacheKeyValue, documents, cacheDuration);
      
      setData(documents);
    } catch (err) {
      console.error('Erreur lors de la récupération de la collection:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryOrPath, isQuery, cacheKeyValue, cacheDuration]);
  
  useEffect(() => {
    // Récupérer les données immédiatement
    fetchCollection();
    
    // Si subscribe est activé, configurer l'abonnement en temps réel
    if (subscribe) {
      const queryToUse = isQuery
        ? (queryOrPath as Query)
        : query(collection(db, queryOrPath as string));
      
      const unsubscribe = onSnapshot(
        queryToUse,
        (querySnapshot) => {
          const documents = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          
          // Mettre à jour le cache et les données
          cache.set<T[]>(cacheKeyValue, documents, cacheDuration);
          setData(documents);
          setLoading(false);
        },
        (err) => {
          console.error('Erreur lors de l\'écoute de la collection:', err);
          setError(err);
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    }
    
    // S'abonner aux mises à jour du cache
    return cache.subscribe<T[]>(cacheKeyValue, (updatedData) => {
      setData(updatedData);
    });
  }, [queryOrPath, isQuery, subscribe, cacheDuration, cacheKeyValue, fetchCollection]);
  
  const refetch = useCallback(async () => {
    await fetchCollection();
  }, [fetchCollection]);
  
  return { data, loading, error, refetch };
}

// Exporter des fonctions utilitaires pour gérer le cache manuellement
export const FirestoreCacheUtils = {
  /**
   * Invalider une entrée de cache ou un groupe d'entrées
   * @param keyPrefix Préfixe de clé de cache à invalider
   */
  invalidate: (keyPrefix: string) => {
    FirestoreCache.getInstance().invalidate(keyPrefix);
  },
  
  /**
   * Effacer tout le cache
   */
  clearAll: () => {
    FirestoreCache.getInstance().clear();
  },
  
  /**
   * Optimiser une requête pour éviter les lectures multiples
   * @param cacheKey Clé de cache unique
   * @param queryFn Fonction de requête à exécuter en cas de miss de cache
   */
  createOptimizedQuery: async <T>(cacheKey: string, queryFn: () => Promise<T>): Promise<T> => {
    const cache = FirestoreCache.getInstance();
    const cachedData = cache.get<T>(cacheKey);
    
    if (cachedData) return cachedData;
    
    const data = await queryFn();
    cache.set(cacheKey, data);
    return data;
  }
};