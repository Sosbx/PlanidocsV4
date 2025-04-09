import { useCallback } from 'react';
import { useExchangeLoader } from './composable/useExchangeLoader';
import { useExchangeFilter } from './composable/useExchangeFilter';
import { useExchangeConflicts } from './composable/useExchangeConflicts';
import { useReceivedShifts } from './composable/useReceivedShifts';
import type { User } from '../../types/users';
import type { ShiftExchange } from '../../types/planning';

interface FilterOptions {
  showOwnShifts: boolean;
  showMyInterests: boolean;
  filterPeriod: 'all' | 'M' | 'AM' | 'S';
  hidePrimaryDesiderata: boolean;
  hideSecondaryDesiderata: boolean;
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }) => void;
}

/**
 * Hook composable qui utilise plusieurs hooks spécialisés pour gérer les données d'échange
 * Remplace le hook useExchangeData monolithique pour une meilleure séparation des préoccupations
 */
export function useComposableExchangeData(
  users: User[],
  filterOptions: FilterOptions,
  onFirstExchangeLoad?: (firstDate: Date) => void
) {
  // Charger les données d'échange
  const { 
    exchanges, 
    loading, 
    error, 
    userAssignments 
  } = useExchangeLoader();

  // Charger les gardes reçues
  const { receivedShifts } = useReceivedShifts();

  // Filtrer les échanges
  const { filteredExchanges } = useExchangeFilter(exchanges, filterOptions);

  // Détecter les conflits
  const {
    conflictStates,
    conflictDetails,
    interestedPeriodsMap,
    conflictPeriodsMap
  } = useExchangeConflicts(exchanges, userAssignments);

  // Appeler le callback onFirstExchangeLoad si fourni
  const handleFirstExchangeLoad = useCallback(() => {
    if (exchanges.length > 0 && onFirstExchangeLoad && !loading) {
      const firstExchangeDate = new Date(exchanges[0].date);
      onFirstExchangeLoad(firstExchangeDate);
    }
  }, [exchanges, onFirstExchangeLoad, loading]);

  // Appeler le callback lors du premier chargement
  if (exchanges.length > 0 && onFirstExchangeLoad && !loading) {
    handleFirstExchangeLoad();
  }

  // Gérer les erreurs
  if (error) {
    filterOptions.setToast({
      visible: true,
      message: error,
      type: 'error'
    });
  }

  return {
    exchanges,
    filteredExchanges,
    loading,
    userAssignments,
    receivedShifts,
    conflictStates,
    conflictDetails,
    interestedPeriodsMap,
    conflictPeriodsMap
  };
}
