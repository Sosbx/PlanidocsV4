// Redirige vers le contexte centralisé pour éviter la duplication
import { useBagPhase as useBagPhaseContext } from '../../../context/shiftExchange/BagPhaseContext';

/**
 * Hook pour gérer la phase de la bourse aux gardes
 * @deprecated Utilise maintenant le contexte centralisé BagPhaseContext
 * @returns Configuration de la phase et fonction pour la mettre à jour
 */
export const useBagPhase = () => {
  // Utilise directement le contexte pour éviter la duplication de logique
  return useBagPhaseContext();
};

export default useBagPhase;
