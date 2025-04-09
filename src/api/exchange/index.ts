/**
 * API d'échange
 * Exporte toutes les fonctions liées aux échanges de gardes
 */

// Importation des fonctions depuis Firebase
// Ces imports seront remplacés par les implémentations réelles lors de la migration
import { 
  getShiftExchanges,
  addShiftExchange,
  removeShiftExchange,
  toggleInterest,
  validateShiftExchange,
  removeUserFromExchange,
  getExchangeHistory,
  revertToExchange,
  proposeToReplacements,
  cancelPropositionToReplacements
} from '../../lib/firebase/shifts';

import {
  getDirectExchanges,
  addDirectExchange,
  removeDirectExchange,
  acceptDirectExchange,
  rejectDirectExchange,
  updateExchangeOptions
} from '../../lib/firebase/directExchange';

// Ré-export des fonctions pour maintenir la compatibilité
export {
  // Bourse aux gardes
  getShiftExchanges,
  addShiftExchange,
  removeShiftExchange,
  toggleInterest,
  removeUserFromExchange,
  getExchangeHistory,
  revertToExchange,
  proposeToReplacements,
  cancelPropositionToReplacements,
  
  // Échanges directs
  getDirectExchanges,
  addDirectExchange,
  removeDirectExchange,
  acceptDirectExchange,
  rejectDirectExchange,
  updateExchangeOptions
};

// Alias pour maintenir la compatibilité avec les anciens noms de fonctions
export const validateExchange = validateShiftExchange;
export const createDirectExchange = addDirectExchange;
export const updateDirectExchange = updateExchangeOptions;
export const deleteDirectExchange = removeDirectExchange;
