import { isWithinInterval, getYear, setYear, startOfDay, endOfDay } from 'date-fns';
import { startOfDayParis, endOfDayParis } from '@/utils/timezoneUtils';

export interface SchoolPeriod {
  name: string;
  type: 'holiday' | 'school';
  start: Date;
  end: Date;
  color: string;
}

export interface AcademicYear {
  year: number;
  periods: SchoolPeriod[];
}

// Couleurs pour les différents types de vacances
export const HOLIDAY_COLORS = {
  toussaint: '#FF6B6B',      // Rouge automnal
  noel: '#4ECDC4',           // Vert sapin
  hiver: '#95E1D3',          // Bleu glacé
  printemps: '#A8E6CF',      // Vert printanier
  ete: '#FFD93D',            // Jaune soleil
  school: '#E8E8E8'          // Gris clair pour les périodes scolaires
} as const;

/**
 * Génère les périodes scolaires pour une année académique donnée
 * Zone A (Bordeaux)
 */
export function generateSchoolPeriods(academicYear: number): SchoolPeriod[] {
  const periods: SchoolPeriod[] = [];
  
  // Rentrée scolaire (début septembre)
  const schoolStart = new Date(academicYear, 8, 4); // 4 septembre approximatif
  
  // Vacances de la Toussaint (fin octobre - début novembre)
  const toussaintStart = new Date(academicYear, 9, 21); // ~21 octobre
  const toussaintEnd = new Date(academicYear, 10, 6);   // ~6 novembre
  
  // Vacances de Noël (fin décembre - début janvier)
  const noelStart = new Date(academicYear, 11, 23);      // ~23 décembre
  const noelEnd = new Date(academicYear + 1, 0, 8);      // ~8 janvier
  
  // Vacances d'hiver Zone A (mi-février - début mars)
  const hiverStart = new Date(academicYear + 1, 1, 17);  // ~17 février
  const hiverEnd = new Date(academicYear + 1, 2, 5);     // ~5 mars
  
  // Vacances de printemps Zone A (mi-avril - début mai)
  const printempsStart = new Date(academicYear + 1, 3, 13); // ~13 avril
  const printempsEnd = new Date(academicYear + 1, 4, 1);    // ~1er mai
  
  // Fin de l'année scolaire (début juillet)
  const schoolEnd = new Date(academicYear + 1, 6, 7);    // ~7 juillet
  
  // Périodes scolaires
  periods.push({
    name: 'Rentrée - Toussaint',
    type: 'school',
    start: startOfDayParis(schoolStart),
    end: endOfDayParis(toussaintStart),
    color: HOLIDAY_COLORS.school
  });
  
  // Vacances de la Toussaint
  periods.push({
    name: 'Vacances de la Toussaint',
    type: 'holiday',
    start: startOfDayParis(toussaintStart),
    end: endOfDayParis(toussaintEnd),
    color: HOLIDAY_COLORS.toussaint
  });
  
  // Période scolaire Toussaint - Noël
  periods.push({
    name: 'Toussaint - Noël',
    type: 'school',
    start: startOfDayParis(toussaintEnd),
    end: endOfDayParis(noelStart),
    color: HOLIDAY_COLORS.school
  });
  
  // Vacances de Noël
  periods.push({
    name: 'Vacances de Noël',
    type: 'holiday',
    start: startOfDayParis(noelStart),
    end: endOfDayParis(noelEnd),
    color: HOLIDAY_COLORS.noel
  });
  
  // Période scolaire Noël - Hiver
  periods.push({
    name: 'Noël - Hiver',
    type: 'school',
    start: startOfDayParis(noelEnd),
    end: endOfDayParis(hiverStart),
    color: HOLIDAY_COLORS.school
  });
  
  // Vacances d'hiver
  periods.push({
    name: 'Vacances d\'hiver',
    type: 'holiday',
    start: startOfDayParis(hiverStart),
    end: endOfDayParis(hiverEnd),
    color: HOLIDAY_COLORS.hiver
  });
  
  // Période scolaire Hiver - Printemps
  periods.push({
    name: 'Hiver - Printemps',
    type: 'school',
    start: startOfDayParis(hiverEnd),
    end: endOfDayParis(printempsStart),
    color: HOLIDAY_COLORS.school
  });
  
  // Vacances de printemps
  periods.push({
    name: 'Vacances de printemps',
    type: 'holiday',
    start: startOfDayParis(printempsStart),
    end: endOfDayParis(printempsEnd),
    color: HOLIDAY_COLORS.printemps
  });
  
  // Période scolaire Printemps - Été
  periods.push({
    name: 'Printemps - Été',
    type: 'school',
    start: startOfDayParis(printempsEnd),
    end: endOfDayParis(schoolEnd),
    color: HOLIDAY_COLORS.school
  });
  
  // Vacances d'été
  periods.push({
    name: 'Vacances d\'été',
    type: 'holiday',
    start: startOfDayParis(schoolEnd),
    end: endOfDayParis(new Date(academicYear + 1, 8, 4)), // Jusqu'à la rentrée suivante
    color: HOLIDAY_COLORS.ete
  });
  
  return periods;
}

