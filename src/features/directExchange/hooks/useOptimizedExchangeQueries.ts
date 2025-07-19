import { useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { COLLECTIONS } from '../../../lib/firebase/directExchange/types';
import { OperationType } from '../../../types/exchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

interface ExchangeQueryResult {
  directExchanges: ExchangeShiftExchange[];
  replacements: boolean;
  operationTypes: OperationType[];
  primaryExchange?: ExchangeShiftExchange;
}

/**
 * Hook optimisé pour récupérer les données d'échange en une seule requête
 * Évite les requêtes multiples et redondantes
 */
export const useOptimizedExchangeQueries = () => {
  /**
   * Récupère toutes les données d'échange pour une garde spécifique
   * en minimisant le nombre de requêtes Firebase
   */
  const fetchExchangeData = useCallback(async (
    userId: string,
    date: string,
    period: string
  ): Promise<ExchangeQueryResult> => {
    try {
      // Requête unique pour tous les échanges directs de cette garde
      const directExchangesQuery = query(
        collection(db, COLLECTIONS.DIRECT_EXCHANGES),
        where('userId', '==', userId),
        where('date', '==', date),
        where('period', '==', period),
        where('status', 'in', ['pending', 'unavailable'])
      );

      // Requête pour les remplacements
      const replacementsQuery = query(
        collection(db, COLLECTIONS.DIRECT_REPLACEMENTS),
        where('originalUserId', '==', userId),
        where('date', '==', date),
        where('period', '==', period),
        where('status', '==', 'pending')
      );

      // Exécuter les requêtes en parallèle
      const [directSnapshot, replacementSnapshot] = await Promise.all([
        getDocs(directExchangesQuery),
        getDocs(replacementsQuery)
      ]);

      // Traiter les résultats
      const directExchanges: ExchangeShiftExchange[] = [];
      const operationTypes: OperationType[] = [];

      // Traiter les échanges directs
      directSnapshot.docs.forEach(doc => {
        const exchange = {
          id: doc.id,
          ...doc.data()
        } as ExchangeShiftExchange;

        directExchanges.push(exchange);

        // Collecter les types d'opération
        if (exchange.operationTypes && Array.isArray(exchange.operationTypes)) {
          exchange.operationTypes.forEach((type: OperationType) => {
            if (!operationTypes.includes(type)) {
              operationTypes.push(type);
            }
          });
        } else if (exchange.operationType) {
          if (exchange.operationType === 'both') {
            if (!operationTypes.includes('exchange')) {
              operationTypes.push('exchange');
            }
            if (!operationTypes.includes('give')) {
              operationTypes.push('give');
            }
          } else if (!operationTypes.includes(exchange.operationType)) {
            operationTypes.push(exchange.operationType);
          }
        }
      });

      // Vérifier s'il y a des remplacements
      const hasReplacement = !replacementSnapshot.empty;
      if (hasReplacement && !operationTypes.includes('replacement')) {
        operationTypes.push('replacement');
      }

      return {
        directExchanges,
        replacements: hasReplacement,
        operationTypes,
        primaryExchange: directExchanges.length > 0 ? directExchanges[0] : undefined
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des données d\'échange:', error);
      throw error;
    }
  }, []);

  /**
   * Vérifie les propositions pour un échange spécifique
   */
  const checkExchangeProposals = useCallback(async (
    exchangeId: string
  ): Promise<any[]> => {
    try {
      const { getProposalsForExchange } = await import('../../../lib/firebase/directExchange');
      return await getProposalsForExchange(exchangeId);
    } catch (error) {
      console.error('Erreur lors de la vérification des propositions:', error);
      return [];
    }
  }, []);

  return {
    fetchExchangeData,
    checkExchangeProposals
  };
};