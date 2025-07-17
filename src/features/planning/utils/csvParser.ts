import { ShiftAssignment } from '../../../types/planning';
import { formatParisDate } from '@/utils/timezoneUtils';
import { format } from 'date-fns';

/**
 * Détecte le séparateur utilisé dans un fichier CSV
 */
export const detectSeparator = (line: string): string => {
  return line.includes(';') ? ';' : ',';
};

/**
 * Normalise les en-têtes pour gérer les variations d'encodage et de casse
 */
export const normalizeHeaders = (headers: string[]): string[] => {
  return headers.map(h => {
    const normalized = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Fonction pour détecter si un en-tête ressemble à "Créneau" même avec des problèmes d'encodage
    const isCreneau = (header: string) => {
      // Vérifier les variantes exactes
      if (normalized === 'Creneau' || 
          h === 'CrÃ©neau' || 
          h === 'Créneau' || 
          h.toLowerCase() === 'creneau' || 
          h.toLowerCase() === 'créneau') {
        return true;
      }
      
      // Vérifier si le texte commence par "Cr" et contient "neau"
      if (h.toLowerCase().startsWith('cr') && h.toLowerCase().includes('neau')) {
        return true;
      }
      
      // Vérifier si le texte ressemble à "Créneau" avec un caractère corrompu au milieu
      if (h.length >= 7 && h.toLowerCase().startsWith('cr') && h.toLowerCase().endsWith('neau')) {
        return true;
      }
      
      // Vérifier les variantes avec des caractères spéciaux mal encodés
      const variants = ['Cr�neau', 'Cr?neau', 'Cr@neau', 'Cr#neau', 'Cr$neau', 'Cr%neau', 'Cr&neau'];
      return variants.some(variant => h.toLowerCase() === variant.toLowerCase());
    };
    
    // Normaliser les variantes de "Créneau"
    if (isCreneau(h)) {
      console.log(`Reconnu "${h}" comme "Créneau"`);
      return 'Créneau';
    }
    
    // Normaliser Date et Type (insensible à la casse)
    if (normalized.toLowerCase() === 'date') {
      return 'Date';
    }
    if (normalized.toLowerCase() === 'type') {
      return 'Type';
    }
    
    return h;
  });
};

/**
 * Parse un fichier CSV et retourne les assignments
 */