/**
 * Détermine si une date est pendant les vacances scolaires
 */
export function isSchoolHoliday(date: Date, academicYear?: number): boolean {
  const year = academicYear || getAcademicYear(date);
  const periods = generateSchoolPeriods(year);
  
  return periods.some(period => 
    period.type === 'holiday' && 
    isWithinInterval(date, { start: period.start, end: period.end })
  );
}

/**
 * Obtient l'année académique pour une date donnée
 * L'année académique commence en septembre
 */
export function getAcademicYear(date: Date): number {
  const year = getYear(date);
  const month = date.getMonth();
  
  // Si on est avant septembre, on est dans l'année académique précédente
  return month < 8 ? year - 1 : year;
}

/**
 * Obtient la période scolaire pour une date donnée
 */
export function getSchoolPeriod(date: Date): SchoolPeriod | undefined {
  const academicYear = getAcademicYear(date);
  const periods = generateSchoolPeriods(academicYear);
  
  return periods.find(period => 
    isWithinInterval(date, { start: period.start, end: period.end })
  );
}

/**
 * Obtient toutes les périodes qui chevauchent avec un intervalle donné
 */
export function getOverlappingPeriods(
  startDate: Date, 
  endDate: Date
): SchoolPeriod[] {
  const startYear = getAcademicYear(startDate);
  const endYear = getAcademicYear(endDate);
  const overlappingPeriods: SchoolPeriod[] = [];
  
  // Gérer le cas où la période chevauche plusieurs années académiques
  for (let year = startYear; year <= endYear; year++) {
    const periods = generateSchoolPeriods(year);
    
    periods.forEach(period => {
      // Vérifier si la période chevauche avec l'intervalle donné
      const overlaps = 
        (period.start <= endDate && period.end >= startDate) ||
        (startDate <= period.end && endDate >= period.start);
        
      if (overlaps) {
        overlappingPeriods.push(period);
      }
    });
  }
  
  return overlappingPeriods;
}

/**
 * Calcule le nombre de jours de vacances dans un intervalle
 */
export function countHolidayDays(startDate: Date, endDate: Date): number {
  const periods = getOverlappingPeriods(startDate, endDate);
  let holidayDays = 0;
  
  periods.forEach(period => {
    if (period.type === 'holiday') {
      const overlapStart = period.start > startDate ? period.start : startDate;
      const overlapEnd = period.end < endDate ? period.end : endDate;
      
      // Calculer le nombre de jours dans l'intersection
      const days = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      holidayDays += days;
    }
  });
  
  return holidayDays;
}

/**
 * Groupe les dates par période scolaire
 */
export function groupDatesByPeriod(dates: Date[]): Map<string, Date[]> {
  const groupedDates = new Map<string, Date[]>();
  
  dates.forEach(date => {
    const period = getSchoolPeriod(date);
    if (period) {
      const key = `${period.name}_${period.start.getTime()}`;
      if (!groupedDates.has(key)) {
        groupedDates.set(key, []);
      }
      groupedDates.get(key)!.push(date);
    }
  });
  
  return groupedDates;
}