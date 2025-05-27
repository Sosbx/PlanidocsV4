import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../../features/auth/hooks';
import { 
  getDirectExchanges, 
  getUserProposals,
  DirectExchangeProposal,
  subscribeToDirectExchanges,
  subscribeToUserProposals
} from '../../../lib/firebase/directExchange';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

/**
 * Hook pour gérer les données des échanges directs
 * Centralise le chargement et la gestion des données d'échanges
 */
export const useDirectExchangeData = (userAssignments: Record<string, any> | null) => {
  const { user } = useAuth();
  
  // États pour les données
  const [directExchanges, setDirectExchanges] = useState<ExchangeShiftExchange[]>([]);
  const [receivedProposals, setReceivedProposals] = useState<ExchangeShiftExchange[]>([]);
  const [userProposals, setUserProposals] = useState<DirectExchangeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Références pour les unsubscribe functions
  const unsubscribeExchangesRef = useRef<(() => void) | null>(null);
  const unsubscribeProposalsRef = useRef<(() => void) | null>(null);
  
  // Mettre à jour les propositions reçues lorsque les échanges ou les assignations changent
  useEffect(() => {
    if (!user || !userAssignments || !directExchanges.length) return;
    
    const userAssignmentsKeys = Object.keys(userAssignments);
    
    // Filtrer les propositions pour:
    // 1. Exclure les gardes de l'utilisateur actuel (exchange.userId !== user.id)
    // 2. S'assurer que la garde correspond à une assignation de l'utilisateur courant
    // 3. Exclure les gardes déjà proposées par l'utilisateur courant (doublons)
    // 4. Exclure les gardes proposées uniquement aux remplaçants
    const receivedProps = directExchanges.filter(exchange => {
      const key = `${exchange.date}-${exchange.period}`;
      
      // Vérifier si cette garde est destinée uniquement aux remplaçants
      const isReplacementOnly = exchange.operationTypes && 
                               exchange.operationTypes.length === 1 && 
                               exchange.operationTypes[0] === 'replacement';
      
      // Vérifier si l'utilisateur est un remplaçant
      const isUserReplacement = user.roles?.isReplacement === true;
      
      return (
        exchange.userId !== user.id && 
        userAssignmentsKeys.includes(key) &&
        // N'afficher les gardes de remplacement que si l'utilisateur est un remplaçant
        (!isReplacementOnly || (isReplacementOnly && isUserReplacement))
      );
    });
    
    setReceivedProposals(receivedProps);
    
    console.log('Propositions reçues mises à jour:', receivedProps.length);
  }, [user, userAssignments, directExchanges]);
  
  // Charger les échanges directs
  const loadDirectExchanges = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Charger les données initiales
      const exchangesData = await getDirectExchanges();
      setDirectExchanges(exchangesData);
      
      // Récupérer les propositions faites par l'utilisateur
      const proposals = await getUserProposals(user.id);
      setUserProposals(proposals);
      
      // Filtrer les propositions reçues
      if (userAssignments) {
        const userAssignmentsKeys = Object.keys(userAssignments);
        const receivedProps = exchangesData.filter(exchange => {
          const key = `${exchange.date}-${exchange.period}`;
          
          // Vérifier si cette garde est destinée uniquement aux remplaçants
          const isReplacementOnly = exchange.operationTypes && 
                                   exchange.operationTypes.length === 1 && 
                                   exchange.operationTypes[0] === 'replacement';
          
          // Vérifier si l'utilisateur est un remplaçant
          const isUserReplacement = user.roles?.isReplacement === true;
          
          return (
            exchange.userId !== user.id && 
            userAssignmentsKeys.includes(key) &&
            // N'afficher les gardes de remplacement que si l'utilisateur est un remplaçant
            (!isReplacementOnly || (isReplacementOnly && isUserReplacement))
          );
        });
        
        setReceivedProposals(receivedProps);
      }
      
      // Log pour débogage
      console.log('Données initiales chargées:', {
        directExchanges: exchangesData.length,
        userProposals: proposals.length,
        userAssignments: userAssignments ? Object.keys(userAssignments).length : 0
      });
      
      // Mettre en place les souscriptions en temps réel
      setupRealtimeSubscriptions();
    } catch (error) {
      console.error('Error loading direct exchanges:', error);
      setError('Erreur lors du chargement des échanges directs');
    } finally {
      setLoading(false);
    }
  }, [user, userAssignments]);
  
  // Mettre en place les souscriptions en temps réel
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user) return;
    
    // Nettoyer les souscriptions existantes
    if (unsubscribeExchangesRef.current) {
      unsubscribeExchangesRef.current();
      unsubscribeExchangesRef.current = null;
    }
    
    if (unsubscribeProposalsRef.current) {
      unsubscribeProposalsRef.current();
      unsubscribeProposalsRef.current = null;
    }
    
    // Souscrire aux échanges directs
    try {
      const unsubscribeExchanges = subscribeToDirectExchanges((exchangesData) => {
        console.log('Mise à jour en temps réel des échanges:', exchangesData.length);
        setDirectExchanges(exchangesData);
      });
      
      unsubscribeExchangesRef.current = unsubscribeExchanges;
      
      // Souscrire aux propositions de l'utilisateur
      const unsubscribeProposals = subscribeToUserProposals(user.id, (proposals) => {
        console.log('Mise à jour en temps réel des propositions:', proposals.length);
        setUserProposals(proposals);
      });
      
      unsubscribeProposalsRef.current = unsubscribeProposals;
      
      console.log('Souscriptions en temps réel mises en place');
    } catch (error) {
      console.error('Erreur lors de la mise en place des souscriptions en temps réel:', error);
      setError('Erreur lors de la mise en place des souscriptions en temps réel');
    }
  }, [user]);
  
  // Charger les données au montage du composant
  useEffect(() => {
    loadDirectExchanges();
    
    // Nettoyer les souscriptions lors du démontage
    return () => {
      if (unsubscribeExchangesRef.current) {
        unsubscribeExchangesRef.current();
      }
      
      if (unsubscribeProposalsRef.current) {
        unsubscribeProposalsRef.current();
      }
    };
  }, [loadDirectExchanges]);
  
  return {
    directExchanges,
    receivedProposals,
    userProposals,
    loading,
    error,
    loadDirectExchanges,
    setDirectExchanges,
    setUserProposals
  };
};
