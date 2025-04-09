import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import JSZip from 'jszip';
import { getDaysArray, getMonthsInRange, isGrayedOut, formatPeriod } from './dateUtils';
import { calculatePercentages } from './planningUtils';
import type { Selections, ShiftAssignment, PeriodSelection } from '../types/planning';
import type { User } from '../features/users/types';
// Définir une configuration locale pour éviter l'import manquant
const planningConfig = {
  primaryDesiderataLimit: 30,
  secondaryDesiderataLimit: 20
};

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  assignments: Record<string, ShiftAssignment>;
  desiderata?: Record<string, 'primary' | 'secondary' | null>;
  primaryLimit?: number;
  secondaryLimit?: number;
  showAssignmentsOnly?: boolean;
  showComments?: boolean;
}

export const exportPlanningToPDF = ({
  userName,
  startDate,
  endDate,
  assignments,
  desiderata = {},
  primaryLimit,
  secondaryLimit,
  showAssignmentsOnly = false,
  showComments = false
}: ExportPlanningOptions): void => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 10;
  const fontSize = 7;
  const cellPadding = 1;

  // Utiliser formatPeriod pour obtenir les noms standardisés des périodes
  const comments: { date: string; period: string; comment: string }[] = [];

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Transformer les desiderata pour correspondre au type Selections
  const transformedDesiderata: Selections = {};
  if (!showAssignmentsOnly && desiderata) {
    Object.entries(desiderata).forEach(([key, value]) => {
      transformedDesiderata[key] = {
        type: value
      };
    });
  }
  
  // Calculer les pourcentages si on affiche les desiderata
  const percentages = !showAssignmentsOnly ? calculatePercentages(transformedDesiderata, startDate, endDate) : null;

  // Fonction pour formater la date au format YYYY-MM-DD
  const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  // Titre du document
  const title = `Planning ${userName} - ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`;
    
  doc.setFontSize(11);
  doc.text(title, margin, margin);
  
  // Afficher les pourcentages si les limites sont définies
  if (!showAssignmentsOnly && percentages && primaryLimit !== undefined && secondaryLimit !== undefined) {
    doc.setFontSize(9);
    
    const primaryText = `Primaire: ${percentages.primary.toFixed(1)}% / ${primaryLimit}%`;
    const secondaryText = `Secondaire: ${percentages.secondary.toFixed(1)}% / ${secondaryLimit}%`;
    
    // Ajouter des points colorés
    doc.setFillColor(255, 205, 210); // bg-red-100
    doc.circle(margin, margin + 5, 1.5, 'F');
    doc.setFillColor(219, 234, 254); // bg-blue-100
    doc.circle(margin + 60, margin + 5, 1.5, 'F');
    
    // Texte des pourcentages
    doc.setTextColor(percentages.primary > primaryLimit ? 220 : 75, 85, 99); // text-red-600 ou text-gray-600
    doc.text(primaryText, margin + 4, margin + 6);
    
    doc.setTextColor(percentages.secondary > secondaryLimit ? 220 : 75, 85, 99);
    doc.text(secondaryText, margin + 64, margin + 6);
  }

  // Préparation des données par mois
  const months = getMonthsInRange(startDate, endDate);
  const monthTables = months.map(month => {
    const days = getDaysArray(startDate, endDate).filter(day => 
      day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear()
    );

    return {
      monthTitle: format(month, 'MMMM yyyy', { locale: fr }).toUpperCase(),
      data: days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayStr = format(day, 'dd/MM/yyyy');
        const dayLabel = `${format(day, 'd', { locale: fr })} ${format(day, 'EEEEEE', { locale: fr }).toLowerCase()}`;
        const isGrayed = isGrayedOut(day);
        
        return {
          dayLabel,
          isGrayed,
          periods: ['M', 'AM', 'S'].map(period => {
            const cellKey = `${dateStr}-${period}`;
            const assignment = assignments[cellKey];
            const desideratum = !showAssignmentsOnly ? desiderata[cellKey] : null;
            
            return {
              assignment,
              desideratum,
              isGrayed
            };
          })
        };
      })
    };
  });

  // Calcul des dimensions des tableaux
  const tableWidth = (pageWidth - (2 * margin) - ((months.length - 1) * 2)) / months.length;
  const columnWidth = tableWidth / 4;
  
  // Ajuster le startY pour tenir compte des pourcentages
  const startY = margin + (primaryLimit !== undefined ? 12 : 8);

  let startX = margin;

  // Définition des couleurs avec plus de contraste (tuples de 3 éléments)
  const colors = {
    primary: {
      bg: [255, 205, 210] as [number, number, number], // Rouge clair
      text: [183, 28, 28] as [number, number, number],  // Rouge foncé
      border: [0, 0, 0] as [number, number, number]     // Noir pour la bordure
    },
    secondary: {
      bg: [207, 226, 255] as [number, number, number], // Bleu clair
      text: [30, 64, 175] as [number, number, number],  // Bleu foncé
      border: [0, 0, 0] as [number, number, number]     // Noir pour la bordure
    },
    comment: {
      bg: [255, 251, 235] as [number, number, number], // Jaune très clair (bg-yellow-50)
      text: [0, 0, 0] as [number, number, number],     // Noir
      border: [0, 0, 0] as [number, number, number]    // Noir pour la bordure
    },
    grayed: {
      bg: [243, 244, 246] as [number, number, number], // bg-gray-100
      text: [75, 85, 99] as [number, number, number]   // text-gray-600
    },
    header: {
      bg: [243, 244, 246] as [number, number, number], // bg-gray-100
      text: [31, 41, 55] as [number, number, number]   // text-gray-800
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
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
        fillColor: colors.header.bg,
        textColor: colors.header.text,
        cellPadding: 1
      },
      margin: { left: startX },
      tableWidth
    });

    // Corps du tableau
    autoTable(doc, {
      startY: startY + 8,
      head: [['Jour', 'M', 'AM', 'S']],
      body: data.map(({ dayLabel, isGrayed, periods }) => [
        { content: dayLabel, isGrayed, isDay: true },
        ...periods.map(p => ({
          content: p.assignment?.shiftType || '',
          assignment: p.assignment,
          desideratum: p.desideratum,
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
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: columnWidth * 0.8, halign: 'left' },
        1: { cellWidth: columnWidth * 0.8, halign: 'center' },
        2: { cellWidth: columnWidth * 0.8, halign: 'center' },
        3: { cellWidth: columnWidth * 0.8, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const cellData = data.cell.raw as { 
            content: string; 
            assignment?: ShiftAssignment;
            desideratum?: { type: 'primary' | 'secondary' | null };
            isGrayed: boolean;
            isDay?: boolean;
          };
          if (!cellData) return;
          
          // Réinitialiser les styles de bordure par défaut
          data.cell.styles.lineWidth = 0.1;
          data.cell.styles.lineColor = [0, 0, 0];
          // Utiliser une comparaison de type compatible
          data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
          
          // Gérer différemment la colonne des jours
          if (cellData.isDay) {
            data.cell.text = [cellData.content];
            data.cell.styles.halign = 'left';
            data.cell.styles.fontStyle = 'normal'; 
            if (cellData.isGrayed) {
              data.cell.styles.fillColor = colors.grayed.bg;
              data.cell.styles.textColor = colors.grayed.text;
            }
            return;
          }

          // Appliquer le style de base pour les jours grisés
          if (cellData.isGrayed) {
            data.cell.styles.fillColor = colors.grayed.bg;
            data.cell.styles.textColor = colors.grayed.text;
          }

          // Si on affiche les desiderata et qu'il y en a un
          if (!showAssignmentsOnly && cellData.desideratum?.type) {
            if (cellData.desideratum.type === 'primary') {
              data.cell.styles.fillColor = colors.primary.bg;
              data.cell.styles.textColor = colors.primary.text;
            } else if (cellData.desideratum.type === 'secondary') {
              data.cell.styles.fillColor = colors.secondary.bg;
              data.cell.styles.textColor = colors.secondary.text;
            }
          }
          
          // Afficher le type de garde
          data.cell.styles.fontStyle = 'bold';
          data.cell.text = [cellData.assignment?.shiftType || ''];
        }
      },
      margin: { left: startX },
      tableWidth
    });

    startX += tableWidth + (monthIndex < months.length - 1 ? 0.2 : 0);
  });
  // Ajouter les commentaires si présents
  if (showComments && comments.length > 0) {
    // Ajouter un saut de page si nécessaire
    doc.addPage();
    
    // Titre de la section commentaires
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Commentaires', margin, margin + 5);
    
    // Tableau des commentaires
    autoTable(doc, {
      startY: margin + 10,
      head: [['Date', 'Période', 'Commentaire']],
      body: comments.map(({ date, period, comment }) => [date, period, comment]),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin }
    });
  }

  // Génération du fichier
  const prefix = showAssignmentsOnly ? 'Planning' : 'Planning_avec_desiderata';
  const fileName = `${prefix}_${userName.toUpperCase()}_${format(startDate, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};

export const exportAllPlanningsToPDFZip = async (
  users: User[],
  desiderataData: Record<string, { selections: Record<string, 'primary' | 'secondary' | null> }>,
  startDate: Date,
  endDate: Date
): Promise<void> => {
  const zip = new JSZip();
  // Créer le dossier avec le format "Desiderata_pdf_dateDebut"
  const folderName = `Desiderata_pdf_${format(startDate, 'dd-MM-yyyy')}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Créer un PDF pour chaque utilisateur
  for (const user of users) {
    const userData = desiderataData[user.id];
    if (!userData?.selections) continue;

    const exportOptions = {
      userName: `${user.lastName}_${user.firstName}`,
      startDate,
      endDate,
      selections: userData.selections,
      primaryLimit: planningConfig.primaryDesiderataLimit,
      secondaryLimit: planningConfig.secondaryDesiderataLimit
    };

    // Créer un nouveau document PDF et générer son contenu
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Utiliser formatPeriod pour obtenir les noms standardisés des périodes
    const comments: any[] = [];
    const margin = 10;
    const pageWidth = doc.internal.pageSize.width;

    // Transformer les sélections pour correspondre au type Selections
    const transformedSelections: Selections = {};
    Object.entries(exportOptions.selections).forEach(([key, value]) => {
      transformedSelections[key] = {
        type: value
      };
    });
    
    // Calculer les pourcentages
    const percentages = calculatePercentages(transformedSelections, startDate, endDate);

    // Titre du document
    const title = `Desiderata ${exportOptions.userName} - ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`;
    doc.setFontSize(11);
    doc.text(title, margin, margin);

    // Afficher les pourcentages si les limites sont définies
    if (exportOptions.primaryLimit !== undefined && exportOptions.secondaryLimit !== undefined) {
      doc.setFontSize(9);
      
      const primaryText = `Primaire: ${percentages.primary.toFixed(1)}% / ${exportOptions.primaryLimit}%`;
      const secondaryText = `Secondaire: ${percentages.secondary.toFixed(1)}% / ${exportOptions.secondaryLimit}%`;
      
      // Ajouter des points colorés
      doc.setFillColor(255, 205, 210); // bg-red-100
      doc.circle(margin, margin + 5, 1.5, 'F');
      doc.setFillColor(219, 234, 254); // bg-blue-100
      doc.circle(margin + 60, margin + 5, 1.5, 'F');
      
      // Texte des pourcentages
      doc.setTextColor(percentages.primary > exportOptions.primaryLimit ? 220 : 75, 85, 99); // text-red-600 ou text-gray-600
      doc.text(primaryText, margin + 4, margin + 6);
      
      doc.setTextColor(percentages.secondary > exportOptions.secondaryLimit ? 220 : 75, 85, 99);
      doc.text(secondaryText, margin + 64, margin + 6);
    }

    // Utiliser la même logique de génération que dans exportPlanningToPDF
    const months = getMonthsInRange(startDate, endDate);
    const monthTables = months.map(month => {
      const days = getDaysArray(startDate, endDate).filter(day => 
        day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear()
      );

      return {
        monthTitle: format(month, 'MMMM yyyy', { locale: fr }).toUpperCase(),
        data: days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayStr = format(day, 'dd/MM/yyyy');
          const dayLabel = `${format(day, 'd', { locale: fr })} ${format(day, 'EEEEEE', { locale: fr })}`;
          const isGrayed = isGrayedOut(day);
          const cellKey = `${dateStr}-${period}`;
          const assignment = assignment[cellKey];
          const desideratum = !showAssignmentsOnly ? desideratum[cellKey] : null;
          
          return {
            dayLabel,
            assignment,
            desideratum
          };
        })
      };
    });

    // Calcul des dimensions des tableaux
    const tableWidth = (pageWidth - (2 * margin) - ((months.length - 1) * 2)) / months.length;
    const columnWidth = tableWidth / 4;

    let startX = margin;
    const startY = margin + 8;

    // Utiliser les mêmes couleurs que dans exportPlanningToPDF
    const colors = {
      primary: {
        bg: [255, 205, 210],
        text: [183, 28, 28],
        border: [0, 0, 0]
      },
      secondary: {
        bg: [207, 226, 255],
        text: [30, 64, 175],
        border: [0, 0, 0]
      },
      comment: {
        bg: [255, 251, 235],
        text: [0, 0, 0],
        border: [0, 0, 0]
      },
      grayed: {
        bg: [243, 244, 246],
        text: [75, 85, 99]
      },
      header: {
        bg: [243, 244, 246],
        text: [31, 41, 55]
      }
    };

    // Générer les tableaux pour chaque mois
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
            content: p.assignment?.shiftType || '',
            assignment: p.assignment,
            desideratum: p.desideratum,
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
              type?: string; 
              comment?: string;
              isGrayed: boolean 
            };
            if (!cellData) return;
            
            data.cell.styles.lineWidth = 0.1;
            data.cell.styles.lineColor = [0, 0, 0];

            if (cellData.type === 'primary') {
              if (cellData.comment) {
                data.cell.styles.fillColor = colors.comment.bg;
                data.cell.styles.textColor = colors.primary.text;
                data.cell.styles.lineWidth = 0.5;
                data.cell.styles.lineColor = colors.primary.border;
              } else {
                data.cell.styles.fillColor = colors.primary.bg;
                data.cell.styles.textColor = colors.primary.text;
              }
              data.cell.styles.fontStyle = 'bold';
            } else if (cellData.type === 'secondary') {
              if (cellData.comment) {
                data.cell.styles.fillColor = colors.comment.bg;
                data.cell.styles.textColor = colors.secondary.text;
                data.cell.styles.lineWidth = 0.5;
                data.cell.styles.lineColor = colors.secondary.border;
              } else {
                data.cell.styles.fillColor = colors.secondary.bg;
                data.cell.styles.textColor = colors.secondary.text;
              }
              data.cell.styles.fontStyle = 'bold';
            } else if (cellData.isGrayed) {
              data.cell.styles.fillColor = colors.grayed.bg;
              data.cell.styles.textColor = colors.grayed.text;
            }
            
            data.cell.text = [cellData.content];
          }
        },
        margin: { left: startX },
        tableWidth
      });

      startX += tableWidth + (monthIndex < months.length - 1 ? 0.5 : 0);
    });

    // Ajouter les commentaires si présents
    if (comments.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Commentaires', margin, margin + 5);
      
      autoTable(doc, {
        startY: margin + 10,
        head: [['Date', 'Période', 'Commentaire']],
        body: comments.map(({ date, period, comment }) => [date, period, comment]),
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });
    }
    
    // Ajouter le PDF au dossier zip
    folder.file(
      `${user.lastName.toUpperCase()}_${format(startDate, 'dd-MM-yyyy')}.pdf`,
      doc.output(),
      { binary: true }
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
