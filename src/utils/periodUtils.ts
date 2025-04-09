import { ShiftPeriod } from '../types/exchange';
import { 
  normalizePeriod as normalizeFromDateUtils, 
  standardizePeriod as standardizeFromDateUtils,
  getPeriodDisplayText,
  formatPeriod
} from './dateUtils';

/**
 * Standardise une période sous forme de chaîne de caractères
 * Version améliorée avec plus de cas de correspondance
 * @param period La période à standardiser (peut être de n'importe quel type)
 * @returns La période standardisée sous forme de chaîne ('M', 'AM', 'S')
 */
export function standardizePeriod(period: any): 'M' | 'AM' | 'S' {
  if (!period) return 'M'; // Valeur par défaut
  
  const periodStr = String(period).toUpperCase().trim();
  
  // Mapping des différentes représentations possibles
  // Note: 'AM' a été retiré de la liste des périodes du matin pour éviter la confusion avec l'après-midi
  if (['M', 'MATIN', 'MORNING', '1', 'MAT', 'MORN'].includes(periodStr)) return 'M';
  
  // Pour l'après-midi, vérifier d'abord si c'est exactement 'AM' (cas spécial)
  if (periodStr === 'AM') return 'AM';
  
  // Autres représentations de l'après-midi
  if (['APRÈS-MIDI', 'APRES-MIDI', 'AFTERNOON', '2', 'PM', 'MIDI', 'APM', '06'].includes(periodStr)) return 'AM';
  
  // Représentations du soir
  if (['S', 'SOIR', 'EVENING', 'NIGHT', '3', 'NUIT', 'EVE', 'SOR'].includes(periodStr)) return 'S';
  
  // Gérer les formats d'heure
  if (['07', '7', '08', '8', '09', '9'].includes(periodStr) || 
      periodStr.startsWith('07:') || periodStr.startsWith('7:') || 
      periodStr.startsWith('08:') || periodStr.startsWith('8:') || 
      periodStr.startsWith('09:') || periodStr.startsWith('9:')) {
    return 'M';
  }
  
  if (['12', '13', '14'].includes(periodStr) || 
      periodStr.startsWith('12:') || periodStr.startsWith('13:') || periodStr.startsWith('14:')) {
    return 'AM';
  }
  
  if (['18', '19', '20', '21', '22'].includes(periodStr) || 
      periodStr.startsWith('18:') || periodStr.startsWith('19:') || 
      periodStr.startsWith('20:') || periodStr.startsWith('21:') || periodStr.startsWith('22:')) {
    return 'S';
  }
  
  // Si aucune correspondance, retourner la valeur par défaut
  console.warn(`Période non reconnue: ${period}, utilisation de la valeur par défaut 'M'`);
  return 'M';
}

/**
 * Convertit une période en valeur d'énumération ShiftPeriod
 * @param period La période à convertir (peut être de n'importe quel type)
 * @returns La période sous forme d'énumération ShiftPeriod
 */
export function periodToEnum(period: any): ShiftPeriod {
  const standardized = standardizePeriod(period);
  
  switch (standardized) {
    case 'M': return ShiftPeriod.MORNING;
    case 'AM': return ShiftPeriod.AFTERNOON;
    case 'S': return ShiftPeriod.EVENING;
    default: return ShiftPeriod.MORNING; // Ne devrait jamais arriver grâce à standardizePeriod
  }
}

/**
 * Détermine si deux périodes sont équivalentes, quelle que soit leur représentation
 * @param period1 Première période
 * @param period2 Deuxième période
 * @returns true si les périodes sont équivalentes, false sinon
 */
export function arePeriodsEquivalent(period1: any, period2: any): boolean {
  return standardizePeriod(period1) === standardizePeriod(period2);
}

/**
 * Formate une période pour l'affichage
 * @param period La période à formater
 * @returns La période formatée pour l'affichage
 */
export function formatPeriodForDisplay(period: any): string {
  const standardized = standardizePeriod(period);
  
  switch (standardized) {
    case 'M': return 'Matin';
    case 'AM': return 'Après-midi';
    case 'S': return 'Soir';
    default: return 'Période inconnue';
  }
}

// Réexporter les fonctions de dateUtils pour la rétrocompatibilité
export { normalizeFromDateUtils, standardizeFromDateUtils, getPeriodDisplayText, formatPeriod };
