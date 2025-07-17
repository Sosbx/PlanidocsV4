import { parseCSVFile } from './csvParser';
import { formatDateCapitalized, DATE_FORMATS, frLocale } from '../../../utils/dates';

/**
 * Détecte la plage de dates à partir des fichiers CSV
 */
/**
 * Détecte la plage de dates à partir des fichiers CSV
 * Considère tous les fichiers ensemble pour trouver la plage globale
 * couvrant du premier jour de garde (tous utilisateurs confondus) 
 * au dernier jour de garde (tous utilisateurs confondus)
 */
export const detectDateRangeFromFiles = async (files: File[]): Promise<{
  startDate: Date;
  endDate: Date;
  allDates: Date[];
  failedFiles: { file: File; reason: string }[];
}> => {
  const allDates: Date[] = [];
  const failedFiles: { file: File; reason: string }[] = [];
  
  // Étape 1: Collecter toutes les dates de tous les fichiers dans un seul tableau
  for (const file of files) {
    try {
      const assignments = await parseCSVFile(file);
      
      // Vérifier si des dates ont été extraites
      let fileHasDates = false;
      
      // Extraire toutes les dates des assignments pour ce fichier
      Object.values(assignments).forEach(assignment => {
        if (assignment.date && typeof assignment.date === 'string') {
          const date = new Date(assignment.date);
          // S'assurer que la date est valide avant de l'ajouter
          if (!isNaN(date.getTime())) {
            allDates.push(date);
            fileHasDates = true;
          }
        }
      });
      
      // Si aucune date n'a été extraite du fichier, le considérer comme échoué
      if (!fileHasDates) {
        failedFiles.push({
          file,
          reason: 'Aucune date valide trouvée dans ce fichier'
        });
      }
    } catch (error) {
      console.warn(`Erreur lors de l'analyse du fichier ${file.name}:`, error);
      failedFiles.push({
        file,
        reason: error instanceof Error ? error.message : String(error)
      });
      // Continuer avec les autres fichiers
    }
  }
  
  if (allDates.length === 0) {
    throw new Error('Aucune date valide trouvée dans les fichiers. Vérifiez le format des fichiers CSV.');
  }
  
  // Étape 2: Trier toutes les dates collectées globalement
  allDates.sort((a, b) => a.getTime() - b.getTime());
  
  console.log(`Dates détectées: ${allDates.length} dates du ${allDates[0].toLocaleDateString()} au ${allDates[allDates.length - 1].toLocaleDateString()}`);
  
  // Étape 3: Déterminer la plage globale à partir des dates triées
  // Utiliser directement les dates exactes des gardes (sans les étendre aux mois entiers)
  // Première date de garde exacte (parmi tous les fichiers)
  const startDate = new Date(allDates[0]);
  
  // Dernière date de garde exacte (parmi tous les fichiers)
  const endDate = new Date(allDates[allDates.length - 1]);
  
  console.log(`Plage de dates calculée: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  
  return { startDate, endDate, allDates, failedFiles };
};

/**
 * Génère un nom pour la période basé sur les dates exactes
 */
export const generatePeriodName = (startDate: Date, endDate: Date): string => {
  // Formatter les dates au format jour/mois/année
  const formattedStartDate = formatDateCapitalized(startDate, DATE_FORMATS.SHORT_DATE_YEAR);
  const formattedEndDate = formatDateCapitalized(endDate, DATE_FORMATS.SHORT_DATE_YEAR);
  
  // Utiliser le format français pour les mois
  const startMonth = formatDateCapitalized(startDate, 'MMMM');
  const endMonth = formatDateCapitalized(endDate, 'MMMM');
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  let periodName = "";
  
  if (startYear === endYear) {
    if (startDate.getMonth() === endDate.getMonth()) {
      // Même mois, même année
      periodName = `${startMonth} ${startYear}`;
    } else {
      // Mois différents, même année
      periodName = `${startMonth}-${endMonth} ${startYear}`;
    }
  } else {
    // Années différentes
    periodName = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }
  
  // Ajouter les dates exactes
  periodName += ` (${formattedStartDate} - ${formattedEndDate})`;
  
  return periodName;
};
