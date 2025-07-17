import { subDays } from 'date-fns';
import { createParisDate } from '@/utils/timezoneUtils';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { 
  formatDate, 
  formatDateForExport, 
  getDaysArray, 
  getPeriodName,
  frLocale,
  DATE_FORMATS,
  formatDateAs
} from './dates';
import type { User } from '../features/users/types';
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
  userName: string,
  mode: 'grouped' | 'separated' = 'grouped'
): void => {
  if (mode === 'separated') {
    return exportPlanningToGoogleCalendarCSVSeparated(assignments, userName);
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

  // Créer le contenu ICS
  const icsLines = ['BEGIN:VCALENDAR'];

  sortedDates.forEach(dateKey => {
    const dayAssignments = assignmentsByDate.get(dateKey)!;
    
    // Trier par période (M -> AM -> S)
    const periodOrder = { M: 1, AM: 2, S: 3 };
    dayAssignments.sort((a, b) => periodOrder[a.type] - periodOrder[b.type]);
    
    // Combiner tous les shiftTypes de la journée
    const combinedShifts = dayAssignments.map(a => a.shiftType).join(' ');
    
    // Ajouter l'événement
    icsLines.push(
      'BEGIN:VEVENT',
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

  icsLines.push('END:VCALENDAR');

  // Créer et télécharger le fichier avec extension .csv mais contenu ICS
  const icsContent = icsLines.join('\n');
  const blob = new Blob([icsContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${formatDateAs(createParisDate(), 'file')}_GoogleCalendar.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export séparé avec horaires spécifiques
const exportPlanningToGoogleCalendarCSVSeparated = (
  assignments: Record<string, ShiftAssignment>,
  userName: string
): void => {
  // Créer le contenu ICS
  const icsLines = ['BEGIN:VCALENDAR'];

  // Définir les horaires pour chaque période
  const periodHours: Record<string, { start: string; end: string }> = {
    M: { start: '070000', end: '125900' },   // 7h00 - 12h59
    AM: { start: '130000', end: '175900' },  // 13h00 - 17h59
    S: { start: '180000', end: '235900' }    // 18h00 - 23h59
  };

  // Parcourir tous les assignments
  Object.entries(assignments)
    .filter(([_, assignment]) => assignment && assignment.shiftType && assignment.date && assignment.type)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([_, assignment]) => {
      const { date, type, shiftType } = assignment;
      const dateKey = date.replace(/-/g, '');
      const hours = periodHours[type];
      
      // Vérifier que la période est valide
      if (!hours) {
        console.warn(`Période invalide: ${type} pour l'assignment`, assignment);
        return;
      }
      
      // Ajouter l'événement avec horaires
      icsLines.push(
        'BEGIN:VEVENT',
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

  icsLines.push('END:VCALENDAR');

  // Créer et télécharger le fichier
  const icsContent = icsLines.join('\n');
  const blob = new Blob([icsContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${formatDateAs(createParisDate(), 'file')}_GoogleCalendar_Separated.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportPlanningToCSV = (options: ExportPlanningOptions): void => {
  const csvContent = generateCSVContent(options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Desiderata_${options.userName.toUpperCase()}_${formatDateAs(options.startDate, 'file')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportAllPlanningsToZip = async (
  users: User[],
  desiderataData: Record<string, { selections: Record<string, any> }>,
  startDate: Date,
  endDate: Date
): Promise<void> => {
  const zip = new JSZip();
  // Créer le dossier avec le format "Desiderata_csv_dateDebut"
  const folderName = `Desiderata_csv_${formatDateAs(startDate, 'file')}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Ajouter chaque CSV au zip
  users.forEach(user => {
    const userData = desiderataData[user.id];
    if (!userData?.selections) return;

    // Conserver les données brutes avec leurs commentaires
    console.log(`Préparation CSV pour ${user.lastName}, avec ${Object.keys(userData.selections).length} sélections`);
    
    // Examiner la structure des données
    if (Object.keys(userData.selections).length > 0) {
      const firstKey = Object.keys(userData.selections)[0];
      console.log(`Exemple de donnée pour ${firstKey}:`, userData.selections[firstKey]);
    }

    // Transformer les sélections pour correspondre au type Selections tout en préservant les commentaires
    const transformedSelections: Selections = {};
    Object.entries(userData.selections).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Si c'est déjà un objet avec type et éventuellement comment, l'utiliser tel quel
        if ('type' in value) {
          transformedSelections[key] = value;
        } else {
          // Si c'est un autre type d'objet, essayer d'extraire le type
          transformedSelections[key] = {
            type: value.type || value as any,
            comment: value.comment || ''
          };
        }
      } else {
        // Si c'est une valeur directe (primary/secondary/null)
        transformedSelections[key] = {
          type: value as any
        };
      }
    });

    const csvContent = generateCSVContent({
      userName: user.lastName,
      startDate,
      endDate,
      selections: transformedSelections,
      isDesiderata: true  // Activer l'affichage des commentaires
    });

    folder.file(
      `${user.lastName.toUpperCase()}_${formatDateAs(startDate, 'file')}.csv`,
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

// Liste des périodes standardisées
const standardPeriods = ['M', 'AM', 'S'];

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
  
  // Débogage: Afficher le nombre de sélections reçues
  console.log(`Nombre de sélections à exporter: ${Object.keys(selections).length}`);
  
  const days = getDaysArray(startDate, endDate);
  
  days.forEach(day => {
    const dateStr = formatDateForExport(day, 'excel');
    const ymdStr = formatDate(day, DATE_FORMATS.ISO_DATE);
    
    standardPeriods.forEach(period => {
      const key = `${ymdStr}-${period}`;
      
      // Débogage: Afficher la clé recherchée
      if (selections[key]) {
        console.log(`Trouvé sélection pour: ${key}`, selections[key]);
      }
      
      const selection = selections[key];
      
      // Déterminer le type de sélection, qu'il soit un objet ou une valeur directe
      let selectionType = null;
      if (selection) {
        if (typeof selection === 'object' && selection !== null) {
          selectionType = selection.type;
        } else if (typeof selection === 'string') {
          selectionType = selection;
        }
      }
      
      if (selectionType) {
        if (isDesiderata) {
          // Utiliser la fonction getPeriodName pour afficher le nom lisible de la période
          const periodName = getPeriodName(period);
          const type = selectionType === 'primary' ? 'Primaire' : 'Secondaire';
          
          // Extraire le commentaire (si disponible)
          let comment = '';
          if (selection && typeof selection === 'object') {
            comment = selection.comment || '';
            
            // Nettoyer le commentaire pour éviter les problèmes avec les virgules dans le CSV
            comment = comment.replace(/"/g, '""'); // Échapper les guillemets
            if (comment.includes(',')) {
              comment = `"${comment}"`; // Entourer de guillemets si contient des virgules
            }
          }
          
          rows.push(`${dateStr},${periodName},${type},${comment}`);
        } else {
          // Utiliser directement la période standardisée au lieu d'un numéro
          rows.push(`${userName.toUpperCase()},${dateStr},${period},${selectionType}`);
        }
      }
    });
  });
  
  // Ajouter une ligne vide en bas si pas de sélections pour éviter un CSV vide
  if (rows.length === 1) {
    rows.push('');
  }
  
  return rows.join('\n');
};
