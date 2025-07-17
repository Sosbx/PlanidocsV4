/**
 * Hook React pour utiliser les fonctions de date avec le fuseau horaire Europe/Paris
 */

import { useCallback, useMemo } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import {
  toParisTime,
  createParisDate,
  parseParisDate,
  formatParisDate,
  startOfParisDay,
  endOfParisDay,
  compareParisDate,
  getCurrentParisDateString,
  isSameParisDay,
  firebaseTimestampToParisDate,
  exportDateString,
  debugTimezone,
  TARGET_TIMEZONE
} from '../utils/timezoneUtils';

interface UseTimezoneReturn {
  // Fonctions de conversion
  toParisTime: typeof toParisTime;
  createDate: typeof createParisDate;
  parseDate: typeof parseParisDate;
  
  // Fonctions de formatage
  format: typeof formatParisDate;
  formatDate: (date: Date | string | number, format?: string) => string;
  formatDateTime: (date: Date | string | number) => string;
  formatTime: (date: Date | string | number) => string;
  
  // Fonctions utilitaires
  startOfDay: typeof startOfParisDay;
  endOfDay: typeof endOfParisDay;
  compare: typeof compareParisDate;
  isSameDay: typeof isSameParisDay;
  
  // Fonctions spécifiques
  getCurrentDateString: typeof getCurrentParisDateString;
  fromFirebaseTimestamp: typeof firebaseTimestampToParisDate;
  exportDate: typeof exportDateString;
  debug: typeof debugTimezone;
  
  // Informations
  timezone: string;
  userTimezone: string;
}

/**
 * Hook pour accéder aux fonctions de date avec timezone Europe/Paris
 */
export function useTimezone(): UseTimezoneReturn {
  // Timezone de l'utilisateur
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);
  
  // Format de date par défaut (format français)
  const formatDate = useCallback((date: Date | string | number, format: string = 'dd/MM/yyyy') => {
    return formatParisDate(date, format);
  }, []);
  
  // Format date et heure
  const formatDateTime = useCallback((date: Date | string | number) => {
    return formatParisDate(date, 'dd/MM/yyyy HH:mm');
  }, []);
  
  // Format heure uniquement
  const formatTime = useCallback((date: Date | string | number) => {
    return formatParisDate(date, 'HH:mm');
  }, []);
  
  return {
    // Fonctions de conversion
    toParisTime,
    createDate: createParisDate,
    parseDate: parseParisDate,
    
    // Fonctions de formatage
    format: formatParisDate,
    formatDate,
    formatDateTime,
    formatTime,
    
    // Fonctions utilitaires
    startOfDay: startOfParisDay,
    endOfDay: endOfParisDay,
    compare: compareParisDate,
    isSameDay: isSameParisDay,
    
    // Fonctions spécifiques
    getCurrentDateString: getCurrentParisDateString,
    fromFirebaseTimestamp: firebaseTimestampToParisDate,
    exportDate: exportDateString,
    debug: debugTimezone,
    
    // Informations
    timezone: TARGET_TIMEZONE,
    userTimezone
  };
}

/**
 * Hook pour obtenir des informations sur le décalage horaire
 */
export function useTimezoneInfo() {
  const { timezone, userTimezone } = useTimezone();
  
  const timezoneOffset = useMemo(() => {
    // Calculer le décalage entre le fuseau de l'utilisateur et Europe/Paris
    const now = createParisDate();
    const parisTime = toParisTime(now);
    const userTime = now;
    
    // Différence en minutes
    const offsetMinutes = (parisTime.getTime() - userTime.getTime()) / (1000 * 60);
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetRemainingMinutes = Math.abs(offsetMinutes) % 60;
    
    const sign = offsetMinutes >= 0 ? '+' : '-';
    
    return {
      minutes: offsetMinutes,
      hours: offsetHours,
      display: `${sign}${offsetHours}h${offsetRemainingMinutes > 0 ? offsetRemainingMinutes : ''}`
    };
  }, []);
  
  const isDifferentTimezone = useMemo(() => {
    return userTimezone !== timezone;
  }, [userTimezone, timezone]);
  
  return {
    timezone,
    userTimezone,
    timezoneOffset,
    isDifferentTimezone
  };
}

export default useTimezone;