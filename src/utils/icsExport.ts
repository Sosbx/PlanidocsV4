import type { ShiftAssignment } from '../types/planning';
import { createParisDate } from '@/utils/timezoneUtils';
import { 
  formatDateAs,
  formatDateForExport,
  DATE_FORMATS,
  getPeriodICSHours
} from '../utils/dates';

export const exportPlanningToICS = (
  assignments: Record<string, ShiftAssignment>,
  userName: string,
  mode: 'grouped' | 'separated' = 'grouped'
): void => {
  if (mode === 'separated') {
    return exportPlanningToICSSeparated(assignments, userName);
  }
  // Grouper les assignments par date
  const assignmentsByDate = new Map<string, Array<{type: 'M' | 'AM' | 'S', shiftType: string}>>();

  // Filtrer et grouper les entrées valides
  Object.entries(assignments)
    .filter(([_, assignment]) => assignment && assignment.shiftType && assignment.date)
    .forEach(([_, assignment]) => {
      const { date, type, shiftType } = assignment;
      // Convertir la date au format YYYYMMDD pour l'ICS
      const dateKey = date.replace(/-/g, '');
      
      if (!assignmentsByDate.has(dateKey)) {
        assignmentsByDate.set(dateKey, []);
      }
      
      assignmentsByDate.get(dateKey)!.push({ type, shiftType });
    });

  // Trier les dates
  const sortedDates = Array.from(assignmentsByDate.keys()).sort();

  // Début du fichier ICS
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlaniDocs//Planning Export//FR',
    'CALSCALE:GREGORIAN'
  ];

  // Générer un événement pour chaque jour avec gardes
  sortedDates.forEach(dateKey => {
    const dayAssignments = assignmentsByDate.get(dateKey)!;
    
    // Trier par période (M -> AM -> S)
    const periodOrder = { M: 1, AM: 2, S: 3 };
    dayAssignments.sort((a, b) => periodOrder[a.type] - periodOrder[b.type]);
    
    // Combiner tous les shiftTypes de la journée
    const combinedShifts = dayAssignments.map(a => a.shiftType).join(' ');
    
    // Générer un UID stable basé sur la date et les gardes combinées
    const uid = `planidocs-${dateKey}-${combinedShifts.replace(/[^a-zA-Z0-9]/g, '')}@planidocs.com`;
    
    // Ajouter l'événement
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dateKey}`,
      `SUMMARY:${combinedShifts}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:This is an event reminder',
      'TRIGGER:-P1D', // 1 jour avant
      'END:VALARM',
      'END:VEVENT'
    );
  });

  // Fin du fichier ICS
  icsContent.push('END:VCALENDAR');

  // Créer et télécharger le fichier
  const blob = new Blob([icsContent.join('\r\n')], { 
    type: 'text/calendar;charset=utf-8;method=PUBLISH'
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${formatDateAs(createParisDate(), 'file')}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export séparé avec horaires spécifiques
const exportPlanningToICSSeparated = (
  assignments: Record<string, ShiftAssignment>,
  userName: string
): void => {
  // Début du fichier ICS
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlaniDocs//Planning Export//FR',
    'CALSCALE:GREGORIAN'
  ];

  // Définir les horaires pour chaque période
  const getPeriodHours = (period: string) => {
    return getPeriodICSHours(period as 'M' | 'AM' | 'S');
  };

  // Parcourir tous les assignments
  Object.entries(assignments)
    .filter(([_, assignment]) => assignment && assignment.shiftType && assignment.date && assignment.type)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([_, assignment]) => {
      const { date, type, shiftType } = assignment;
      const dateKey = date.replace(/-/g, '');
      const hours = getPeriodHours(type);
      
      // Vérifier que la période est valide
      if (!hours) {
        console.warn(`Période invalide: ${type} pour l'assignment`, assignment);
        return;
      }
      
      // Générer un UID stable basé sur la date, période et garde
      const uid = `planidocs-${dateKey}-${type}-${shiftType.replace(/[^a-zA-Z0-9]/g, '')}@planidocs.com`;
      
      // Ajouter l'événement avec horaires
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${dateKey}T${hours.start}`,
        `DTEND:${dateKey}T${hours.end}`,
        `SUMMARY:${shiftType}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:This is an event reminder',
        'TRIGGER:-P1D', // 1 jour avant
        'END:VALARM',
        'END:VEVENT'
      );
    });

  // Fin du fichier ICS
  icsContent.push('END:VCALENDAR');

  // Créer et télécharger le fichier
  const blob = new Blob([icsContent.join('\r\n')], { 
    type: 'text/calendar;charset=utf-8;method=PUBLISH'
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${formatDateAs(createParisDate(), 'file')}_Separated.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
};