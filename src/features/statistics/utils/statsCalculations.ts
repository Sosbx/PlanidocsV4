import { format, isWeekend, getDay } from 'date-fns';
import { formatParisDate } from '@/utils/timezoneUtils';
import { frLocale } from '../../../utils/dateLocale';
import { isHoliday, isBridgeDay } from '../../../utils/holidayUtils';
import type { DesiderataStats, DoctorStats } from '../types';
import type { Selections, PeriodSelection } from '../../../types/planning';
import type { User } from '../../../types/users';

const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function calculateDesiderataStats(
  date: Date,
  allDesiderata: Record<string, Selections>,
  totalUsers: number
): DesiderataStats {
  const dateStr = formatParisDate(date, 'yyyy-MM-dd');
  const dayOfWeek = DAYS_OF_WEEK[getDay(date)];
  const weekend = isWeekend(date);
  const holiday = isHoliday(date);
  const bridge = isBridgeDay(date);
  
  const periods = {
    M: { 
      unavailable: 0, 
      total: totalUsers, 
      percentage: 0,
      primary: 0,
      secondary: 0,
      both: 0
    },
    AM: { 
      unavailable: 0, 
      total: totalUsers, 
      percentage: 0,
      primary: 0,
      secondary: 0,
      both: 0
    },
    S: { 
      unavailable: 0, 
      total: totalUsers, 
      percentage: 0,
      primary: 0,
      secondary: 0,
      both: 0
    }
  };
  
  const comments: string[] = [];
  let totalUnavailable = 0;
  
  // Parcourir tous les desiderata des utilisateurs
  Object.entries(allDesiderata).forEach(([userId, selections]) => {
    // Pour chaque utilisateur, vérifier s'il a des primaires ET secondaires pour ce jour
    const userDaySelections = {
      M: selections[`${dateStr}-M`],
      AM: selections[`${dateStr}-AM`],
      S: selections[`${dateStr}-S`]
    };
    
    ['M', 'AM', 'S'].forEach(period => {
      const selection = userDaySelections[period as 'M' | 'AM' | 'S'];
      
      if (selection && (selection.type === 'primary' || selection.type === 'secondary')) {
        const p = periods[period as 'M' | 'AM' | 'S'];
        p.unavailable++;
        
        if (selection.type === 'primary') {
          p.primary++;
        } else {
          p.secondary++;
        }
        
        // Vérifier si l'utilisateur a les deux types pour ce jour (n'importe quelle période)
        const hasPrimary = Object.values(userDaySelections).some(s => s?.type === 'primary');
        const hasSecondary = Object.values(userDaySelections).some(s => s?.type === 'secondary');
        if (hasPrimary && hasSecondary && selection.type === 'primary') {
          // Compter seulement une fois par utilisateur qui a les deux
          p.both++;
        }
        
        if (selection.comment) {
          comments.push(selection.comment);
        }
      }
    });
  });
  
  // Calculer les pourcentages
  Object.keys(periods).forEach(period => {
    const p = periods[period as 'M' | 'AM' | 'S'];
    p.percentage = totalUsers > 0 ? Math.round((p.unavailable / p.total) * 100) : 0;
    totalUnavailable += p.unavailable;
  });
  
  const overallPercentage = totalUsers > 0 
    ? Math.round((totalUnavailable / (totalUsers * 3)) * 100) 
    : 0;
  
  return {
    date: dateStr,
    dayOfWeek,
    isWeekend: weekend,
    isHoliday: holiday,
    isBridgeDay: bridge,
    periods,
    totalUnavailable,
    totalUsers,
    overallPercentage,
    comments
  };
}

export function calculateDoctorStats(
  userId: string,
  user: User,
  selections: Selections,
  startDate: Date,
  endDate: Date
): DoctorStats {
  let totalDesiderata = 0;
  let primaryCount = 0;
  let secondaryCount = 0;
  let weekendCount = 0;
  let holidayCount = 0;
  
  Object.entries(selections).forEach(([key, selection]) => {
    if (selection.type === 'primary' || selection.type === 'secondary') {
      totalDesiderata++;
      
      if (selection.type === 'primary') {
        primaryCount++;
      } else {
        secondaryCount++;
      }
      
      // Extraire la date du key (format: YYYY-MM-DD-PERIOD)
      const datePart = key.substring(0, 10);
      const date = new Date(datePart);
      
      if (isWeekend(date)) {
        weekendCount++;
      }
      
      if (isHoliday(date)) {
        holidayCount++;
      }
    }
  });
  
  // Calculer la moyenne par mois
  const monthsDiff = Math.max(1, 
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
    endDate.getMonth() - startDate.getMonth() + 1
  );
  const averagePerMonth = totalDesiderata / monthsDiff;
  
  return {
    userId,
    name: `${user.lastName} ${user.firstName}`,
    totalDesiderata,
    primaryCount,
    secondaryCount,
    weekendCount,
    holidayCount,
    averagePerMonth: Math.round(averagePerMonth * 10) / 10
  };
}

export function getColorForPercentage(percentage: number): string {
  if (percentage === 0) return 'bg-green-50 text-green-700';
  if (percentage < 20) return 'bg-green-100 text-green-800';
  if (percentage < 40) return 'bg-yellow-100 text-yellow-800';
  if (percentage < 60) return 'bg-orange-100 text-orange-800';
  if (percentage < 80) return 'bg-red-100 text-red-800';
  return 'bg-red-200 text-red-900';
}

export function getColorForAvailability(percentage: number): string {
  // Inverse de getColorForPercentage pour les disponibilités
  if (percentage >= 80) return 'bg-green-100 text-green-800';
  if (percentage >= 60) return 'bg-yellow-100 text-yellow-800';
  if (percentage >= 40) return 'bg-orange-100 text-orange-800';
  if (percentage >= 20) return 'bg-red-100 text-red-800';
  return 'bg-red-200 text-red-900';
}

export function getIntensityColorForHeatmap(percentage: number): string {
  if (percentage === 0) return '#10b981'; // green-500
  if (percentage < 20) return '#84cc16'; // lime-500
  if (percentage < 40) return '#facc15'; // yellow-400
  if (percentage < 60) return '#fb923c'; // orange-400
  if (percentage < 80) return '#f87171'; // red-400
  return '#dc2626'; // red-600
}