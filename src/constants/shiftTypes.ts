/**
 * Types de gardes connus par période
 * Cette constante sert de référence pour tous les types de gardes possibles
 */
export const SHIFT_TYPES_BY_PERIOD = {
  M: [
    'CM',    // Consultation Matin
    'HM',    // Hôpital Matin
    'RM',    // Régulation Matin
    'VM',    // Visite Matin
    'GM',    // Garde Matin
    'UM',    // Urgences Matin
    'PM'     // Permanence Matin
  ],
  AM: [
    'CA',    // Consultation Après-midi
    'HA',    // Hôpital Après-midi
    'RA',    // Régulation Après-midi
    'VA',    // Visite Après-midi
    'GA',    // Garde Après-midi
    'UA',    // Urgences Après-midi
    'PA'     // Permanence Après-midi
  ],
  S: [
    'CS',    // Consultation Soir
    'HS',    // Hôpital Soir
    'RS',    // Régulation Soir
    'VS',    // Visite Soir
    'GS',    // Garde Soir
    'US',    // Urgences Soir
    'PS',    // Permanence Soir
    'AS'     // Astreinte Soir
  ]
} as const;

/**
 * Labels descriptifs pour chaque type de garde
 */
export const SHIFT_TYPE_LABELS: Record<string, string> = {
  // Matin
  'CM': 'Consultation Matin',
  'HM': 'Hôpital Matin',
  'RM': 'Régulation Matin',
  'VM': 'Visite Matin',
  'GM': 'Garde Matin',
  'UM': 'Urgences Matin',
  'PM': 'Permanence Matin',
  
  // Après-midi
  'CA': 'Consultation Après-midi',
  'HA': 'Hôpital Après-midi',
  'RA': 'Régulation Après-midi',
  'VA': 'Visite Après-midi',
  'GA': 'Garde Après-midi',
  'UA': 'Urgences Après-midi',
  'PA': 'Permanence Après-midi',
  
  // Soir
  'CS': 'Consultation Soir',
  'HS': 'Hôpital Soir',
  'RS': 'Régulation Soir',
  'VS': 'Visite Soir',
  'GS': 'Garde Soir',
  'US': 'Urgences Soir',
  'PS': 'Permanence Soir',
  'AS': 'Astreinte Soir'
};

/**
 * Récupère le label d'un type de garde
 */
export const getShiftTypeLabel = (shiftType: string): string => {
  return SHIFT_TYPE_LABELS[shiftType] || shiftType;
};

/**
 * Détermine la période (M/AM/S) d'un type de garde
 */
export const getShiftPeriod = (shiftType: string): 'M' | 'AM' | 'S' | null => {
  if (SHIFT_TYPES_BY_PERIOD.M.includes(shiftType as any)) return 'M';
  if (SHIFT_TYPES_BY_PERIOD.AM.includes(shiftType as any)) return 'AM';
  if (SHIFT_TYPES_BY_PERIOD.S.includes(shiftType as any)) return 'S';
  
  // Tentative de détection par suffixe
  if (shiftType.endsWith('M')) return 'M';
  if (shiftType.endsWith('A')) return 'AM';
  if (shiftType.endsWith('S')) return 'S';
  
  return null;
};