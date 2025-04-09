import { useMemo } from 'react';
import type { ShiftExchange } from '../../../types/planning';
import { useDesiderataState } from '../../useDesiderataState';
import { useAuth } from '../../useAuth';

interface FilterOptions {
  showOwnShifts: boolean;
  showMyInterests: boolean;
  filterPeriod: 'all' | 'M' | 'AM' | 'S';
  hidePrimaryDesiderata: boolean;
  hideSecondaryDesiderata: boolean;
}

/**
 * Hook pour filtrer les échanges selon différents critères
 * Séparé pour une meilleure séparation des préoccupations
 */
export function useExchangeFilter(
  exchanges: ShiftExchange[],
  filterOptions: FilterOptions
) {
  const { user } = useAuth();
  const { selections, isLoading: isLoadingDesiderata } = useDesiderataState();

  // Filtrer les échanges selon les paramètres
  const filteredExchanges = useMemo(() => {
    return exchanges
      .filter(exchange => {
        // Filtrer selon showOwnShifts
        if (!filterOptions.showOwnShifts && exchange.userId === user?.id) {
          return false;
        }
        
        // Filtrer selon showMyInterests
        if (filterOptions.showMyInterests && !exchange.interestedUsers?.includes(user?.id || '')) {
          return false;
        }
        
        // Filtrer selon le type de période si spécifié
        if (filterOptions.filterPeriod !== 'all' && exchange.period !== filterOptions.filterPeriod) {
          return false;
        }
        
        // Filtrer selon les désidératas si on a les données chargées
        if (!isLoadingDesiderata && selections) {
          const key = `${exchange.date}-${exchange.period}`;
          const desiderata = selections[key]?.type;
          
          // Masquer les gardes sur désidératas primaires
          if (filterOptions.hidePrimaryDesiderata && desiderata === 'primary') {
            return false;
          }
          
          // Masquer les gardes sur désidératas secondaires
          if (filterOptions.hideSecondaryDesiderata && desiderata === 'secondary') {
            return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // D'abord par date
        return a.date.localeCompare(b.date);
      });
  }, [
    exchanges,
    filterOptions.showOwnShifts,
    filterOptions.showMyInterests,
    filterOptions.filterPeriod,
    filterOptions.hidePrimaryDesiderata,
    filterOptions.hideSecondaryDesiderata,
    user?.id,
    selections,
    isLoadingDesiderata
  ]);

  return {
    filteredExchanges
  };
}
