import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../features/auth/hooks';
import { useBagPhase } from '../features/shiftExchange/hooks';
import type { ShiftExchange } from '../types/exchange';
import type { ShiftReplacement } from '../types/planning';

/**
 * Hook pour consolider les souscriptions aux échanges
 * Combine les souscriptions aux échanges, échanges directs et remplacements
 * pour réduire les rendus inutiles
 */
export const useConsolidatedExchanges = () => {
  const { user } = useAuth();
  const { config: bagPhaseConfig } = useBagPhase();
  
  // États pour stocker les données
  const [allExchangeData, setAllExchangeData] = useState<{
    exchanges: Record<string, ShiftExchange>;
    directExchanges: Record<string, ShiftExchange>;
    replacements: Record<string, ShiftReplacement>;
  }>({
    exchanges: {},
    directExchanges: {},
    replacements: {}
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effet pour s'abonner aux changements en temps réel
  useEffect(() => {
    if (!user) return () => {};
    
    setLoading(true);
    setError(null);
    
    // Fonction pour traiter les données d'échange
    const processExchangeData = (data: any) => {
      try {
        const { exchanges = [], directExchanges = [], replacements = [] } = data;
        
        // Convertir les tableaux en objets indexés par clé (date-période)
        const exchangesMap: Record<string, ShiftExchange> = {};
        const directExchangesMap: Record<string, ShiftExchange> = {};
        const replacementsMap: Record<string, ShiftReplacement> = {};
        
        // Traiter les échanges de la bourse aux gardes
        exchanges.forEach((exchange: ShiftExchange) => {
          if (exchange.date && exchange.period) {
            const key = `${exchange.date}-${exchange.period}`;
            exchangesMap[key] = exchange;
          }
        });
        
        // Traiter les échanges directs
        directExchanges.forEach((exchange: ShiftExchange) => {
          if (exchange.date && exchange.period) {
            const key = `${exchange.date}-${exchange.period}`;
            directExchangesMap[key] = exchange;
          }
        });
        
        // Traiter les remplacements
        replacements.forEach((replacement: ShiftReplacement) => {
          if (replacement.date && replacement.period) {
            const key = `${replacement.date}-${replacement.period}`;
            replacementsMap[key] = replacement;
          }
        });
        
        return { exchangesMap, directExchangesMap, replacementsMap };
      } catch (err) {
        console.error('Error processing exchange data:', err);
        setError('Erreur lors du traitement des données d\'échange');
        return { exchangesMap: {}, directExchangesMap: {}, replacementsMap: {} };
      }
    };
    
    // Fonction pour s'abonner à tous les types d'échanges
    const subscribeToAllExchanges = async () => {
      try {
        // Import dynamique pour éviter les dépendances circulaires
        const { subscribeToShiftExchanges } = await import('../lib/firebase/shifts');
        const { subscribeToDirectExchanges } = await import('../lib/firebase/directExchange/core');
        const { getReplacementsForUser } = await import('../lib/firebase/replacements');
        
        // S'abonner aux échanges de la bourse aux gardes
        const unsubscribeExchanges = subscribeToShiftExchanges((exchangeItems) => {
          // Filtrer les échanges pertinents pour l'utilisateur
          const filteredExchanges = exchangeItems.filter(ex => 
            // Inclure les échanges de l'utilisateur
            ex.userId === user.id || 
            // Inclure les échanges où l'utilisateur est intéressé
            (ex.interestedUsers && ex.interestedUsers.includes(user.id))
          );
          
          // Mettre à jour l'état avec les nouvelles données
          setAllExchangeData(prev => ({
            ...prev,
            exchanges: processExchangeData({ exchanges: filteredExchanges }).exchangesMap
          }));
        });
        
        // S'abonner aux échanges directs
        const unsubscribeDirectExchanges = subscribeToDirectExchanges((directExchangeItems) => {
          // Filtrer les échanges directs pour l'utilisateur
          const filteredDirectExchanges = directExchangeItems.filter(ex => ex.userId === user.id);
          
          // Mettre à jour l'état avec les nouvelles données
          setAllExchangeData(prev => ({
            ...prev,
            directExchanges: processExchangeData({ directExchanges: filteredDirectExchanges }).directExchangesMap
          }));
        });
        
        // Charger les remplacements (pas de souscription en temps réel disponible)
        const loadReplacements = async () => {
          try {
            const replacementItems = await getReplacementsForUser(user.id);
            
            // Mettre à jour l'état avec les nouvelles données
            setAllExchangeData(prev => ({
              ...prev,
              replacements: processExchangeData({ replacements: replacementItems }).replacementsMap
            }));
            
            // Marquer le chargement comme terminé après avoir reçu toutes les données
            setLoading(false);
          } catch (error) {
            console.error('Error loading replacements:', error);
            setError('Erreur lors du chargement des remplacements');
            setLoading(false);
          }
        };
        
        // Charger les remplacements immédiatement
        loadReplacements();
        
        // Créer une fonction vide pour la compatibilité avec l'interface
        const unsubscribeReplacements = () => {};
        
        // Retourner une fonction pour se désabonner de toutes les souscriptions
        return () => {
          unsubscribeExchanges();
          unsubscribeDirectExchanges();
          unsubscribeReplacements();
        };
      } catch (error) {
        console.error('Error subscribing to exchanges:', error);
        setError('Erreur lors de l\'abonnement aux échanges');
        setLoading(false);
        return () => {};
      }
    };
    
    // Appeler la fonction d'abonnement
    let unsubscribeAll = () => {};
    subscribeToAllExchanges().then(unsub => {
      if (unsub) unsubscribeAll = unsub;
    });
    
    // Se désabonner lors du démontage du composant
    return () => {
      unsubscribeAll();
    };
  }, [user]);

  // Mémoïser les données consolidées pour éviter les re-rendus inutiles
  const consolidatedData = useMemo(() => {
    return {
      ...allExchangeData,
      loading,
      error,
      bagPhaseConfig
    };
  }, [allExchangeData, loading, error, bagPhaseConfig]);

  return consolidatedData;
};

export default useConsolidatedExchanges;
