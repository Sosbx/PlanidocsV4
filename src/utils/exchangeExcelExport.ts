import ExcelJS from 'exceljs';
import { formatParisDate, createParisDate } from './timezoneUtils';
import { frLocale } from './dateLocale';

interface ExchangeData {
  date: string;
  donor: string;
  shift: string;
  period: string;
  receiver: string;
  type: string;
  comment: string;
  status?: string;
  interestedUsers?: string;
  interestedCount?: number;
}

interface ExchangeExportData {
  validated: ExchangeData[];
  pending?: ExchangeData[];
  propositions?: ExchangeData[];
}

export const exportExchangesToExcel = async (
  data: ExchangeData[] | ExchangeExportData,
  phase: 'distribution' | 'completed',
  isAdmin?: boolean
): Promise<void> => {
  // Normaliser les données
  let exchanges: ExchangeData[];
  let pendingExchanges: ExchangeData[] = [];
  let propositions: ExchangeData[] = [];
  
  if (Array.isArray(data)) {
    // Pour phase completed : tableau simple avec status
    if (phase === 'completed') {
      const pourvues = data.filter(e => e.status === 'Pourvue');
      const nonPourvues = data.filter(e => e.status === 'Non pourvue');
      exchanges = pourvues;
      pendingExchanges = nonPourvues;
    } else {
      exchanges = data;
    }
  } else {
    // Format avec objets séparés
    exchanges = data.validated || [];
    pendingExchanges = data.pending || [];
    propositions = data.propositions || [];
  }
  
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet;
  let currentRow = 4;

  // Cas spécial : Phase 2 admin avec toutes les propositions
  if (phase === 'distribution' && isAdmin && propositions.length > 0) {
    const worksheet = workbook.addWorksheet('Toutes les propositions');
    worksheet.properties.defaultRowHeight = 20;
    
    // Titre
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Toutes les propositions et intérêts - Phase de distribution';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Date d'export
    worksheet.mergeCells('A2:H2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Exporté le ${formatParisDate(createParisDate(), 'dd/MM/yyyy à HH:mm', { locale: frLocale })}`;
    dateCell.font = { size: 10, italic: true };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // En-têtes
    const headers = ['Date', 'Période', 'Proposant', 'Garde', 'Statut', 'Intéressés', 'Nb Int.', 'Attribution'];
    const headerRow = worksheet.getRow(4);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4285F4' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // Données
    propositions.forEach((prop, index) => {
      const row = worksheet.getRow(5 + index);
      row.values = [
        prop.date,
        prop.period,
        prop.donor,
        prop.shift,
        prop.status,
        prop.interestedUsers,
        prop.interestedCount,
        prop.receiver
      ];
      
      // Style
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Alterner les couleurs
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        });
      }
    });
    
    // Ajuster les colonnes
    worksheet.columns = [
      { width: 12 }, // Date
      { width: 25 }, // Période
      { width: 25 }, // Proposant
      { width: 15 }, // Garde
      { width: 12 }, // Statut
      { width: 40 }, // Intéressés
      { width: 10 }, // Nb Int.
      { width: 25 }  // Attribution
    ];
  } else {
    // Cas normal : créer la feuille principale
    worksheet = workbook.addWorksheet('Échanges de garde');
    worksheet.properties.defaultRowHeight = 20;
    
    // Titre principal
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = phase === 'distribution' 
      ? 'Échanges en cours - Phase de distribution'
      : 'Historique des échanges de garde';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Date d'export
    worksheet.mergeCells('A2:G2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Exporté le ${formatParisDate(createParisDate(), 'dd/MM/yyyy à HH:mm', { locale: frLocale })}`;
    dateCell.font = { size: 10, italic: true };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Ligne vide
    worksheet.getRow(3).height = 10;
    
    currentRow = 4;
  
    // SECTION 1: Échanges validés / Gardes pourvues
    if (exchanges.length > 0) {
      // Titre de section
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const sectionCell = worksheet.getCell(`A${currentRow}`);
      sectionCell.value = phase === 'completed' ? '=== GARDES POURVUES ===' : '=== ÉCHANGES VALIDÉS ===';
      sectionCell.font = { size: 14, bold: true };
      sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sectionCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      currentRow += 2;
    
    // En-têtes des colonnes
    const headers = ['Date', 'Période', 'Donneur', 'Garde', 'Receveur', 'Type', 'Commentaire'];
    const headerRow = worksheet.getRow(currentRow);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4285F4' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    currentRow++;
    
    // Données des échanges validés
    exchanges.forEach((exchange, index) => {
      const row = worksheet.getRow(currentRow);
      
      row.values = [
        exchange.date,
        exchange.period,
        exchange.donor,
        exchange.shift,
        exchange.receiver,
        exchange.type,
        exchange.comment
      ];
      
      // Style pour les données
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Coloration du type d'échange
        if (colNumber === 6) {
          if (exchange.type === 'Échange') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE3F2FD' }
            };
            cell.font = { color: { argb: 'FF1976D2' }, bold: true };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE8F5E9' }
            };
            cell.font = { color: { argb: 'FF388E3C' }, bold: true };
          }
        }
      });
      
      // Alterner les couleurs de lignes
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          if (!cell.fill || cell.fill.type !== 'pattern') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }
            };
          }
        });
      }
      currentRow++;
    });
  }
  
    // SECTION 2: Gardes sans preneur / non pourvues
    if (pendingExchanges.length > 0) {
      currentRow += 2; // Espace entre les sections
      
      // Titre de section
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const sectionCell = worksheet.getCell(`A${currentRow}`);
      sectionCell.value = phase === 'completed' ? '=== GARDES NON POURVUES ===' : '=== GARDES SANS PRENEUR ===';
      sectionCell.font = { size: 14, bold: true };
      sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sectionCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCDD2' }
      };
      currentRow += 2;
    
    // En-têtes des colonnes
    const headers = ['Date', 'Période', 'Donneur', 'Garde', 'Statut', 'Type souhaité', 'Commentaire'];
    const headerRow = worksheet.getRow(currentRow);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF44336' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    currentRow++;
    
    // Données des gardes sans preneur
    pendingExchanges.forEach((exchange, index) => {
      const row = worksheet.getRow(currentRow);
      
      row.values = [
        exchange.date,
        exchange.period,
        exchange.donor,
        exchange.shift,
        'En attente',
        exchange.type,
        exchange.comment
      ];
      
      // Style pour les données
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Alterner les couleurs de lignes
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3E0' }
          };
        });
      }
      currentRow++;
    });
  }
  
    // Ajuster la largeur des colonnes
    worksheet.columns = [
      { width: 12 }, // Date
      { width: 25 }, // Période
      { width: 25 }, // Donneur
      { width: 15 }, // Garde
      { width: 25 }, // Receveur
      { width: 12 }, // Type
      { width: 40 }  // Commentaire
    ];
    
    // Statistiques en bas du tableau (seulement pour le cas normal)
    if (!(phase === 'distribution' && isAdmin && propositions.length > 0)) {
      currentRow += 2;
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const statsCell = worksheet.getCell(`A${currentRow}`);
      
      const totalValidated = exchanges.length;
      const totalPending = pendingExchanges.length;
      const totalAll = totalValidated + totalPending;
      const successRate = totalAll > 0 ? Math.round((totalValidated / totalAll) * 100) : 0;
      const permutations = exchanges.filter(e => e.type === 'Échange').length;
      const cessions = exchanges.filter(e => e.type === 'Cède').length;
      
      let statsText = '';
      if (phase === 'completed') {
        statsText = `Gardes pourvues: ${totalValidated} | Non pourvues: ${totalPending} | `;
        statsText += `Taux de réussite: ${successRate}% | `;
        statsText += `Permutations: ${permutations} | Cessions: ${cessions}`;
      } else if (phase === 'distribution' && totalPending > 0) {
        statsText = `Échanges validés: ${totalValidated} (Permutations: ${permutations}, Cessions: ${cessions}) | `;
        statsText += `Sans preneur: ${totalPending} | Taux de réussite: ${successRate}%`;
      } else {
        statsText = `Total: ${totalValidated} échanges | Permutations: ${permutations} | Cessions: ${cessions}`;
      }
      
      statsCell.value = statsText;
      statsCell.font = { italic: true, size: 10, bold: true };
      statsCell.alignment = { horizontal: 'center' };
      statsCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' }
      };
    }
  }
  
  // Générer et télécharger le fichier
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `echanges_gardes_${phase}_${formatParisDate(createParisDate(), 'dd-MM-yyyy')}.xlsx`;
  link.click();
  
  window.URL.revokeObjectURL(url);
};