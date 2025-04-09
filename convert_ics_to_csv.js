import fs from 'fs';

// Définition des créneaux horaires pour chaque type de garde
const shiftTimeSlots = {
  // Postes de Visites
  'ML': '07:00 - 12:59',
  'MC': '09:00 - 12:59',
  'AL': '13:00 - 19:59',
  'AC': '13:00 - 17:59',
  'NA': '18:00 - 22:59',
  'NC': '20:00 - 23:59',
  'NM': '20:00 - 01:59',
  'NL': '20:00 - 06:59',
  
  // Postes de Cenon
  'MM': '07:00 - 12:59',
  'CM': '09:00 - 12:59',
  'CT': '11:00 - 15:59',
  'CA': '13:00 - 17:59',
  'CS': '18:00 - 22:59',
  
  // Postes de Beychac et Caillau
  'HM': '09:00 - 12:59',
  'HA': '13:00 - 17:59',
  'HS': '18:00 - 22:59',
  
  // Postes de St André de Cubzac
  'SM': '07:00 - 12:59', // Simplifié, ne tient pas compte des différences weekend
  'SA': '13:00 - 17:59',
  'SS': '18:00 - 23:59', // Simplifié, ne tient pas compte des différences weekend
  
  // Postes de Créon
  'RM': '09:00 - 12:59',
  'RA': '13:00 - 17:59',
  'RS': '18:00 - 23:59', // Simplifié, ne tient pas compte des différences weekend
  
  // Autres codes potentiels (à compléter si nécessaire)
  'NZ': '20:00 - 06:59', // Supposé être une garde de nuit
  'NR': '20:00 - 06:59', // Supposé être une garde de nuit
};

// Fonction pour convertir une date du format YYYYMMDD au format DD-MM-YY
function formatDate(dateStr) {
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}-${month}-${year.substring(2)}`;
}

// Fonction principale pour convertir le fichier ICS en CSV
function convertIcsToCSV(inputFile, outputFile) {
  try {
    console.log(`Lecture du fichier: ${inputFile}`);
    // Vérifier si le fichier existe
    if (!fs.existsSync(inputFile)) {
      console.error(`Le fichier ${inputFile} n'existe pas!`);
      return;
    }
    
    // Lire le fichier ICS
    const icsContent = fs.readFileSync(inputFile, 'utf8');
    console.log(`Contenu du fichier lu (premiers 100 caractères): ${icsContent.substring(0, 100)}...`);
    
    // Initialiser le contenu CSV avec l'en-tête
    // Ajouter un BOM UTF-8 au début du fichier pour garantir que les applications reconnaissent l'encodage
    // Utiliser des virgules comme séparateurs pour une meilleure compatibilité
    let csvContent = '\uFEFF' + 'Date,Créneau,Type\n';
    
    // Extraire les événements
    const events = [];
    let currentEvent = null;
    
    // Parcourir chaque ligne du fichier ICS
    icsContent.split('\n').forEach(line => {
      line = line.trim();
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT') {
        if (currentEvent && currentEvent.date && currentEvent.summary) {
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (line.startsWith('DTSTART:')) {
          currentEvent.date = line.substring(8);
        } else if (line.startsWith('SUMMARY:')) {
          currentEvent.summary = line.substring(8).trim();
        }
      }
    });
    
    // Traiter chaque événement
    events.forEach(event => {
      const formattedDate = formatDate(event.date);
      const shiftCodes = event.summary.split(' ').filter(code => code.trim() !== '');
      
      // Créer une entrée CSV pour chaque code de garde
      shiftCodes.forEach(shiftCode => {
        if (shiftTimeSlots[shiftCode]) {
          csvContent += `${formattedDate},${shiftTimeSlots[shiftCode]},${shiftCode}\n`;
        } else {
          console.warn(`Code de garde inconnu: ${shiftCode}`);
          // Utiliser un créneau par défaut pour les codes inconnus
          csvContent += `${formattedDate},09:00 - 17:59,${shiftCode}\n`;
        }
      });
    });
    
    // Écrire le fichier CSV avec encodage UTF-8
    fs.writeFileSync(outputFile, csvContent, 'utf8');
    console.log(`Conversion réussie! Le fichier CSV a été créé: ${outputFile}`);
    
  } catch (error) {
    console.error('Erreur lors de la conversion:', error);
  }
}

// Fichiers d'entrée et de sortie
const inputFile = 'Dr HILAL Planning janvier mai 2025 (1).csv'; // Le fichier est nommé .csv mais c'est un ICS
const outputFile = 'Dr_HILAL_Planning_janvier_mai_2025.csv';

// Exécuter la conversion
convertIcsToCSV(inputFile, outputFile);
