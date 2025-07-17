import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isWeekend } from 'date-fns';
import { frLocale } from '../utils/dateLocale';
import JSZip from 'jszip';
import { getDaysArray, getMonthsInRange, isGrayedOut } from './dateUtils';
import { calculatePercentages } from './planningUtils';
import { isHoliday } from './holidayUtils';
import { formatParisDate, toParisTime } from './timezoneUtils';
import type { Selections, ShiftAssignment, PeriodSelection } from '../types/planning';
import type { User } from '../features/users/types';

// Configuration sera passée en paramètre depuis l'appelant

interface ExportPlanningOptions {
  userName: string;
  startDate: Date;
  endDate: Date;
  assignments: Record<string, ShiftAssignment>;
  desiderata?: Record<string, 'primary' | 'secondary' | null | PeriodSelection>;
  primaryLimit?: number;
  secondaryLimit?: number;
  showAssignmentsOnly?: boolean;
  showComments?: boolean;
  returnDocument?: boolean; // Si true, retourne le document au lieu de le télécharger
}

// Numéros pour la numérotation des commentaires
const commentNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

// Interface pour stocker les commentaires par page
interface PageComment {
  number: string;
  date: string;
  period: string;
  comment: string;
  type: 'primary' | 'secondary' | null;
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
  showComments = false,
  returnDocument = false
}: ExportPlanningOptions): jsPDF | void => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 10;

  const pageWidth = doc.internal.pageSize.width;
  
  // Transformer les desiderata pour correspondre au type Selections
  const transformedDesiderata: Selections = {};

  // Map pour stocker les commentaires avec leur numéro
  const commentMap = new Map<string, PageComment>();
  
  // Stocker les commentaires par mois pour affichage en bas de page
  const commentsByMonth = new Map<string, PageComment[]>();
  
  // Ordre des périodes pour le tri
  const periodOrder: Record<string, number> = { 'M': 1, 'AM': 2, 'S': 3 };
  
  // Si on a des commentaires, les extraire, trier et numéroter
  if (showComments && desiderata) {
    // D'abord, collecter tous les commentaires avec leurs métadonnées
    const commentsToSort: Array<{key: string, value: any, dateObj: Date, period: string}> = [];
    
    Object.entries(desiderata).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const valueObj = value as any;
        const comment = valueObj.comment;
        
        if (comment) {
          const parts = key.split('-');
          const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
          const period = parts[3];
          const dateObj = new Date(dateStr);
          
          commentsToSort.push({ key, value: valueObj, dateObj, period });
        }
      }
    });
    
    // Trier par date puis par période
    commentsToSort.sort((a, b) => {
      const dateCompare = a.dateObj.getTime() - b.dateObj.getTime();
      if (dateCompare !== 0) return dateCompare;
      return periodOrder[a.period] - periodOrder[b.period];
    });
    
    // Maintenant numéroter dans l'ordre chronologique
    commentsToSort.forEach((item, index) => {
      const monthKey = formatParisDate(item.dateObj, 'yyyy-MM');
      const periodName = item.period === 'M' ? 'Matin' : item.period === 'AM' ? 'Après-midi' : 'Soir';
      
      const pageComment: PageComment = {
        number: commentNumbers[index] || `${index + 1}`,
        date: formatParisDate(item.dateObj, 'dd/MM/yyyy', { locale: frLocale }),
        period: periodName,
        comment: item.value.comment,
        type: item.value.type
      };
      
      commentMap.set(item.key, pageComment);
      
      // Grouper par mois
      if (!commentsByMonth.has(monthKey)) {
        commentsByMonth.set(monthKey, []);
      }
      commentsByMonth.get(monthKey)!.push(pageComment);
    });
  }
  
  console.log(`Nombre de commentaires trouvés: ${commentMap.size}`);
  if (commentMap.size > 0) {
    console.log('Commentaires numérotés:', Array.from(commentMap.values()));
  }
  if (!showAssignmentsOnly && desiderata) {
    Object.entries(desiderata).forEach(([key, value]) => {
      // Extraire le type et le commentaire si l'entrée est un objet
      if (typeof value === 'object' && value !== null && 'type' in value) {
        // C'est un objet PeriodSelection
        transformedDesiderata[key] = {
          type: value.type,
          comment: value.comment
        };
      } else {
        // C'est une valeur directe (primary, secondary, null)
        transformedDesiderata[key] = {
          type: value as 'primary' | 'secondary' | null
        };
      }
    });
  }
  
  // Calculer les pourcentages si on affiche les desiderata
  const percentages = !showAssignmentsOnly ? calculatePercentages(transformedDesiderata, startDate, endDate) : null;

  // Titre du document
  const title = `Planning ${userName} - ${formatParisDate(startDate, 'dd/MM/yyyy')} au ${formatParisDate(endDate, 'dd/MM/yyyy')}`;
    
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
      monthTitle: formatParisDate(month, 'MMMM yyyy', { locale: frLocale }).toUpperCase(),
      monthKey: formatParisDate(month, 'yyyy-MM'),
      data: days.map(day => {
        const dateStr = formatParisDate(day, 'yyyy-MM-dd');
        const dayLabel = `${formatParisDate(day, 'd', { locale: frLocale })} ${formatParisDate(day, 'EEEEEE', { locale: frLocale }).toLowerCase()}`;
        const isGrayed = isGrayedOut(day);
        
        return {
          dayLabel,
          isGrayed,
          date: day, // Ajouter la date complète pour vérifier week-end/férié
          periods: ['M', 'AM', 'S'].map(period => {
            const cellKey = `${dateStr}-${period}`;
            const assignment = assignments[cellKey];
            const desideratum = !showAssignmentsOnly ? transformedDesiderata[cellKey] : null;
            
            return {
              assignment,
              desideratum,
              isGrayed,
              cellKey // Ajouter pour récupérer le commentaire
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

  // Définition des couleurs avec tuples explicites
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
      bg: [255, 249, 219] as [number, number, number], // Jaune clair (bg-yellow-100)
      text: [133, 77, 14] as [number, number, number],  // Texte jaune foncé (text-yellow-700)
      border: [0, 0, 0] as [number, number, number]     // Noir pour la bordure
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
  monthTables.forEach(({ monthTitle, monthKey, data }, monthIndex) => {
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
        fillColor: colors.header.bg as [number, number, number],
        textColor: colors.header.text as [number, number, number],
        cellPadding: 1
      },
      margin: { left: startX },
      tableWidth
    });

    // Corps du tableau
    autoTable(doc, {
      startY: startY + 8,
      head: [['Jour', 'M', 'AM', 'S']],
      body: data.map(({ dayLabel, isGrayed, date, periods }) => [
        { content: dayLabel, isGrayed, isDay: true, date },
        ...periods.map(p => ({
          content: p.assignment?.shiftType || '',
          assignment: p.assignment,
          desideratum: p.desideratum,
          isGrayed,
          cellKey: p.cellKey
        }))
      ]),
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1,
        lineColor: [0, 0, 0] as [number, number, number],
        lineWidth: 0.1,
        minCellHeight: 4
      },
      headStyles: {
        fillColor: colors.header.bg as [number, number, number],
        textColor: colors.header.text as [number, number, number],
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
            desideratum?: 'primary' | 'secondary' | null | { type: 'primary' | 'secondary' | null };
            isGrayed: boolean;
            isDay?: boolean;
          };
          
          if (!cellData) return;
          
          // Réinitialiser les styles de bordure par défaut
          data.cell.styles.lineWidth = 0.1;
          data.cell.styles.lineColor = [0, 0, 0] as [number, number, number];
          data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
          
          // Gérer différemment la colonne des jours
          if (cellData.isDay) {
            data.cell.text = [cellData.content];
            data.cell.styles.halign = 'left';
            
            // Vérifier si c'est un week-end ou jour férié
            const rowData = data.row.raw as any;
            if (rowData && rowData[0] && rowData[0].date) {
              const date = new Date(rowData[0].date);
              if (isWeekend(date) || isHoliday(date)) {
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.fontStyle = 'normal';
              }
            } else {
              data.cell.styles.fontStyle = 'normal';
            }
            
            if (cellData.isGrayed) {
              data.cell.styles.fillColor = colors.grayed.bg as [number, number, number];
              data.cell.styles.textColor = colors.grayed.text as [number, number, number];
            }
            return;
          }

          // Appliquer le style de base pour les jours grisés
          if (cellData.isGrayed) {
            data.cell.styles.fillColor = colors.grayed.bg as [number, number, number];
            data.cell.styles.textColor = colors.grayed.text as [number, number, number];
          }

          // Si on affiche les desiderata et qu'il y en a un
          if (!showAssignmentsOnly && cellData.desideratum) {
            // Afficher pour débogage
            console.log("Desideratum trouvé pour cellule:", cellData.desideratum);
            
          // Extraire le type et vérifier s'il y a un commentaire
          let desideratumType = null;
          let hasComment = false;
          
          if (typeof cellData.desideratum === 'object' && cellData.desideratum !== null) {
            // C'est un objet PeriodSelection
            // Utiliser as any pour éviter les erreurs TypeScript
            const desideratumObject = cellData.desideratum as any;
            desideratumType = desideratumObject.type;
            hasComment = Boolean(desideratumObject.comment);
          } else {
            // C'est une valeur directe
            desideratumType = cellData.desideratum;
          }
            
            console.log("Type de desideratum:", desideratumType, "Commentaire:", hasComment);
            
            // Vérifier d'abord si la cellule a un commentaire - priorité au style de commentaire
            if (hasComment) {
              // Récupérer le cellKey depuis les données de ligne
              const rowData = data.row.raw as any[];
              const cellKey = rowData[data.column.index]?.cellKey;
              const comment = cellKey ? commentMap.get(cellKey) : null;
              
              console.log("Cellule avec commentaire, cellKey:", cellKey);
              
              // Appliquer le style de commentaire (jaune)
              data.cell.styles.fillColor = colors.comment.bg;
              data.cell.styles.textColor = colors.comment.text;
              
              // Ajouter l'indicateur avec numéro et le type de garde
              const shiftType = cellData.assignment?.shiftType || '';
              if (comment) {
                data.cell.text = [shiftType ? `${shiftType} ${comment.number}` : `${comment.number}`];
              } else {
                // Fallback si on ne trouve pas le commentaire
                data.cell.text = [shiftType ? `${shiftType} *` : "*"];
              }
            }
            // Si pas de commentaire, mais il y a un desiderata
            else if (desideratumType === 'primary') {
              console.log("Coloration en primary");
              data.cell.styles.fillColor = colors.primary.bg;
              data.cell.styles.textColor = colors.primary.text;
              data.cell.text = [cellData.assignment?.shiftType || ''];
            } else if (desideratumType === 'secondary') {
              console.log("Coloration en secondary");
              data.cell.styles.fillColor = colors.secondary.bg;
              data.cell.styles.textColor = colors.secondary.text;
              data.cell.text = [cellData.assignment?.shiftType || ''];
            }
          } else {
            // Afficher le type de garde seulement si pas de desiderata
            data.cell.text = [cellData.content || (cellData.assignment?.shiftType || '')];
          }
          
          // Appliquer le style en gras
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: startX },
      tableWidth
    });

    startX += tableWidth + (monthIndex < months.length - 1 ? 0.2 : 0);
  });
  
  // Ajouter les commentaires sur une page séparée avec références
  const allComments = Array.from(commentMap.values());
  
  if (showComments && allComments.length > 0) {
    // Ajouter un saut de page
    doc.addPage();
    
    // Titre de la section commentaires
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Commentaires', margin, margin + 5);
    
    // Tableau des commentaires avec références
    autoTable(doc, {
      startY: margin + 10,
      head: [['Réf.', 'Date', 'Période', 'Commentaire']],
      body: allComments.map((comment) => [
        comment.number,
        comment.date,
        comment.period,
        comment.comment
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // Référence
        1: { cellWidth: 25 }, // Date
        2: { cellWidth: 25 }, // Période
        3: { cellWidth: 'auto' } // Commentaire
      },
      margin: { left: margin, right: margin }
    });
  }

  // Génération du fichier
  // Si on veut juste retourner le document sans le télécharger
  if (returnDocument) {
    return doc;
  }
  
  const prefix = showAssignmentsOnly ? 'Planning' : 'Planning_avec_desiderata';
  const fileName = `${prefix}_${userName.toUpperCase()}_${formatParisDate(startDate, 'yyyy-MM-dd')}.pdf`;
  
  try {
    console.log('Début de la génération du PDF...');
    
    // Générer le PDF avec différentes méthodes selon le navigateur
    let pdfOutput;
    try {
      // Essayer d'abord la méthode blob qui fonctionne sur la plupart des navigateurs modernes
      pdfOutput = doc.output('blob');
      console.log('PDF généré avec la méthode blob');
    } catch (e) {
      console.error('Erreur avec la méthode blob, tentative avec arraybuffer:', e);
      // Fallback pour les navigateurs qui ne supportent pas bien les blobs
      const rawOutput = doc.output();
      pdfOutput = new Blob([rawOutput], { type: 'application/pdf' });
    }
    
    // Créer l'URL pour le téléchargement
    const blobUrl = URL.createObjectURL(pdfOutput);
    console.log('URL Blob créée:', blobUrl.substring(0, 30) + '...');
    
    // Créer un élément de lien temporaire pour le téléchargement
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = fileName; // Spécifie que le fichier doit être téléchargé
    downloadLink.target = '_blank'; // Ouvre dans un nouvel onglet si le téléchargement direct échoue
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    console.log('Lien de téléchargement créé, tentative de clic...');
    
    // Déclencher le téléchargement
    downloadLink.click();
    
    // Nettoyer après un délai plus long pour s'assurer que le téléchargement a commencé
    setTimeout(() => {
      if (document.body.contains(downloadLink)) {
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobUrl);
      console.log('Nettoyage effectué');
    }, 2000); // Augmenté à 2 secondes pour donner plus de temps au navigateur
    
    console.log('Téléchargement PDF initié avec succès');
  } catch (error) {
    console.error('Erreur lors du téléchargement du PDF:', error);
    
    // Tentative de récupération en cas d'échec
    try {
      console.log('Tentative de récupération avec une méthode alternative...');
      // Méthode alternative pour les cas où la première approche échoue
      const dataUri = doc.output('datauristring');
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<iframe width='100%' height='100%' src='${dataUri}'></iframe>`);
        newWindow.document.title = fileName;
        console.log('PDF ouvert dans un nouvel onglet');
      } else {
        console.error('Impossible d\'ouvrir une nouvelle fenêtre, blocage de popup?');
        alert('Le téléchargement a échoué. Veuillez vérifier les paramètres de votre navigateur concernant les popups.');
      }
    } catch (fallbackError) {
      console.error('Échec de la méthode de récupération:', fallbackError);
      alert('Impossible de générer le PDF. Veuillez réessayer ou contacter le support.');
    }
  }
};

export const exportAllPlanningsToPDFZip = async (
  users: User[],
  desiderataData: Record<string, { selections: Record<string, any>; validatedAt?: string }>,
  startDate: Date,
  endDate: Date,
  primaryLimit?: number,
  secondaryLimit?: number
): Promise<void> => {
  console.log("Début exportAllPlanningsToPDFZip, nombre d'utilisateurs:", users.length);
  console.log("Format des données de desiderata:", Object.keys(desiderataData).length, "utilisateurs avec des données");

  const zip = new JSZip();
  // Créer le dossier avec le format "Desiderata_pdf_dateDebut"
  const folderName = `Desiderata_pdf_${formatParisDate(startDate, 'dd-MM-yyyy')}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  // Créer un PDF pour chaque utilisateur
  for (const user of users) {
    console.log(`Traitement de l'utilisateur: ${user.lastName} ${user.firstName}`);
    
    const userData = desiderataData[user.id];
    if (!userData?.selections) {
      console.log(`Aucune sélection trouvée pour l'utilisateur: ${user.id}`);
      continue;
    }

    console.log(`Nombre de sélections pour ${user.lastName}:`, Object.keys(userData.selections).length);
    
    // Déboguer les données reçues pour comprendre leur structure
    if (Object.keys(userData.selections).length > 0) {
      const firstKey = Object.keys(userData.selections)[0];
      console.log(`Exemple de sélection pour ${firstKey}:`, userData.selections[firstKey]);
      console.log(`Type de la sélection:`, typeof userData.selections[firstKey]);
    }
    
    // Pour le PDF en masse, nous voulons conserver les commentaires
    // Ne pas transformer les données mais les utiliser directement
    console.log(`Export PDF en masse avec commentaires pour ${user.lastName}`);

    // Utiliser exportPlanningToPDF avec les bonnes options pour chaque utilisateur
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 10;
    const pageWidth = doc.internal.pageSize.width;
    
    // Map pour stocker les commentaires avec leur numéro
    const commentMap = new Map<string, PageComment>();
    
    // Stocker les commentaires par mois pour affichage en bas de page
    const commentsByMonth = new Map<string, PageComment[]>();
    
    // Transformer les données pour calculer les pourcentages
    const transformedSelections: Selections = {};
    Object.entries(userData.selections).forEach(([key, value]) => {
      // Extraire le type, qu'il soit une valeur directe ou une propriété d'un objet
      let type = null;
      if (typeof value === 'object' && value !== null && 'type' in value) {
        type = value.type;
      } else {
        type = value;
      }
      
      // Ajouter à la sélection transformée
      if (type === 'primary' || type === 'secondary' || type === null) {
        transformedSelections[key] = { 
          type: type as 'primary' | 'secondary' | null 
        };
      }
    });
    
    // Calculer les pourcentages
    const percentages = calculatePercentages(transformedSelections, startDate, endDate);

    // Titre du document
    const title = `Desiderata ${user.lastName} ${user.firstName} - ${formatParisDate(startDate, 'dd/MM/yyyy')} au ${formatParisDate(endDate, 'dd/MM/yyyy')}`;
    doc.setFontSize(11);
    doc.text(title, margin, margin);

    // Afficher les pourcentages si les limites sont définies
    if (primaryLimit !== undefined && secondaryLimit !== undefined) {
      doc.setFontSize(9);
      
      const primaryText = `Primaire: ${percentages.primary.toFixed(1)}% / ${primaryLimit}%`;
      const secondaryText = `Secondaire: ${percentages.secondary.toFixed(1)}% / ${secondaryLimit}%`;
      
      // Ajouter des points colorés
      doc.setFillColor(255, 205, 210); // bg-red-100
      doc.circle(margin, margin + 5, 1.5, 'F');
      doc.setFillColor(219, 234, 254); // bg-blue-100
      doc.circle(margin + 60, margin + 5, 1.5, 'F');
      
      // Texte des pourcentages
      doc.setTextColor(percentages.primary > primaryLimit ? 220 : 75, 85, 99);
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
        monthTitle: formatParisDate(month, 'MMMM yyyy', { locale: frLocale }).toUpperCase(),
        monthKey: formatParisDate(month, 'yyyy-MM'),
        data: days.map(day => {
          const dateStr = formatParisDate(day, 'yyyy-MM-dd');
          const dayLabel = `${formatParisDate(day, 'd', { locale: frLocale })} ${formatParisDate(day, 'EEEEEE', { locale: frLocale }).toLowerCase()}`;
          const isGrayed = isGrayedOut(day);
          
          return {
            dayLabel,
            isGrayed,
            date: day, // Ajouter la date complète pour vérifier week-end/férié
            periods: ['M', 'AM', 'S'].map(period => {
              const cellKey = `${dateStr}-${period}`;
              // Récupérer l'objet complet pour pouvoir accéder au commentaire
              const value = userData.selections[cellKey];
              
              // Créer un objet avec toutes les informations nécessaires
              const cellInfo = {
                desideratum: null as 'primary' | 'secondary' | null,
                hasComment: false,
                comment: ''
              };
              
              // Extraire le type et le commentaire
              if (typeof value === 'object' && value !== null) {
                if ('type' in value) {
                  cellInfo.desideratum = value.type;
                }
                if ('comment' in value && value.comment) {
                  cellInfo.hasComment = true;
                  cellInfo.comment = value.comment;
                }
              } else {
                cellInfo.desideratum = value as 'primary' | 'secondary' | null;
              }
              
              return {
                assignment: undefined,
                desideratum: cellInfo.desideratum,
                hasComment: cellInfo.hasComment,
                comment: cellInfo.comment,
                isGrayed,
                cellKey // Ajouter pour récupérer le commentaire
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
    const startY = margin + (primaryLimit !== undefined && secondaryLimit !== undefined ? 12 : 8);
    let startX = margin;

    // Définition des couleurs avec tuples explicites
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

    // Ordre des périodes pour le tri
    const periodOrder: Record<string, number> = { 'M': 1, 'AM': 2, 'S': 3 };
    
    // Créer la map des commentaires numérotés en ordre chronologique
    // D'abord, collecter tous les commentaires avec leurs métadonnées
    const commentsToSort: Array<{key: string, value: any, dateObj: Date, period: string}> = [];
    
    Object.entries(userData.selections).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && value.comment) {
        const parts = key.split('-');
        const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
        const period = parts[3];
        const dateObj = new Date(dateStr);
        
        commentsToSort.push({ key, value, dateObj, period });
      }
    });
    
    // Trier par date puis par période
    commentsToSort.sort((a, b) => {
      const dateCompare = a.dateObj.getTime() - b.dateObj.getTime();
      if (dateCompare !== 0) return dateCompare;
      return periodOrder[a.period] - periodOrder[b.period];
    });
    
    // Maintenant numéroter dans l'ordre chronologique
    commentsToSort.forEach((item, index) => {
      const monthKey = formatParisDate(item.dateObj, 'yyyy-MM');
      const periodName = item.period === 'M' ? 'Matin' : item.period === 'AM' ? 'Après-midi' : 'Soir';
      
      const pageComment: PageComment = {
        number: commentNumbers[index] || `${index + 1}`,
        date: formatParisDate(item.dateObj, 'dd/MM/yyyy', { locale: frLocale }),
        period: periodName,
        comment: item.value.comment,
        type: item.value.type
      };
      
      commentMap.set(item.key, pageComment);
      
      // Grouper par mois
      if (!commentsByMonth.has(monthKey)) {
        commentsByMonth.set(monthKey, []);
      }
      commentsByMonth.get(monthKey)!.push(pageComment);
    });
    
    // Génération des tableaux pour chaque mois
    monthTables.forEach(({ monthTitle, monthKey, data }, monthIndex) => {
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
          fillColor: colors.header.bg as [number, number, number],
          textColor: colors.header.text as [number, number, number],
          cellPadding: 1
        },
        margin: { left: startX },
        tableWidth
      });

      // Corps du tableau
      autoTable(doc, {
        startY: startY + 8,
        head: [['Jour', 'M', 'AM', 'S']],
        body: data.map(({ dayLabel, isGrayed, date, periods }) => [
          { content: dayLabel, isGrayed, isDay: true, date },
          ...periods.map(p => ({
            content: '',
            assignment: p.assignment,
            desideratum: p.desideratum,
            isGrayed,
            hasComment: p.hasComment,
            cellKey: p.cellKey
          }))
        ]),
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1,
          lineColor: [0, 0, 0] as [number, number, number],
          lineWidth: 0.1,
          minCellHeight: 4
        },
        headStyles: {
          fillColor: colors.header.bg as [number, number, number],
          textColor: colors.header.text as [number, number, number],
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
              desideratum?: 'primary' | 'secondary' | null;
              isGrayed: boolean;
              isDay?: boolean;
            };
            
            if (!cellData) return;
            
            // Réinitialiser les styles de bordure par défaut
            data.cell.styles.lineWidth = 0.1;
            data.cell.styles.lineColor = [0, 0, 0] as [number, number, number];
            data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
            
            // Gérer différemment la colonne des jours
            if (cellData.isDay) {
              data.cell.text = [cellData.content];
              data.cell.styles.halign = 'left';
              
              // Vérifier si c'est un week-end ou jour férié
              const rowData = data.row.raw as any;
              if (rowData && rowData[0] && rowData[0].date) {
                const date = new Date(rowData[0].date);
                if (isWeekend(date) || isHoliday(date)) {
                  data.cell.styles.fontStyle = 'bold';
                } else {
                  data.cell.styles.fontStyle = 'normal';
                }
              } else {
                data.cell.styles.fontStyle = 'normal';
              }
              
              if (cellData.isGrayed) {
                data.cell.styles.fillColor = colors.grayed.bg as [number, number, number];
                data.cell.styles.textColor = colors.grayed.text as [number, number, number];
              }
              return;
            }

            // Appliquer le style de base pour les jours grisés
            if (cellData.isGrayed) {
              data.cell.styles.fillColor = colors.grayed.bg as [number, number, number];
              data.cell.styles.textColor = colors.grayed.text as [number, number, number];
            }

            // Vérifier s'il y a des commentaires
            const hasComment = (cellData as any).hasComment;
            const desideratumType = cellData.desideratum;
            
            // Vérifier d'abord si la cellule a un commentaire (priorité au commentaire)
            if (hasComment) {
              // Récupérer le cellKey depuis les données de ligne
              const rowData = data.row.raw as any[];
              const cellKey = rowData[data.column.index]?.cellKey;
              const comment = cellKey ? commentMap.get(cellKey) : null;
              
              // Appliquer le style de commentaire (jaune)
              data.cell.styles.fillColor = colors.comment.bg as [number, number, number];
              data.cell.styles.textColor = colors.comment.text as [number, number, number];
              
              // Ajouter l'indicateur avec numéro et le type de garde
              const shiftType = cellData.assignment?.shiftType || '';
              if (comment) {
                data.cell.text = [shiftType ? `${shiftType} ${comment.number}` : `${comment.number}`];
              } else {
                // Fallback si on ne trouve pas le commentaire
                data.cell.text = [shiftType ? `${shiftType} *` : "*"];
              }
            }
            // Si pas de commentaire, mais il y a un desideratum
            else if (desideratumType) {
              if (desideratumType === 'primary') {
                data.cell.styles.fillColor = colors.primary.bg as [number, number, number];
                data.cell.styles.textColor = colors.primary.text as [number, number, number];
                // Ajouter la lettre "P" pour primaire
                data.cell.text = [cellData.assignment?.shiftType || ''];
              } else if (desideratumType === 'secondary') {
                data.cell.styles.fillColor = colors.secondary.bg as [number, number, number];
                data.cell.styles.textColor = colors.secondary.text as [number, number, number];
                // Ajouter la lettre "S" pour secondaire
                data.cell.text = [cellData.assignment?.shiftType || ''];
              } else {
                data.cell.text = [cellData.content || ''];
              }
            } else {
              // Cellule sans desideratum
              data.cell.text = [cellData.content || ''];
            }
            
            // Appliquer le style en gras
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: startX },
        tableWidth
      });

      startX += tableWidth + (monthIndex < months.length - 1 ? 0.2 : 0);
    });

    // Ajouter les commentaires sur une page séparée avec références
    const allComments = Array.from(commentMap.values());
    
    if (allComments.length > 0) {
      console.log(`${allComments.length} commentaires trouvés pour ${user.lastName}`);
      
      // Ajouter un saut de page
      doc.addPage();
      
      // Titre de la section commentaires
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Commentaires', margin, margin + 5);
      
      // Tableau des commentaires avec références
      autoTable(doc, {
        startY: margin + 10,
        head: [['Réf.', 'Date', 'Période', 'Commentaire']],
        body: allComments.map((comment) => [
          comment.number,
          comment.date,
          comment.period,
          comment.comment
        ]),
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' }, // Référence
          1: { cellWidth: 25 }, // Date
          2: { cellWidth: 25 }, // Période
          3: { cellWidth: 'auto' } // Commentaire
        },
        margin: { left: margin, right: margin }
      });
    }

    // Ajouter le PDF au dossier zip
    folder.file(
      `${user.lastName.toUpperCase()}_${formatParisDate(startDate, 'dd-MM-yyyy')}.pdf`,
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
