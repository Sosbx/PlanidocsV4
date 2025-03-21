import { format } from 'date-fns';
import { subDays } from 'date-fns';
import { getDaysArray } from './dateUtils';
import JSZip from 'jszip';
import { fr } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import type { User } from '../types/users';
import type { Selections, ShiftAssignment } from '../types/planning';

// Générer un ID unique stable pour un événement
const generateEventId = (date: string, period: string, shiftType: string): string => {
  // Créer une chaîne unique qui identifie cet événement spécifique
  const uniqueString = `planidocs-${date}-${period}-${shiftType}`;
  // Retourner un ID unique et stable
  return uniqueString.toLowerCase().replace(/[^a-z0-9-]/g, '');
};

export const exportPlanningToGoogleCalendarCSV = (
  assignments: Record<string, ShiftAssignment>,
  userName: string
): void => {
  // En-têtes pour Google Calendar
  const rows = ['Subject,Start Date,Start Time,End Date,End Time,Description,ID'];

  // Convertir les entrées en tableau pour pouvoir les trier
  const sortedEntries = Object.entries(assignments)
    .filter(([_, assignment]) => assignment && assignment.timeSlot && assignment.shiftType && assignment.date)
    .sort(([_, a], [__, b]) => {
      // Trier d'abord par date
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) return dateComparison;
      
      // Si même date, trier par période (M -> AM -> S)
      const periodOrder = { M: 1, AM: 2, S: 3 };
      const periodA = a.type;
      const periodB = b.type;
      return periodOrder[periodA] - periodOrder[periodB];
    });

  sortedEntries.forEach(([_, assignment]) => {
    const { timeSlot, shiftType, date } = assignment;
    const [startTime, endTime] = timeSlot.split(' - ');

    // Utiliser la date de l'assignment directement
    const startDate = new Date(`${date}T${startTime}:00`);
    let endDate = new Date(`${date}T${endTime}:00`);

    // Si l'heure de fin est avant l'heure de début, c'est que ça passe minuit
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    // Formater les dates et heures pour Google Calendar
    const formattedStartDate = format(startDate, 'dd/MM/yyyy', { locale: fr });
    const formattedEndDate = format(endDate, 'dd/MM/yyyy', { locale: fr });
    const formattedStartTime = format(startDate, 'HH:mm', { locale: fr });
    const formattedEndTime = format(endDate, 'HH:mm', { locale: fr });
    
    // Générer un ID unique pour cet événement
    const eventId = generateEventId(date, assignment.type, shiftType);

    rows.push(
      `${shiftType},${formattedStartDate},${formattedStartTime},${formattedEndDate},${formattedEndTime},${shiftType},${eventId}`
    );
  });

  // Créer et télécharger le fichier CSV
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${format(new Date(), 'dd-MM-yyyy', { locale: fr })}_GoogleCalendar.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportPlanningToCSV = (options: ExportPlanningOptions): void => {
  const csvContent = generateCSVContent(options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Desiderata_${options.userName.toUpperCase()}_${format(options.startDate, 'dd-MM-yyyy', { locale: fr })}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportAllPlanningsToZip = async (
  users: User[],
  desiderataData: Record<string, { selections: Record<string, 'primary' | 'secondary' | null> }>,
  startDate: Date,
  endDate: Date
): Promise<void> => {
  const zip = new JSZip();
  // Créer le dossier avec le format "Desiderata_csv_dateDebut"
  const folderName = `Desiderata_csv_${format(startDate, 'dd-MM-yyyy', { locale: fr })}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Ajouter chaque CSV au zip
  users.forEach(user => {
    const userData = desiderataData[user.id];
    if (!userData?.selections) return;

    const csvContent = generateCSVContent({
      userName: user.lastName,
      startDate,
      endDate,
      selections: userData.selections
    });

    folder.file(
      `${user.lastName.toUpperCase()}_${format(startDate, 'dd-MM-yyyy', { locale: fr })}.csv`,
      csvContent
    );
  });

  // Générer et télécharger le zip
  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${folderName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections: Selections;
  primaryLimit?: number;
  secondaryLimit?: number;
  isDesiderata?: boolean;
}

const periodMapping: Record<string, number> = {
  'M': 1,    // Matin
  'AM': 2,   // Après-midi
  'S': 3,    // Soir
};

const generateCSVContent = ({
  userName,
  startDate,
  endDate,
  selections,
  isDesiderata = false
}: ExportPlanningOptions): string => {
  const rows: string[] = [];
  
  // En-têtes différents selon le type d'export
  if (isDesiderata) {
    rows.push('Date,Période,Type,Commentaire');
  } else {
    rows.push('Nom,Date,Periode,Priorite');
  }
  
  const days = getDaysArray(startDate, endDate);
  
  days.forEach(day => {
    const dateStr = format(day, 'dd/MM/yyyy', { locale: fr });
    
    Object.entries(periodMapping).forEach(([period, periodNumber]) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${period}`;
      const selection = selections[key];
      
      if (selection?.type) {
        if (isDesiderata) {
          const periodName = periodNumber === 1 ? 'Matin' : 
                           periodNumber === 2 ? 'Après-midi' : 'Soir';
          const type = selection.type === 'primary' ? 'Primaire' : 'Secondaire';
          const comment = selection.comment || '';
          rows.push(`${dateStr},${periodName},${type},${comment}`);
        } else {
          rows.push(`${userName.toUpperCase()},${dateStr},${periodNumber},${selection.type}`);
        }
      }
    });
  });
  
  return rows.join('\n');
};