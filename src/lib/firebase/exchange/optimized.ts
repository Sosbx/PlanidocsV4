import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  getDocs
} from 'firebase/firestore';
import { db } from '../config';
import { format } from 'date-fns';
import type { ShiftExchange, ExchangeHistory } from '../types';

/**
 * Service optimisé pour les opérations de la bourse aux gardes
 * - Utilise des index composites
 * - Batch les écritures
 * - Implémente un cache intelligent
 * - Réduit les appels Firebase
 */

// Collections
const EXCHANGES_COLLECTION = 'shift_exchanges';
const HISTORY_COLLECTION = 'exchange_history';
const PLANNINGS_COLLECTION = 'generated_plannings';

// Cache pour éviter les requêtes répétées
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Génère une clé de cache unique pour une requête
 */
const getCacheKey = (collection: string, constraints: QueryConstraint[]): string => {
  return `${collection}:${constraints.map(c => c.type).join(',')}`;
};

/**
 * Vérifie si les données en cache sont encore valides
 */
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Requête optimisée pour récupérer les échanges
 * Utilise un cache et des index composites
 */
export const getOptimizedExchanges = async (
  fromDate: string = format(new Date(), 'yyyy-MM-dd'),
  maxResults: number = 100
): Promise<ShiftExchange[]> => {
  const constraints = [
    where('date', '>=', fromDate),
    where('status', 'in', ['pending', 'unavailable']),
    orderBy('date', 'asc'),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  ];
  
  const cacheKey = getCacheKey(EXCHANGES_COLLECTION, constraints);
  const cached = queryCache.get(cacheKey);
  
  // Retourner le cache si valide
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }
  
  try {
    const q = query(collection(db, EXCHANGES_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    const exchanges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      lastModified: doc.data().lastModified?.toDate?.()?.toISOString() || new Date().toISOString()
    })) as ShiftExchange[];
    
    // Mettre en cache
    queryCache.set(cacheKey, { data: exchanges, timestamp: Date.now() });
    
    return exchanges;
  } catch (error) {
    console.error('Error fetching optimized exchanges:', error);
    
    // Fallback sans orderBy si l'index n'existe pas
    try {
      const simpleQuery = query(
        collection(db, EXCHANGES_COLLECTION),
        where('date', '>=', fromDate),
        where('status', 'in', ['pending', 'unavailable']),
        limit(maxResults)
      );
      
      const snapshot = await getDocs(simpleQuery);
      const exchanges = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          lastModified: doc.data().lastModified?.toDate?.()?.toISOString() || new Date().toISOString()
        }) as ShiftExchange)
        .sort((a, b) => a.date.localeCompare(b.date));
      
      return exchanges;
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }
};

/**
 * Listener optimisé pour les échanges avec gestion intelligente des mises à jour
 */
export const subscribeToOptimizedExchanges = (
  onUpdate: (exchanges: ShiftExchange[]) => void,
  fromDate: string = format(new Date(), 'yyyy-MM-dd'),
  maxResults: number = 100
) => {
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE = 1000; // 1 seconde
  
  const q = query(
    collection(db, EXCHANGES_COLLECTION),
    where('date', '>=', fromDate),
    where('status', 'in', ['pending', 'unavailable']),
    orderBy('date', 'asc'),
    limit(maxResults)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      
      // Throttle les mises à jour pour éviter trop de re-renders
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        setTimeout(() => {
          processSnapshot(snapshot);
        }, UPDATE_THROTTLE - (now - lastUpdateTime));
        return;
      }
      
      lastUpdateTime = now;
      processSnapshot(snapshot);
    },
    (error) => {
      console.error('Error in exchanges listener:', error);
      
      // Essayer avec une requête plus simple
      const simpleQuery = query(
        collection(db, EXCHANGES_COLLECTION),
        where('status', 'in', ['pending', 'unavailable']),
        limit(maxResults)
      );
      
      return onSnapshot(simpleQuery, (snapshot) => {
        processSnapshot(snapshot, true);
      });
    }
  );
  
  function processSnapshot(snapshot: any, needsSort: boolean = false) {
    const exchanges = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      lastModified: doc.data().lastModified?.toDate?.()?.toISOString() || new Date().toISOString()
    })) as ShiftExchange[];
    
    // Trier si nécessaire
    if (needsSort) {
      exchanges
        .filter(e => e.date >= fromDate)
        .sort((a, b) => {
          if (a.status === 'pending' && b.status === 'unavailable') return -1;
          if (a.status === 'unavailable' && b.status === 'pending') return 1;
          return a.date.localeCompare(b.date);
        });
    }
    
    // Invalider le cache
    queryCache.clear();
    
    onUpdate(exchanges);
  }
};

