import jsPDF from 'jspdf';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import autoTable from 'jspdf-autotable';
import { format, getDaysInMonth, isWeekend } from 'date-fns';
import { frLocale } from '../../../utils/dateLocale';
import { getMonthsInRange, isGrayedOut } from '../../../utils/dateUtils';
import { isHoliday, isBridgeDay } from '../../../utils/holidayUtils';
import { getColorForPercentage, getColorForAvailability } from './statsCalculations';
import type { DesiderataStats } from '../types';

type MatrixExportType = 'all' | 'primary' | 'secondary' | 'availability';

interface MatrixExportOptions {
  stats: DesiderataStats[];
  exportType: MatrixExportType;
  associationName?: string;
}

const getExportTitle = (exportType: MatrixExportType): string => {
  switch (exportType) {
    case 'primary':
      return 'Matrice des indisponibilités - Primaires uniquement';
    case 'secondary':
      return 'Matrice des indisponibilités - Secondaires uniquement';
    case 'availability':
      return 'Matrice des disponibilités';
    default:
      return 'Matrice des indisponibilités';
  }
};

const getColorForPDF = (percentage: number, isAvailability: boolean): string => {
  if (isAvailability) {
    // Pour les disponibilités
    if (percentage >= 80) return '#10b981'; // green
    if (percentage >= 60) return '#facc15'; // yellow
    if (percentage >= 40) return '#fb923c'; // orange
    if (percentage >= 20) return '#f87171'; // red
    return '#dc2626'; // dark red
  } else {
    // Pour les indisponibilités
    if (percentage === 0) return '#d1fae5'; // very light green
    if (percentage < 20) return '#a7f3d0'; // light green
    if (percentage < 40) return '#fef3c7'; // light yellow
    if (percentage < 60) return '#fed7aa'; // light orange
    if (percentage < 80) return '#fecaca'; // light red
    return '#fca5a5'; // red
  }
};

