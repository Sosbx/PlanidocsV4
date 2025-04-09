import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ShiftAssignment } from '../types/planning';

// Générer un UID stable pour un événement
const generateEventUID = (date: string, period: string, shiftType: string): string => {
  // Créer une chaîne unique qui identifie cet événement spécifique de manière stable
  const eventString = `${date}-${period}-${shiftType}`;
  // Utiliser une chaîne déterministe pour éviter les doublons
  return `planidocs-${eventString.replace(/[^a-zA-Z0-9]/g, '')}@planidocs.com`;
};

export const exportPlanningToICS = (
  assignments: Record<string, ShiftAssignment>,
  userName: string
): void => {
  // Début du fichier ICS
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlaniDocs//Planning Export//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Planning PlaniDocs',
    'X-WR-TIMEZONE:Europe/Paris',
    'X-WR-RELCALID:planidocs-planning'
  ];

  // Trier les gardes par date
  const sortedEntries = Object.entries(assignments)
    .filter(([_, assignment]) => assignment && assignment.timeSlot && assignment.shiftType && assignment.date)
    .sort(([_, a], [__, b]) => a.date.localeCompare(b.date));

  // Formater les dates au format ICS (YYYYMMDDTHHmmss)
  const formatICSDate = (date: Date) => 
    format(date, "yyyyMMdd'T'HHmmss");

  // Générer un événement pour chaque garde
  sortedEntries.forEach(([_, assignment]) => {
    const { timeSlot, shiftType, date } = assignment;
    const [startTime, endTime] = timeSlot.split(' - ');

    // Créer les dates de début et fin
    const startDate = new Date(`${date}T${startTime}:00`);
    let endDate = new Date(`${date}T${endTime}:00`);

    // Si l'heure de fin est avant l'heure de début, c'est que ça passe minuit
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    // Créer le rappel la veille à 12h
    const reminderDate = new Date(startDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(12, 0, 0);

    // Ajouter l'événement avec un UID stable
    icsContent = icsContent.concat([
      'BEGIN:VEVENT',
      `UID:${generateEventUID(date, assignment.type, shiftType)}`,
      'SEQUENCE:0',
      `DTSTART;TZID=Europe/Paris:${formatICSDate(startDate)}`,
      `DTEND;TZID=Europe/Paris:${formatICSDate(endDate)}`,
      `SUMMARY:${shiftType}`,
      `DESCRIPTION:Garde: ${shiftType}\\nPériode: ${assignment.type}`,
      'STATUS:CONFIRMED',
      'CLASS:PUBLIC',
      'TRANSP:OPAQUE',
      `CREATED:${formatICSDate(new Date())}`,
      `LAST-MODIFIED:${formatICSDate(new Date())}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
      'X-MICROSOFT-CDO-IMPORTANCE:1',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Rappel de garde demain',
      `TRIGGER;VALUE=DATE-TIME:${formatICSDate(reminderDate)}`,
      'END:VALARM',
      'END:VEVENT'
    ]);
  });

  // Fin du fichier ICS
  icsContent.push('END:VCALENDAR');

  // Créer et télécharger le fichier
  const blob = new Blob([icsContent.join('\r\n')], { 
    type: 'text/calendar;charset=utf-8;method=PUBLISH'
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${format(new Date(), 'dd-MM-yyyy', { locale: fr })}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
};