import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { utils, write } from 'xlsx';
import { getDaysArray, isGrayedOut } from './dateUtils';

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  selections: Record<string, 'primary' | 'secondary' | null>;
}

export const exportPlanningToExcel = ({
  userName,
  startDate,
  endDate,
  selections
}: ExportPlanningOptions): void => {
  // Créer un nouveau workbook
  const wb = utils.book_new();
  
  // Organiser les données par mois
  const months = getDaysArray(startDate, endDate).reduce((acc, day) => {
    const monthKey = format(day, 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(day);
    return acc;
  }, {} as Record<string, Date[]>);

  // Préparer les données pour le format AOA (Array of Arrays)
  const data: any[][] = [];
  const monthsData = Object.entries(months);
  
  // Première ligne : titres des mois
  const headerRow: any[] = [];
  monthsData.forEach(([_, days]) => {
    const monthTitle = format(days[0], 'MMMM yyyy', { locale: fr });
    headerRow.push(monthTitle, '', '', ''); // 4 colonnes par mois
  });
  data.push(headerRow);

  // Deuxième ligne : en-têtes des colonnes
  const subHeaderRow: any[] = [];
  monthsData.forEach(() => {
    subHeaderRow.push('Jour', 'M', 'AM', 'S');
  });
  data.push(subHeaderRow);

  // Données des jours
  const maxDays = Math.max(...monthsData.map(([_, days]) => days.length));
  for (let dayIndex = 0; dayIndex < maxDays; dayIndex++) {
    const row: any[] = [];
    monthsData.forEach(([_, days]) => {
      if (dayIndex < days.length) {
        const day = days[dayIndex];
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLabel = `${format(day, 'd', { locale: fr })} ${format(day, 'EEEEEE', { locale: fr })}`;
        
        row.push(dayLabel);
        
        // Ajouter les cellules pour M, AM, S
        ['M', 'AM', 'S'].forEach(period => {
          const cellKey = `${dateStr}-${period}`;
          const value = selections[cellKey];
          row.push(value === 'primary' ? 'P' : value === 'secondary' ? 'S' : '');
        });
      } else {
        row.push('', '', '', ''); // Cellules vides pour compléter le mois
      }
    });
    data.push(row);
  }

  // Créer la feuille avec les données
  const ws = utils.aoa_to_sheet(data);

  // Appliquer les styles
  const range = utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellRef = utils.encode_cell({r: R, c: C});
      const cell = ws[cellRef];
      if (!cell) continue;

      // Initialiser le style de la cellule
      cell.s = {
        border: {
          top: { style: 'thin', color: { rgb: "000000" } },
          right: { style: 'thin', color: { rgb: "000000" } },
          bottom: { style: 'thin', color: { rgb: "000000" } },
          left: { style: 'thin', color: { rgb: "000000" } }
        },
        alignment: {
          horizontal: C % 4 === 0 ? 'left' : 'center',
          vertical: 'center'
        }
      };

      // Styles pour les en-têtes
      if (R <= 1) {
        cell.s.fill = { fgColor: { rgb: "E2E8F0" }, type: 'pattern', patternType: 'solid' };
        cell.s.font = { bold: true };
      }

      // Styles pour les cellules de données
      if (R > 1 && C % 4 !== 0) { // Colonnes M, AM, S
        const value = cell.v;
        if (value === 'P') {
          cell.s.fill = { fgColor: { rgb: "FFCDD2" }, type: 'pattern', patternType: 'solid' };
          cell.s.font = { color: { rgb: "B71C1C" }, bold: true };
        } else if (value === 'S') {
          cell.s.fill = { fgColor: { rgb: "DBEAFE" }, type: 'pattern', patternType: 'solid' };
          cell.s.font = { color: { rgb: "1E40AF" }, bold: true };
        }
      }
    }
  }

  // Fusionner les cellules des titres de mois
  ws['!merges'] = [];
  for (let i = 0; i < monthsData.length; i++) {
    ws['!merges'].push({
      s: { r: 0, c: i * 4 },
      e: { r: 0, c: i * 4 + 3 }
    });
  }

  // Définir les largeurs de colonnes
  const colWidth = [
    { wch: 15 }, // Jour
    { wch: 5 },  // M
    { wch: 5 },  // AM
    { wch: 5 }   // S
  ];
  ws['!cols'] = monthsData.reduce((acc, _) => [...acc, ...colWidth], []);

  // Ajouter la feuille au workbook
  utils.book_append_sheet(wb, ws, 'Planning');

  // Générer et télécharger le fichier
  const fileName = `planning_${userName}_${format(startDate, 'yyyy-MM-dd')}.xlsx`;
  const wbout = write(wb, {
    bookType: 'xlsx',
    type: 'binary',
    cellStyles: true
  });
  
  const blob = new Blob([s2ab(wbout)], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Helper function to convert string to ArrayBuffer
const s2ab = (s: string): ArrayBuffer => {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xFF;
  }
  return buf;
};