import { format } from 'date-fns';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { frLocale } from '../utils/dateLocale';
import { parseParisDate, formatParisDate, createParisDate } from '../utils/timezoneUtils';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDaysArray, getMonthsInRange, isGrayedOut } from './dateUtils';
import type { ShiftAssignment, PeriodSelection } from '../types/planning';
import type { User } from '../features/users/types';
import { exportPlanningToPDF } from './pdfExport';
import { calculatePercentages } from './planningUtils';
import { isHoliday } from './holidayUtils';

export const exportGeneratedPlanningToCSV = (
  assignments: Record<string, ShiftAssignment>,
  userName: string
): void => {
  // En-têtes pour le CSV au format demandé
  const rows = ['Date,Créneau,Type,Site'];

  Object.entries(assignments).forEach(([key, assignment]) => {
    const [date, period] = key.split('-');
    const { shiftType, timeSlot, site } = assignment;
    
    // Formater la date en DD-MM-YY en utilisant la date de l'assignment
    const formattedDate = formatParisDate(assignment.date, 'dd-MM-yy');

    rows.push(`${formattedDate},${timeSlot},${shiftType},${site || ''}`);
  });

  // Créer et télécharger le fichier CSV
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Planning_${userName}_${formatParisDate(createParisDate(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportGeneratedPlanningToPDF = (
  assignments: Record<string, ShiftAssignment>,
  userName: string,
  startDate: Date,
  endDate: Date,
  desiderata?: Record<string, 'primary' | 'secondary' | null | PeriodSelection>,
  showAssignmentsOnly: boolean = true
): void => {
  // Toujours utiliser exportPlanningToPDF pour garantir la même présentation
  exportPlanningToPDF({
    userName,
    startDate,
    endDate,
    assignments,
    desiderata: desiderata || {},
    showAssignmentsOnly,
    showComments: !showAssignmentsOnly // Afficher les commentaires seulement si on affiche les desiderata
  });
};

export const exportAllGeneratedPlanningsToPDFZip = async (
  users: User[],
  plannings: Record<string, Record<string, ShiftAssignment>>,
  startDate: Date,
  endDate: Date,
  desiderataMap?: Record<string, Record<string, 'primary' | 'secondary' | null | PeriodSelection>>,
  showAssignmentsOnly: boolean = true
): Promise<void> => {
  const zip = new JSZip();
  // Créer le dossier avec le format "Plannings_pdf_dateDebut"
  const folderName = `Plannings_pdf_${formatParisDate(startDate, 'dd-MM-yyyy')}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Créer un PDF pour chaque utilisateur
  for (const user of users) {
    const planning = plannings[user.id];
    if (!planning) continue;

    // Générer le PDF pour cet utilisateur
    const userDesiderata = desiderataMap ? desiderataMap[user.id] : undefined;
    
    // Créer un nouveau document PDF sans le télécharger
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Créer le PDF en utilisant la fonction helper
    const pdfDoc = await createPlanningPDFForZip(
      planning,
      `${user.lastName} ${user.firstName}`,
      startDate,
      endDate,
      userDesiderata,
      showAssignmentsOnly
    );
    
    // Ajouter le PDF au dossier zip
    folder.file(
      `Planning_${user.lastName.toUpperCase()}_${formatParisDate(startDate, 'dd-MM-yyyy')}.pdf`,
      pdfDoc.output('arraybuffer')
    );
  }

  // Générer et télécharger le zip
  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${folderName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Fonction pour créer un PDF pour le ZIP (sans téléchargement direct)
const createPlanningPDFForZip = async (
  assignments: Record<string, ShiftAssignment>,
  userName: string,
  startDate: Date,
  endDate: Date,
  desiderata?: Record<string, 'primary' | 'secondary' | null | PeriodSelection>,
  showAssignmentsOnly: boolean = true
): Promise<jsPDF> => {
  // Utiliser exportPlanningToPDF avec returnDocument=true
  const doc = exportPlanningToPDF({
    userName,
    startDate,
    endDate,
    assignments,
    desiderata: desiderata || {},
    showAssignmentsOnly,
    showComments: !showAssignmentsOnly,
    returnDocument: true
  }) as jsPDF;
  
  return doc;
};


export const exportAllGeneratedPlanningsToCSVZip = async (
  users: User[],
  plannings: Record<string, Record<string, ShiftAssignment>>,
  startDate: Date
): Promise<void> => {
  const zip = new JSZip();
  // Créer le dossier avec le format "Plannings_csv_dateDebut"
  const folderName = `Plannings_csv_${formatParisDate(startDate, 'dd-MM-yyyy')}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Créer un CSV pour chaque utilisateur
  for (const user of users) {
    const planning = plannings[user.id];
    if (!planning) continue;

    // Générer le contenu CSV
    const rows = ['Date,Créneau,Type,Site'];
    Object.entries(planning).forEach(([key, assignment]) => {
      const formattedDate = formatParisDate(assignment.date, 'dd-MM-yy');
      rows.push(`${formattedDate},${assignment.timeSlot},${assignment.shiftType},${assignment.site || ''}`);
    });

    // Ajouter le CSV au dossier zip
    folder.file(
      `Planning_${user.lastName.toUpperCase()}_${formatParisDate(startDate, 'dd-MM-yyyy')}.csv`,
      rows.join('\n')
    );
  }

  // Générer et télécharger le zip
  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${folderName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};
