import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Workbook, Worksheet } from 'exceljs';
import { getDaysArray } from './dateUtils';

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections: Record<string, 'primary' | 'secondary' | null>;
}

export const exportPlanningToExcel = async ({
  userName,
  startDate,
  endDate,
  selections
}: ExportPlanningOptions): Promise<void> => {
  // Créer un nouveau workbook
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Planning');
  
  // Organiser les données par mois
  const months = getDaysArray(startDate, endDate).reduce((acc, day) => {
    const monthKey = format(day, 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(day);
    return acc;
  }, {} as Record<string, Date[]>);

  const monthsData = Object.entries(months);
  
  // Première ligne : titres des mois
  const headerRow = worksheet.getRow(1);
  let colIndex = 1;
  monthsData.forEach(([_, days]) => {
    const monthTitle = format(days[0], 'MMMM yyyy', { locale: fr });
    headerRow.getCell(colIndex).value = monthTitle;
    // Fusionner les cellules pour le titre du mois (4 colonnes)
    worksheet.mergeCells(1, colIndex, 1, colIndex + 3);
    
    // Style pour le titre du mois
    const titleCell = headerRow.getCell(colIndex);
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    titleCell.font = { bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    
    colIndex += 4;
  });

  // Deuxième ligne : en-têtes des colonnes
  const subHeaderRow = worksheet.getRow(2);
  colIndex = 1;
  monthsData.forEach(() => {
    ['Jour', 'M', 'AM', 'S'].forEach((header, i) => {
      const cell = subHeaderRow.getCell(colIndex + i);
      cell.value = header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    colIndex += 4;
  });

  // Données des jours
  const maxDays = Math.max(...monthsData.map(([_, days]) => days.length));
  for (let dayIndex = 0; dayIndex < maxDays; dayIndex++) {
    const rowIndex = dayIndex + 3; // Commencer à la ligne 3
    const row = worksheet.getRow(rowIndex);
    colIndex = 1;
    
    monthsData.forEach(([_, days]) => {
      if (dayIndex < days.length) {
        const day = days[dayIndex];
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLabel = `${format(day, 'd', { locale: fr })} ${format(day, 'EEEEEE', { locale: fr })}`;
        
        // Cellule du jour
        const dayCell = row.getCell(colIndex);
        dayCell.value = dayLabel;
        dayCell.alignment = { horizontal: 'left', vertical: 'middle' };
        dayCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Cellules pour M, AM, S
        ['M', 'AM', 'S'].forEach((period, i) => {
          const cellKey = `${dateStr}-${period}`;
          const value = selections[cellKey];
          const cell = row.getCell(colIndex + 1 + i);
          
          if (value === 'primary') {
            cell.value = 'P';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFCDD2' }
            };
            cell.font = { color: { argb: 'FFB71C1C' }, bold: true };
          } else if (value === 'secondary') {
            cell.value = 'S';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFDBEAFE' }
            };
            cell.font = { color: { argb: 'FF1E40AF' }, bold: true };
          } else {
            cell.value = '';
          }
          
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      } else {
        // Cellules vides pour compléter le mois
        for (let i = 0; i < 4; i++) {
          const cell = row.getCell(colIndex + i);
          cell.value = '';
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
      colIndex += 4;
    });
  }

  // Définir les largeurs de colonnes
  monthsData.forEach((_, monthIndex) => {
    const baseCol = monthIndex * 4 + 1;
    worksheet.getColumn(baseCol).width = 15;     // Jour
    worksheet.getColumn(baseCol + 1).width = 5;  // M
    worksheet.getColumn(baseCol + 2).width = 5;  // AM
    worksheet.getColumn(baseCol + 3).width = 5;  // S
  });

  // Générer et télécharger le fichier
  const fileName = `planning_${userName}_${format(startDate, 'yyyy-MM-dd')}.xlsx`;
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};