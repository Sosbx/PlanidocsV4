/**
 * Constantes liées au planning
 */

/**
 * Labels pour les périodes de garde
 */
export const PERIOD_LABELS: Record<'M' | 'AM' | 'S', string> = {
  M: 'Matin',
  AM: 'Après-midi',
  S: 'Soir'
} as const;

/**
 * Horaires par défaut pour chaque période
 */
export const PERIOD_TIMES: Record<'M' | 'AM' | 'S', { start: string; end: string }> = {
  M: { start: '07:00', end: '13:00' },
  AM: { start: '13:00', end: '18:00' },
  S: { start: '18:00', end: '00:00' }
} as const;