export const parseCSVFile = async (file: File): Promise<Record<string, ShiftAssignment>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
      
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        // Nettoyer les lignes et gérer les différents encodages et types de sauts de ligne
        const lines = text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line);
        
        // Détecter automatiquement le séparateur (virgule ou point-virgule)
        const firstLine = lines[0];
        const separator = detectSeparator(firstLine);
        
        console.log(`Séparateur détecté: "${separator}"`);
        
        // Récupérer les en-têtes originaux
        const originalHeaders = firstLine.split(separator).map(h => h.trim());
        
        // Afficher les en-têtes pour le débogage
        console.log('En-têtes originaux:', originalHeaders);
        
        // Normaliser les en-têtes
        const normalizedHeaders = normalizeHeaders(originalHeaders);
        
        console.log('En-têtes normalisés:', normalizedHeaders);
        
        // Vérifier la présence des en-têtes requis
        const requiredHeaders = ['Date', 'Créneau', 'Type'];
        const missingHeaders = requiredHeaders.filter(required => 
          !normalizedHeaders.some(h => h === required)
        );
        
        if (missingHeaders.length > 0) {
          throw new Error(
            `Format de fichier CSV invalide. L'en-tête doit contenir : Date, Créneau, Type.\n` +
            `En-têtes trouvés : ${originalHeaders.join(', ')}\n` +
            `En-têtes manquants : ${missingHeaders.join(', ')}`
          );
        }
        
        // Trouver les indices des colonnes requises
        const dateIndex = normalizedHeaders.findIndex(h => h === 'Date');
        const creneauIndex = normalizedHeaders.findIndex(h => h === 'Créneau');
        const typeIndex = normalizedHeaders.findIndex(h => h === 'Type');

        // Parser les lignes
        const assignments: Record<string, ShiftAssignment> = {};
        
        for (let i = 1; i < lines.length; i++) {
          const fields = lines[i].split(separator).map(field => field.trim());
          const dateStr = fields[dateIndex];
          const timeSlot = fields[creneauIndex];
          const shiftType = fields[typeIndex];
          
          if (!dateStr || !timeSlot || !shiftType) {
            throw new Error(`Ligne ${i + 1} incomplète ou mal formatée`);
          }
          
          try {
            // Valider la date (format JJ-MM-AA)
            const dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
              throw new Error(`Format de date invalide à la ligne ${i + 1}: ${dateStr}. Format attendu: JJ-MM-AA`);
            }
            
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Les mois commencent à 0 en JavaScript
            const year = parseInt(`20${dateParts[2]}`, 10); // Ajouter 20 pour avoir l'année complète
            
            const date = new Date(year, month, day);
            
            if (isNaN(date.getTime())) {
              throw new Error(`Date invalide à la ligne ${i + 1}: ${dateStr}. Format attendu: JJ-MM-AA`);
            }

            // Extraire et valider les heures du créneau
            const [startStr, endStr] = timeSlot.split(' - ');
            if (!startStr || !endStr) {
              throw new Error(`Format de créneau horaire invalide à la ligne ${i + 1}. Format attendu: HH:MM - HH:MM`);
            }

            // Convertir les heures en minutes depuis minuit
            const getMinutes = (timeStr: string) => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              return hours * 60 + minutes;
            };

            const startMinutes = getMinutes(startStr);
            let endMinutes = getMinutes(endStr);

            // Ajuster la fin si elle est avant le début (cas des gardes de nuit)
            if (endMinutes < startMinutes) endMinutes += 24 * 60;

            // Définir les tranches horaires en minutes
            const MORNING_START = 7 * 60;     // 07:00
            const AFTERNOON_START = 13 * 60;   // 13:00
            const EVENING_START = 20 * 60;     // 20:00
            const DAY_END = 24 * 60;          // 24:00

            // Calculer le temps passé dans chaque période
            const calculateOverlap = (start: number, end: number) => {
              return Math.max(0, Math.min(end, endMinutes) - Math.max(start, startMinutes));
            };

            const morningMinutes = calculateOverlap(MORNING_START, AFTERNOON_START);
            const afternoonMinutes = calculateOverlap(AFTERNOON_START, EVENING_START);
            const eveningMinutes = calculateOverlap(EVENING_START, DAY_END) + 
                                 calculateOverlap(0, MORNING_START);

            // Déterminer la période avec le plus de temps
            let period: 'M' | 'AM' | 'S';
            if (eveningMinutes >= morningMinutes && eveningMinutes >= afternoonMinutes) {
              period = 'S';
            } else if (afternoonMinutes >= morningMinutes) {
              period = 'AM';
            } else {
              period = 'M';
            }

            // Créer la clé unique pour cette affectation
            const formattedDate = formatParisDate(date, 'yyyy-MM-dd');
            const key = `${formattedDate}-${period}`;
            
            assignments[key] = {
              type: period,
              date: formattedDate,
              timeSlot,
              shiftType,
              status: 'active' // Statut par défaut, sera mis à jour lors de l'import
            };
          } catch (err: any) {
            throw new Error(`Erreur à la ligne ${i + 1}: ${err.message}`);
          }
        }
        
        resolve(assignments);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
    
    // Essayer différents encodages
    const encodings = ['UTF-8', 'windows-1252', 'ISO-8859-1', 'ISO-8859-15'];
    let encodingIndex = 0;
    
    // Fonction pour essayer le prochain encodage
    const tryNextEncoding = () => {
      if (encodingIndex >= encodings.length) {
        console.warn("Tous les encodages ont échoué, utilisation de UTF-8 par défaut");
        reader.readAsText(file, 'UTF-8');
        return;
      }
      
      const encoding = encodings[encodingIndex++];
      console.log(`Tentative de lecture avec l'encodage: ${encoding}`);
      
      try {
        // Configurer un gestionnaire d'événement temporaire pour vérifier l'encodage
        const checkEncoding = (e: ProgressEvent<FileReader>) => {
          // Supprimer le gestionnaire après utilisation
          reader.removeEventListener('load', checkEncoding);
          
          const text = e.target?.result as string;
          
          // Vérifier si le texte contient des caractères mal encodés typiques
          if (text.includes('�') || text.includes('Ã©') || text.includes('Ã¨') || text.includes('Ã§')) {
            console.warn(`Caractères mal encodés détectés avec ${encoding}, essai avec l'encodage suivant`);
            tryNextEncoding();
          }
        };
        
        // Ajouter le gestionnaire temporaire avant le gestionnaire principal
        reader.addEventListener('load', checkEncoding);
        
        // Lire le fichier avec l'encodage actuel
        reader.readAsText(file, encoding);
      } catch (error) {
        console.warn(`Échec de lecture avec ${encoding}, tentative avec l'encodage suivant`, error);
        tryNextEncoding();
      }
    };
    
    // Commencer avec le premier encodage
    tryNextEncoding();
  });
};
