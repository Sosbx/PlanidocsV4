import { format } from 'date-fns';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { frLocale } from '../../../utils/dateLocale';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDaysArray, getMonthsInRange, isGrayedOut } from './dateUtils';
import type { ShiftAssignment } from '../types/planning';
import type { User } from '../types/users';

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
    const formattedDate = formatParisDate(new Date(assignment.date), 'dd-MM-yy');

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
  endDate: Date
): void => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const periodNames = { M: 'Matin', AM: 'Après-midi', S: 'Soir' };
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;

  // Titre du document
  const title = `Planning ${userName} - ${formatParisDate(startDate, 'dd/MM/yyyy')} au ${formatParisDate(endDate, 'dd/MM/yyyy')}`;
  doc.setFontSize(11);
  doc.text(title, margin, margin);

  // Préparation des données par mois
  const months = getMonthsInRange(startDate, endDate);
  const monthTables = months.map(month => {
    const days = getDaysArray(startDate, endDate).filter(day => 
      day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear()
    );

    return {
      monthTitle: formatParisDate(month, 'MMMM yyyy', { locale: frLocale }).toUpperCase(),
      data: days.map(day => {
        const dateStr = formatParisDate(day, 'yyyy-MM-dd');
        const dayLabel = `${formatParisDate(day, 'd', { locale: frLocale })} ${formatParisDate(day, 'EEEEEE', { locale: frLocale })}`;
        const isGrayed = isGrayedOut(day);
        
        return {
          dayLabel,
          isGrayed,
          periods: ['M', 'AM', 'S'].map(period => {
            const cellKey = `${dateStr}-${period}`;
            const assignment = assignments[cellKey];
            return assignment ? {
              content: assignment.shiftType,
              site: assignment.site
            } : null;
          })
        };
      })
    };
  });

  // Calcul des dimensions des tableaux
  const tableWidth = (pageWidth - (2 * margin) - ((months.length - 1) * 2)) / months.length;
  const columnWidth = tableWidth / 4;
  const startY = margin + 8;
  let startX = margin;

  // Définition des couleurs
  const colors = {
    grayed: {
      bg: [243, 244, 246], // bg-gray-100
      text: [75, 85, 99]   // text-gray-600
    },
    header: {
      bg: [243, 244, 246], // bg-gray-100
      text: [31, 41, 55]   // text-gray-800
    }
  };

  // Génération des tableaux pour chaque mois
  monthTables.forEach(({ monthTitle, data }, monthIndex) => {
    // En-tête du mois
    autoTable(doc, {
      startY,
      head: [[monthTitle]],
      body: [],
      theme: 'grid',
      styles: {
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        fillColor: colors.header.bg,
        textColor: colors.header.text,
        cellPadding: 2
      },
      margin: { left: startX },
      tableWidth
    });

    // Corps du tableau
    autoTable(doc, {
      startY: startY + 8,
      head: [['Jour', 'M', 'AM', 'S']],
      body: data.map(({ dayLabel, isGrayed, periods }) => [
        { content: dayLabel, isGrayed },
        ...periods.map(p => ({
          content: p?.content || '',
          timeSlot: p?.timeSlot || '',
          isGrayed
        }))
      ]),
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        minCellHeight: 4
      },
      headStyles: {
        fillColor: colors.header.bg,
        textColor: colors.header.text,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: columnWidth * 1.5 },
        1: { cellWidth: columnWidth * 0.8, halign: 'center' },
        2: { cellWidth: columnWidth * 0.8, halign: 'center' },
        3: { cellWidth: columnWidth * 0.8, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const cellData = data.cell.raw as { 
            content: string;
            isGrayed: boolean 
          };
          if (!cellData) return;

          if (cellData.isGrayed) {
            data.cell.styles.fillColor = colors.grayed.bg;
            data.cell.styles.textColor = colors.grayed.text;
          }

          data.cell.text = [cellData.content];
        }
      },
      margin: { left: startX },
      tableWidth
    });

    startX += tableWidth + (monthIndex < months.length - 1 ? 2 : 0);
  });

  return doc;
};

export const exportAllGeneratedPlanningsToPDFZip = async (
  users: User[],
  plannings: Record<string, Record<string, ShiftAssignment>>,
  startDate: Date,
  endDate: Date
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
    const doc = exportGeneratedPlanningToPDF(
      planning,
      `${user.lastName} ${user.firstName}`,
      startDate,
      endDate
    );

    // Ajouter le PDF au dossier zip
    folder.file(
      `Planning_${user.lastName.toUpperCase()}_${formatParisDate(startDate, 'dd-MM-yyyy')}.pdf`,
      doc.output('arraybuffer')
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
      const formattedDate = formatParisDate(new Date(assignment.date), 'dd-MM-yy');
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