export const exportMatrixToPDF = ({
  stats,
  exportType,
  associationName = ''
}: MatrixExportOptions): void => {
  if (!stats || stats.length === 0) return;

  // Créer une map pour accès rapide aux stats par date
  const statsMap = stats.reduce((acc: Record<string, DesiderataStats>, day) => {
    acc[day.date] = day;
    return acc;
  }, {});

  // Obtenir la plage de dates
  const startDate = new Date(stats[0].date);
  const endDate = new Date(stats[stats.length - 1].date);
  const months = getMonthsInRange(startDate, endDate);

  // Créer le PDF en paysage
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Titre
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = getExportTitle(exportType);
  doc.text(title, 10, 10);

  // Calculer le nombre de médecins uniques
  const uniqueDoctors = new Set<number>();
  stats.forEach(dayStat => {
    Object.values(dayStat.periods).forEach(period => {
      if (period.total > 0) {
        uniqueDoctors.add(period.total);
      }
    });
  });
  const doctorCount = uniqueDoctors.size > 0 ? Math.max(...uniqueDoctors) : 0;
  
  // Sous-titre avec date, association et nombre de médecins
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const subtitle = `${associationName} - ${doctorCount} médecins - Généré le ${formatParisDate(createParisDate(), 'dd MMMM yyyy', { locale: frLocale })}`;
  doc.text(subtitle, 10, 16);

  // Préparer les données pour autoTable
  const headers = ['J'];
  const periods = ['M', 'AM', 'S'];
  
  // Ajouter les en-têtes pour chaque mois et période
  months.forEach((month, index) => {
    const monthName = formatParisDate(month, 'MMM', { locale: frLocale });
    if (index > 0) {
      headers.push('J'); // Ajouter une colonne jour avant chaque mois sauf le premier
    }
    periods.forEach(period => {
      headers.push(`${monthName} ${period}`);
    });
  });

  // Préparer les lignes de données
  const rows: any[][] = [];
  
  // Fonction pour obtenir l'abréviation du jour
  const getDayAbbr = (date: Date): string => {
    const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
    return days[date.getDay()];
  };

  // Générer tous les jours (1-31)
  for (let dayNum = 1; dayNum <= 31; dayNum++) {
    // Créer la première cellule avec jour et abréviation
    const firstMonthDate = new Date(months[0].getFullYear(), months[0].getMonth(), dayNum);
    const dayAbbr = dayNum <= getDaysInMonth(months[0]) ? getDayAbbr(firstMonthDate) : '';
    const isFirstWeekend = dayNum <= getDaysInMonth(months[0]) && isWeekend(firstMonthDate);
    const isFirstHoliday = dayNum <= getDaysInMonth(months[0]) && isHoliday(firstMonthDate);
    const isFirstBridge = dayNum <= getDaysInMonth(months[0]) && isBridgeDay(firstMonthDate);
    
    const row: any[] = [{
      content: `${dayNum}\n${dayAbbr || ''}`,
      styles: {
        fillColor: isFirstWeekend ? [219, 234, 254] : [245, 245, 245], // Fond bleu clair pour weekends
        fontStyle: isFirstWeekend || isFirstHoliday || isFirstBridge ? 'bold' : 'normal',
        fontSize: 4,
        halign: 'center',
        textColor: (isFirstHoliday || isFirstBridge) ? [220, 38, 38] : isFirstWeekend ? [29, 78, 216] : [100, 100, 100] // Rouge pour fériés/ponts, bleu pour weekends, gris sinon
      }
    }];
    
    months.forEach((month, monthIndex) => {
      const daysInMonth = getDaysInMonth(month);
      
      // Ajouter le numéro du jour avant chaque mois sauf le premier
      if (monthIndex > 0) {
        if (dayNum <= daysInMonth) {
          const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
          const dayAbbr = getDayAbbr(date);
          const isCurrentWeekend = isWeekend(date);
          const isCurrentHoliday = isHoliday(date);
          const isCurrentBridge = isBridgeDay(date);
          
          row.push({
            content: `${dayNum}\n${dayAbbr}`,
            styles: {
              fillColor: isCurrentWeekend ? [219, 234, 254] : [245, 245, 245], // Fond bleu clair pour weekends
              fontStyle: isCurrentWeekend || isCurrentHoliday || isCurrentBridge ? 'bold' : 'normal',
              fontSize: 4,
              halign: 'center',
              textColor: (isCurrentHoliday || isCurrentBridge) ? [220, 38, 38] : isCurrentWeekend ? [29, 78, 216] : [100, 100, 100] // Rouge pour fériés/ponts, bleu pour weekends, gris sinon
            }
          });
        } else {
          row.push({
            content: '',
            styles: {
              fillColor: [245, 245, 245],
              fontSize: 6,
              halign: 'center'
            }
          });
        }
      }
      
      if (dayNum > daysInMonth) {
        // Jours inexistants dans ce mois
        periods.forEach(() => {
          row.push({ content: '', styles: { fillColor: [200, 200, 200] } });
        });
      } else {
        const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
        const dateStr = formatParisDate(date, 'yyyy-MM-dd');
        const dayStats = statsMap[dateStr];
        const isGrayed = isGrayedOut(date);
        
        periods.forEach(period => {
          if (!dayStats) {
            row.push({ 
              content: '', 
              styles: { fillColor: isGrayed ? [240, 240, 240] : [255, 255, 255] } 
            });
          } else {
            const periodStats = dayStats.periods[period as 'M' | 'AM' | 'S'];
            
            // Calculer les valeurs selon le type d'export
            let displayValue = 0;
            let displayCount = 0;
            
            if (exportType === 'availability') {
              displayValue = 100 - periodStats.percentage;
              displayCount = periodStats.total - periodStats.unavailable;
            } else {
              switch (exportType) {
                case 'primary':
                  displayCount = periodStats.primary;
                  displayValue = periodStats.total > 0 ? Math.round((periodStats.primary / periodStats.total) * 100) : 0;
                  break;
                case 'secondary':
                  displayCount = periodStats.secondary;
                  displayValue = periodStats.total > 0 ? Math.round((periodStats.secondary / periodStats.total) * 100) : 0;
                  break;
                default:
                  displayCount = periodStats.unavailable;
                  displayValue = periodStats.percentage;
              }
            }
            
            const color = getColorForPDF(displayValue, exportType === 'availability');
            const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
              ] : [255, 255, 255];
            };
            
            row.push({
              content: `${displayValue}%`,
              styles: {
                fillColor: hexToRgb(color),
                fontSize: 7,
                cellPadding: 0.5,
                halign: 'center',
                valign: 'middle'
              }
            });
          }
        });
      }
    });
    
    rows.push(row);
  }

  // Calculer la largeur optimale des colonnes
  const pageWidth = 297; // A4 paysage en mm
  const margins = 10; // marges totales
  const availableWidth = pageWidth - margins;
  const columnCount = headers.length;
  const columnWidth = Math.floor(availableWidth / columnCount);

  // Générer la table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 20,
    styles: {
      fontSize: 6,
      cellPadding: 0.3,
      lineWidth: 0.05,
      lineColor: [200, 200, 200],
      cellWidth: columnWidth > 10 ? 'auto' : columnWidth
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontSize: 6,
      halign: 'center',
      cellPadding: 0.5
    },
    columnStyles: {
      0: { 
        fillColor: [245, 245, 245],
        halign: 'center',
        cellWidth: 7 // Largeur adaptée pour les abréviations complètes
      }
    },
    didParseCell: function(data) {
      // Styliser toutes les colonnes "J" (jour)
      if (data.row.index >= 0 && headers[data.column.index] === 'J') {
        data.cell.styles.fillColor = [245, 245, 245];
        data.cell.styles.cellWidth = 7;
      }
    },
    margin: { left: 5, right: 5 },
    tableWidth: 'auto',
    showHead: 'firstPage'
  });

  // Ajouter la légende seulement si on a de la place
  const finalY = (doc as any).lastAutoTable.finalY;
  
  // Vérifier qu'on ne dépasse pas la page (A4 paysage = 210mm de hauteur)
  if (finalY < 190) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Légende:', 10, finalY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    const legendItems = exportType === 'availability' 
      ? [
          { color: '#10b981', label: '80-100%' },
          { color: '#facc15', label: '60-80%' },
          { color: '#fb923c', label: '40-60%' },
          { color: '#f87171', label: '20-40%' },
          { color: '#dc2626', label: '< 20%' }
        ]
      : [
          { color: '#d1fae5', label: '0%' },
          { color: '#a7f3d0', label: '< 20%' },
          { color: '#fef3c7', label: '20-40%' },
          { color: '#fed7aa', label: '40-60%' },
          { color: '#fecaca', label: '60-80%' },
          { color: '#fca5a5', label: '> 80%' }
        ];
    
    let xPos = 10;
    legendItems.forEach(item => {
      // Dessiner le carré de couleur
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      
      const rgb = hexToRgb(item.color);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(xPos, finalY + 7, 4, 4, 'F');
      
      // Ajouter le texte
      doc.text(item.label, xPos + 5, finalY + 10);
      xPos += 25;
    });
  }

  // Sauvegarder le PDF
  const fileName = `matrice_${exportType}_${formatParisDate(createParisDate(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};