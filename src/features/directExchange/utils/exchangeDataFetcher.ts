import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { sanitizeOperationTypes } from './validation';
import type { OperationType } from '../types';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

interface ExchangeDataQuery {
  userId: string;
  date: string;
  period: string;
}

interface ExchangeDataResult {
  directExchanges: ExchangeShiftExchange[];
  hasReplacement: boolean;
  operationTypes: OperationType[];
}

/**
 * Fonction optimisée pour récupérer toutes les données d'échange pour une cellule
 * Combine toutes les requêtes Firebase en une seule opération batch
 */
export async function fetchExchangeDataForCell(
  queryData: ExchangeDataQuery
): Promise<ExchangeDataResult> {
  const { userId, date, period } = queryData;
  const operationTypes: OperationType[] = [];
  const directExchanges: ExchangeShiftExchange[] = [];
  let hasReplacement = false;

  try {
    // Exécuter toutes les requêtes en parallèle pour optimiser les performances
    const [directExchangeResults, replacementResults, oldReplacementResults] = await Promise.all([
      // 1. Récupérer les échanges directs
      getDocs(
        query(
          collection(db, 'direct_exchanges'),
          where('userId', '==', userId),
          where('date', '==', date),
          where('period', '==', period),
          where('status', 'in', ['pending', 'unavailable'])
        )
      ),
      
      // 2. Vérifier les remplacements dans la nouvelle collection
      getDocs(
        query(
          collection(db, 'direct_replacements'),
          where('originalUserId', '==', userId),
          where('date', '==', date),
          where('period', '==', period),
          where('status', '==', 'pending')
        )
      ),
      
      // 3. Vérifier les remplacements dans l'ancienne collection (compatibilité)
      getDocs(
        query(
          collection(db, 'remplacements'),
          where('originalUserId', '==', userId),
          where('date', '==', date),
          where('period', '==', period),
          where('status', '==', 'pending')
        )
      )
    ]);

    // Traiter les résultats des échanges directs
    directExchangeResults.docs.forEach(doc => {
      const exchange = doc.data();
      
      // Créer un objet correctement typé
      const typedExchange: ExchangeShiftExchange = {
        id: doc.id,
        ...exchange,
        exchangeType: exchange.exchangeType || 'direct',
        operationTypes: exchange.operationTypes || [],
        status: exchange.status || 'pending',
        userId: exchange.userId || userId,
        date: exchange.date || date,
        period: exchange.period || period,
        createdAt: exchange.createdAt || new Date().toISOString(),
        lastModified: exchange.lastModified || new Date().toISOString()
      };
      
      directExchanges.push(typedExchange);
      
      // Extraire les types d'opération valides
      const validTypes = sanitizeOperationTypes(exchange);
      validTypes.forEach(type => {
        if (!operationTypes.includes(type)) {
          operationTypes.push(type);
        }
      });
    });

    // Vérifier s'il y a des remplacements
    if (!replacementResults.empty || !oldReplacementResults.empty) {
      hasReplacement = true;
      if (!operationTypes.includes('replacement')) {
        operationTypes.push('replacement');
      }
    }

    console.log('📊 Données récupérées de manière optimisée:', {
      directExchanges: directExchanges.length,
      hasReplacement,
      operationTypes
    });

    return {
      directExchanges,
      hasReplacement,
      operationTypes
    };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données d\'échange:', error);
    // En cas d'erreur, retourner des valeurs par défaut
    return {
      directExchanges: [],
      hasReplacement: false,
      operationTypes: []
    };
  }
}

/**
 * Cache simple pour éviter les requêtes répétitives
 * Clé: userId-date-period
 * Durée de vie: 30 secondes
 */
const exchangeDataCache = new Map<string, {
  data: ExchangeDataResult;
  timestamp: number;
}>();

const CACHE_DURATION = 30000; // 30 secondes

/**
 * Version avec cache de fetchExchangeDataForCell
 */
export async function fetchExchangeDataForCellWithCache(
  queryData: ExchangeDataQuery
): Promise<ExchangeDataResult> {
  const cacheKey = `${queryData.userId}-${queryData.date}-${queryData.period}`;
  const now = Date.now();
  
  // Vérifier le cache
  const cached = exchangeDataCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log('✅ Données récupérées depuis le cache');
    return cached.data;
  }
  
  // Si pas en cache ou expiré, faire la requête
  const result = await fetchExchangeDataForCell(queryData);
  
  // Mettre en cache le résultat
  exchangeDataCache.set(cacheKey, {
    data: result,
    timestamp: now
  });
  
  // Nettoyer le cache des entrées expirées
  exchangeDataCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION) {
      exchangeDataCache.delete(key);
    }
  });
  
  return result;
}

/**
 * Invalider le cache pour une cellule spécifique
 */
export function invalidateExchangeDataCache(userId: string, date: string, period: string): void {
  const cacheKey = `${userId}-${date}-${period}`;
  exchangeDataCache.delete(cacheKey);
}

/**
 * Invalider tout le cache
 */
export function invalidateAllExchangeDataCache(): void {
  exchangeDataCache.clear();
}