/**
 * Batch les opérations d'écriture pour améliorer les performances
 */
export const batchExchangeOperations = async (operations: Array<{
  type: 'update' | 'delete' | 'create';
  exchangeId?: string;
  data?: any;
}>) => {
  const batch = writeBatch(db);
  
  operations.forEach(op => {
    if (op.type === 'update' && op.exchangeId) {
      const ref = doc(db, EXCHANGES_COLLECTION, op.exchangeId);
      batch.update(ref, {
        ...op.data,
        lastModified: serverTimestamp()
      });
    } else if (op.type === 'delete' && op.exchangeId) {
      const ref = doc(db, EXCHANGES_COLLECTION, op.exchangeId);
      batch.delete(ref);
    } else if (op.type === 'create' && op.data) {
      const ref = doc(collection(db, EXCHANGES_COLLECTION));
      batch.set(ref, {
        ...op.data,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      });
    }
  });
  
  await batch.commit();
  
  // Invalider le cache après les écritures
  queryCache.clear();
};

/**
 * Requête optimisée pour l'historique avec pagination
 */
export const getOptimizedHistory = async (
  pageSize: number = 50,
  lastDoc?: any
): Promise<{ history: ExchangeHistory[]; hasMore: boolean; lastDoc: any }> => {
  const constraints: QueryConstraint[] = [
    where('status', '==', 'completed'),
    orderBy('exchangedAt', 'desc'),
    limit(pageSize + 1)
  ];
  
  if (lastDoc) {
    constraints.push(lastDoc);
  }
  
  const q = query(collection(db, HISTORY_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  
  const history = snapshot.docs.slice(0, pageSize).map(doc => ({
    id: doc.id,
    ...doc.data(),
    exchangedAt: doc.data().exchangedAt?.toDate?.()?.toISOString() || new Date().toISOString()
  })) as ExchangeHistory[];
  
  return {
    history,
    hasMore: snapshot.docs.length > pageSize,
    lastDoc: snapshot.docs[pageSize - 1]
  };
};

/**
 * Vérification optimisée des conflits en batch
 */
export const batchCheckConflicts = async (
  userIds: string[],
  date: string,
  period: string
): Promise<Map<string, boolean>> => {
  const conflictMap = new Map<string, boolean>();
  
  // Récupérer tous les plannings en une seule requête
  const planningRefs = userIds.map(userId => doc(db, PLANNINGS_COLLECTION, userId));
  const planningDocs = await Promise.all(planningRefs.map(ref => getDocs(query(collection(db, PLANNINGS_COLLECTION), where('__name__', '==', ref.id)))));
  
  planningDocs.forEach((snapshot, index) => {
    const userId = userIds[index];
    
    if (!snapshot.empty) {
      const planning = snapshot.docs[0].data();
      const assignmentKey = `${date}-${period}`;
      
      // Vérifier les deux structures possibles
      const hasConflict = Boolean(
        planning.assignments?.[assignmentKey] ||
        Object.values(planning.periods || {}).some((p: any) => p.assignments?.[assignmentKey])
      );
      
      conflictMap.set(userId, hasConflict);
    } else {
      conflictMap.set(userId, false);
    }
  });
  
  return conflictMap;
};

/**
 * Nettoie le cache périodiquement
 */
export const startCacheCleanup = () => {
  const interval = setInterval(() => {
    const now = Date.now();
    
    queryCache.forEach((value, key) => {
      if (!isCacheValid(value.timestamp)) {
        queryCache.delete(key);
      }
    });
  }, 60000); // Toutes les minutes
  
  return () => clearInterval(interval);
};

/**
 * Force l'invalidation du cache
 */
export const invalidateCache = () => {
  queryCache.clear();
};