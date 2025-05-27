import { useState, useCallback, useMemo } from 'react';
import { addDays, format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import type { ShiftExchange as ExchangeShiftExchange } from '../../../types/exchange';

// Types de filtres disponibles
export type FilterType = 'all' | 'mine' | 'others' | 'withProposals' | 'exchange' | 'give' | 'replacement' | 'compatible';

// Options pour le filtre de période
export type DateRangeOption = 'current' | '7days' | '30days' | 'all';

/**
 * Options pour le hook de filtres
 */
export interface UseExchangeListFiltersOptions {
  // Filtres initiaux
  initialFilterType?: FilterType;
  initialDateRange?: DateRangeOption;
  initialSearchTerm?: string;
  initialShowMy?: boolean;
  initialShowCompleted?: boolean;
  
  // Données d'utilisateur pour les filtres personnalisés
  currentUserId?: string;
  userShifts?: Record<string, any>;
}

/**
 * Hook pour gérer les filtres sur les listes d'échanges
 */
export const useExchangeListFilters = (options?: UseExchangeListFiltersOptions) => {
  // État des filtres
  const [filterType, setFilterType] = useState<FilterType>(options?.initialFilterType || 'all');
  const [dateRange, setDateRange] = useState<DateRangeOption>(options?.initialDateRange || 'current');
  const [searchTerm, setSearchTerm] = useState<string>(options?.initialSearchTerm || '');
  const [showMyExchanges, setShowMyExchanges] = useState<boolean>(options?.initialShowMy || false);
  const [showCompleted, setShowCompleted] = useState<boolean>(options?.initialShowCompleted || false);
  
  // Calcul de la plage de dates en fonction de l'option sélectionnée
  const dateRangeInterval = useMemo(() => {
    const today = new Date();
    
    switch (dateRange) {
      case 'current':
        return {
          start: startOfDay(today),
          end: endOfDay(addDays(today, 7))
        };
      case '7days':
        return {
          start: startOfDay(today),
          end: endOfDay(addDays(today, 7))
        };
      case '30days':
        return {
          start: startOfDay(today),
          end: endOfDay(addDays(today, 30))
        };
      case 'all':
      default:
        return null; // Pas de restriction de date
    }
  }, [dateRange]);
  
  // Fonction de filtrage des échanges
  const filterExchanges = useCallback((exchanges: ExchangeShiftExchange[]) => {
    if (!exchanges) return [];
    
    return exchanges.filter(exchange => {
      // Filtrer par statut (complété ou en attente)
      if (!showCompleted && exchange.status !== 'pending') {
        return false;
      }
      
      // Filtrer par propriétaire (mes échanges ou ceux des autres)
      if (showMyExchanges && options?.currentUserId && exchange.userId !== options.currentUserId) {
        return false;
      }
      
      // Filtrer par type d'échange
      if (filterType !== 'all') {
        if (filterType === 'mine' && exchange.userId !== options?.currentUserId) {
          return false;
        } else if (filterType === 'others' && exchange.userId === options?.currentUserId) {
          return false;
        } else if (filterType === 'withProposals' && !exchange.hasProposals) {
          return false;
        } else if (filterType === 'exchange' && !exchange.operationTypes?.includes('exchange')) {
          return false;
        } else if (filterType === 'give' && !exchange.operationTypes?.includes('give')) {
          return false;
        } else if (filterType === 'replacement' && !exchange.operationTypes?.includes('replacement')) {
          return false;
        } else if (filterType === 'compatible') {
          // Logique pour vérifier si l'échange est compatible avec les gardes de l'utilisateur
          // Nécessite la connaissance des gardes disponibles
          if (!options?.userShifts || !options.currentUserId || exchange.userId === options.currentUserId) {
            return false;
          }
          
          // Vérifier si l'utilisateur a des gardes disponibles pour un échange
          const hasCompatibleShifts = Object.keys(options.userShifts).length > 0;
          return hasCompatibleShifts;
        }
      }
      
      // Filtrer par plage de dates
      if (dateRangeInterval && exchange.date) {
        try {
          const exchangeDate = parseISO(exchange.date);
          if (!isWithinInterval(exchangeDate, dateRangeInterval)) {
            return false;
          }
        } catch (error) {
          console.error('Erreur lors du parsing de la date:', exchange.date, error);
          return false;
        }
      }
      
      // Filtrer par terme de recherche
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const dateMatch = exchange.date?.toLowerCase().includes(searchLower);
        const periodMatch = exchange.period?.toString().toLowerCase().includes(searchLower);
        const shiftTypeMatch = exchange.shiftType?.toLowerCase().includes(searchLower);
        const commentMatch = exchange.comment?.toLowerCase().includes(searchLower);
        
        return dateMatch || periodMatch || shiftTypeMatch || commentMatch;
      }
      
      return true;
    });
  }, [filterType, dateRangeInterval, searchTerm, showMyExchanges, showCompleted, options?.currentUserId, options?.userShifts]);
  
  // Réinitialisation des filtres
  const resetFilters = useCallback(() => {
    setFilterType('all');
    setDateRange('current');
    setSearchTerm('');
    setShowMyExchanges(false);
    setShowCompleted(false);
  }, []);
  
  return {
    // États des filtres
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    searchTerm,
    setSearchTerm,
    showMyExchanges,
    setShowMyExchanges,
    showCompleted,
    setShowCompleted,
    
    // Fonctions utilitaires
    filterExchanges,
    resetFilters,
    
    // Données calculées
    dateRangeInterval
  };
};