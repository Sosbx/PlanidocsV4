import { useState, useCallback } from 'react';
import { ShiftPeriod } from '../../shiftExchange/types';

/**
 * Type pour les options de filtrage des échanges directs
 */
export type DirectExchangeFilterOptions = {
  showOwnShifts: boolean;
  showMyInterests: boolean;
  showDesiderata: boolean;
  hidePrimaryDesiderata: boolean;
  hideSecondaryDesiderata: boolean;
  filterPeriod: 'all' | ShiftPeriod;
};

/**
 * Hook pour gérer les filtres des échanges directs
 * Centralise la gestion des options de filtrage
 */
export const useDirectExchangeFilters = (initialFilters?: Partial<DirectExchangeFilterOptions>) => {
  // État pour les options de filtrage
  const [filterOptions, setFilterOptions] = useState<DirectExchangeFilterOptions>({
    showOwnShifts: true,
    showMyInterests: false,
    showDesiderata: true,
    hidePrimaryDesiderata: false,
    hideSecondaryDesiderata: false,
    filterPeriod: 'all',
    ...initialFilters
  });
  
  // Fonction pour mettre à jour une option de filtrage spécifique
  const updateFilterOption = useCallback(<K extends keyof DirectExchangeFilterOptions>(
    key: K,
    value: DirectExchangeFilterOptions[K]
  ) => {
    setFilterOptions(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Fonction pour réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setFilterOptions({
      showOwnShifts: true,
      showMyInterests: false,
      showDesiderata: true,
      hidePrimaryDesiderata: false,
      hideSecondaryDesiderata: false,
      filterPeriod: 'all'
    });
  }, []);
  
  // Créer des fonctions de mise à jour spécifiques pour chaque option
  const setShowOwnShifts = useCallback((value: boolean) => 
    updateFilterOption('showOwnShifts', value), [updateFilterOption]);
  
  const setShowMyInterests = useCallback((value: boolean) => 
    updateFilterOption('showMyInterests', value), [updateFilterOption]);
  
  const setShowDesiderata = useCallback((value: boolean) => 
    updateFilterOption('showDesiderata', value), [updateFilterOption]);
  
  const setHidePrimaryDesiderata = useCallback((value: boolean) => 
    updateFilterOption('hidePrimaryDesiderata', value), [updateFilterOption]);
  
  const setHideSecondaryDesiderata = useCallback((value: boolean) => 
    updateFilterOption('hideSecondaryDesiderata', value), [updateFilterOption]);
  
  const setFilterPeriod = useCallback((value: 'all' | ShiftPeriod) => 
    updateFilterOption('filterPeriod', value), [updateFilterOption]);
  
  return {
    filterOptions,
    updateFilterOption,
    resetFilters,
    // Fonctions de mise à jour spécifiques
    setShowOwnShifts,
    setShowMyInterests,
    setShowDesiderata,
    setHidePrimaryDesiderata,
    setHideSecondaryDesiderata,
    setFilterPeriod,
    // Objet formaté pour les props de composants
    filterProps: {
      showOwnShifts: filterOptions.showOwnShifts,
      setShowOwnShifts,
      showMyInterests: filterOptions.showMyInterests,
      setShowMyInterests,
      showDesiderata: filterOptions.showDesiderata,
      setShowDesiderata,
      hidePrimaryDesiderata: filterOptions.hidePrimaryDesiderata,
      setHidePrimaryDesiderata,
      hideSecondaryDesiderata: filterOptions.hideSecondaryDesiderata,
      setHideSecondaryDesiderata,
      filterPeriod: filterOptions.filterPeriod,
      setFilterPeriod,
    }
  };
};
