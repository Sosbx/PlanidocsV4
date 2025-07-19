import { formatParisDate, parseParisDate, toParisTime, addDaysParis } from '../utils/timezoneUtils';
import { collection, getDocs } from '../lib/firebase/exports/firestore';
import { db } from '../lib/firebase/config';
import { getCollectionName, COLLECTIONS } from '../utils/collectionUtils';
import { batchLoadUsersPlannings } from '../lib/firebase/planning/batchOperations';
import type { User } from '../types/users';
import * as ExcelJS from 'exceljs';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { isHoliday, isBridgeDay } from '../utils/holidayUtils';

// Mapping des types de gardes vers les codes d'astreinte pour Rive Droite
const SHIFT_TO_ASTREINTE_MAP_RD: Record<string, string> = {
  // Gardes toujours en astreinte
  'NL': 'NL',  // Nuit longue
  'NM': 'NM',  // Nuit moyenne
  'NC': 'NC',  // Nuit courte
  'CS': 'CS',  // Consultation soir
  
  // Gardes en astreinte uniquement weekends et jours fériés
  'RS': 'RS',  // Réserve soir
  'RM': 'RM',  // Réserve matin
  'RA': 'RA',  // Réserve après-midi
  'RMRA': 'RMRA',  // Réserve matin et après-midi
  'SM': 'SM',  // S matin
  'SA': 'SA',  // S après-midi
  'SS': 'SS',  // S soir
  'HS': 'HS',  // H soir
  'SMSA': 'SMSA',  // S matin et après-midi
};

// Mapping des types de gardes vers les codes d'astreinte pour Rive Gauche
const SHIFT_TO_ASTREINTE_MAP_RG: Record<string, string> = {
  'NL': 'NL',  // Nuit longue
  'NM': 'NM',  // Nuit moyenne
  'NZ': 'NZ',  // Nuit Z
  'BS': 'BS',  // B soir
  'CS': 'CS',  // Consultation soir
  'NC': 'NC',  // Nuit courte
  'BZ': 'BZ',  // B Z
  'ES': 'ES',  // E soir
  'IS': 'IS',  // I soir
  'AS': 'AS',  // A soir
};

// Types de gardes qui couvrent les deux créneaux (00:00-08:00 et 20:00-24:00)
const FULL_NIGHT_SHIFTS = ['NL', 'NM'];

// Types d'astreintes par association
const ASTREINTE_TYPES_RD = ['NL', 'NM', 'NC', 'CS', 'RS', 'RM', 'RA', 'RMRA', 'SM', 'SA', 'SS', 'HS', 'SMSA'];
const ASTREINTE_TYPES_RG = ['NL', 'NM', 'NZ', 'BS', 'CS', 'NC', 'BZ', 'ES', 'IS', 'AS'];

// Groupes de postes pour RD (avec séparation)
const ASTREINTE_GROUPS_RD = [
  ['NL'],
  ['NM'],
  ['NC'],
  ['CS', 'RS', 'SS', 'HS'],
  ['SM', 'SMSA', 'RM', 'RA', 'RMRA', 'SA']
];

// Groupes de postes pour RG (avec séparation)
const ASTREINTE_GROUPS_RG = [
  ['NL'],
  ['NM'],
  ['NC'],
  ['NZ'],
  ['CS'],
  ['BS', 'BZ'],
  ['ES', 'IS', 'AS']
];

// Gardes RD uniquement pour weekends et jours fériés
const WEEKEND_ONLY_SHIFTS_RD = ['RM', 'RA', 'RMRA', 'SM', 'SA', 'SMSA'];

// Gardes de jour (08:00-20:00) pour weekends et jours fériés
const DAY_SHIFTS_RD = ['SM', 'SA', 'RM', 'RA', 'RMRA', 'SMSA'];

interface AstreinteAssignment {
  date: string;
  userName: string;
  userId: string;
  shiftType: string;
  astreinteCode: string;
  timeSlot: '00:00-08:00' | '08:00-20:00' | '20:00-24:00';
}

// Fonction pour détecter les doublons dans une ligne
function findDuplicatesInRow(rowData: any[]): Set<string> {
  const duplicates = new Set<string>();
  const nameCount = new Map<string, number>();
  
  // Commencer à partir de la colonne 3 (index 2) car les 2 premières sont date et heure
  for (let i = 2; i < rowData.length; i++) {
    const value = rowData[i];
    if (value && typeof value === 'string' && value.trim() !== '') {
      const name = value.trim().toUpperCase();
      nameCount.set(name, (nameCount.get(name) || 0) + 1);
    }
  }
  
  // Identifier les noms qui apparaissent plus d'une fois
  nameCount.forEach((count, name) => {
    if (count > 1) {
      duplicates.add(name);
    }
  });
  
  return duplicates;
}

// Fonction pour appliquer le style de base à une ligne
function applyRowStyle(row: ExcelJS.Row, hasBackground: boolean, isOutOfPeriod: boolean = false): void {
  row.eachCell((cell) => {
    if (hasBackground) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }  // Gris très clair
      };
    }
    cell.font = { 
      size: 9,
      name: 'Arial',
      bold: true,
      color: isOutOfPeriod ? { argb: 'FF808080' } : undefined  // Gris si hors période
    };
  });
}

// Fonction pour appliquer le formatage rouge aux doublons
function applyDuplicateFormatting(row: ExcelJS.Row, rowData: any[], duplicates: Set<string>, hasBackground: boolean): void {
  // Parcourir toutes les cellules à partir de la colonne 3
  for (let i = 3; i <= rowData.length; i++) {
    const cellValue = rowData[i - 1];
    if (cellValue && typeof cellValue === 'string' && cellValue.trim() !== '') {
      const name = cellValue.trim().toUpperCase();
      if (duplicates.has(name)) {
        const cell = row.getCell(i);
        // Conserver le fond existant si nécessaire
        if (hasBackground) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }  // Gris très clair
          };
        }
        // Appliquer la police rouge et gras
        cell.font = {
          size: 9,
          name: 'Arial',
          bold: true,
          color: { argb: 'FFFF0000' }  // Rouge
        };
      }
    }
  }
}

export const exportPlanningToAstreinte = async (
  startDate: Date,
  endDate: Date,
  associationId: string,
  _isMonthlyExport: boolean = false
): Promise<void> => {
  try {
    
    // 1. Récupérer tous les utilisateurs
    const usersSnapshot = await getDocs(
      collection(db, getCollectionName(COLLECTIONS.USERS, associationId))
    );
    const users = new Map<string, User>();
    const userIds: string[] = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as User;
      users.set(doc.id, { ...userData, id: doc.id });
      userIds.push(doc.id);
    });

    // 2. Récupérer tous les plannings générés en utilisant la même méthode que la vue globale
    // Pour capturer les gardes de nuit qui commencent la veille, on étend la période de recherche
    const searchStartDate = addDaysParis(startDate, -1);
    
    const plannings = await batchLoadUsersPlannings({
      userIds,
      includeArchived: true, // Inclure les archives car les données peuvent être archivées
      startDate: searchStartDate,
      endDate,
      associationId
    });
    
    
    // Si aucune période trouvée, essayer de récupérer toutes les périodes sans filtre de date
    if (Object.keys(plannings).length === 0) {
      await batchLoadUsersPlannings({
        userIds,
        includeArchived: true,
        associationId
      });
    }
    
    // Sélectionner le bon mapping selon l'association
    const SHIFT_TO_ASTREINTE_MAP = associationId === 'RG' ? SHIFT_TO_ASTREINTE_MAP_RG : SHIFT_TO_ASTREINTE_MAP_RD;
    
    let astreinteCount = 0;
    let astreinteAssignments: AstreinteAssignment[] = [];
    
    // Parcourir toutes les périodes
    Object.entries(plannings).forEach(([_periodId, periodPlannings]) => {
      
      // Parcourir tous les utilisateurs de cette période
      Object.entries(periodPlannings).forEach(([userId, userPlanning]) => {
        const user = users.get(userId);
        if (!user || !userPlanning.assignments) return;
        
        // Parcourir toutes les assignments de cet utilisateur
        Object.entries(userPlanning.assignments).forEach(([_key, assignment]) => {
          if (!assignment || !assignment.date || !assignment.shiftType) return;
          
          
          // Gérer différents formats de date
          let assignmentDate: Date;
          if (typeof assignment.date === 'string') {
            // Si c'est au format YYYY-MM-DD, utiliser parseParisDate
            if (assignment.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
              assignmentDate = parseParisDate(assignment.date);
            } else {
              // Autre format de string
              assignmentDate = toParisTime(assignment.date);
            }
          } else if (typeof assignment.date === 'object' && assignment.date !== null && 'getTime' in assignment.date) {
            // Déjà une Date, s'assurer qu'elle est en temps Paris
            assignmentDate = toParisTime(assignment.date);
          } else {
            // Si c'est un timestamp Firebase ou autre
            assignmentDate = toParisTime(assignment.date);
          }
          
          // Vérifier si la date est dans notre période
          const assignmentDateStr = formatParisDate(assignmentDate, 'yyyy-MM-dd');
          const startDateStr = formatParisDate(startDate, 'yyyy-MM-dd');
          const endDateStr = formatParisDate(endDate, 'yyyy-MM-dd');
          
          // Pour les gardes de nuit, accepter aussi la veille de startDate
          // car leur créneau 00:00-08:00 tombe dans notre période
          if (FULL_NIGHT_SHIFTS.includes(assignment.shiftType)) {
            const dayBeforeStart = addDaysParis(startDate, -1);
            const dayBeforeStartStr = formatParisDate(dayBeforeStart, 'yyyy-MM-dd');
            
            
            if (assignmentDateStr < dayBeforeStartStr || assignmentDateStr > endDateStr) {
              return;
            }
          } else {
            // Pour les autres gardes, vérifier strictement la période
            if (assignmentDateStr < startDateStr || assignmentDateStr > endDateStr) {
              return;
            }
          }
          
          // Pour RD, vérifier si c'est un type weekend-only et si on est en weekend/férié/pont
          if (associationId === 'RD' && WEEKEND_ONLY_SHIFTS_RD.includes(assignment.shiftType)) {
            const dayOfWeek = assignmentDate.getDay();
            const isSunday = dayOfWeek === 0; // Dimanche seulement, pas samedi
            const isHolidayDay = isHoliday(assignmentDate);
            const isBridgeDayCheck = isBridgeDay(assignmentDate);
            if (!isSunday && !isHolidayDay && !isBridgeDayCheck) {
              return; // Skip si ce n'est ni dimanche ni férié ni pont
            }
          }
          
          // Vérifier si c'est une garde d'astreinte
          const astreinteCode = SHIFT_TO_ASTREINTE_MAP[assignment.shiftType];
          if (!astreinteCode) {
            return;
          }
          
          astreinteCount++;
          
          // Formater le nom de l'utilisateur
          const userName = user.lastName.toUpperCase();
          
          // Détecter si c'est un remplacement (à implémenter selon la logique métier)
          // Pour l'instant, on utilise juste le nom du médecin
          
          // Formater la date en string standard
          const dateStr = formatParisDate(assignmentDate, 'yyyy-MM-dd');
          
          
          // Créer les entrées d'astreinte selon le type de garde
          if (FULL_NIGHT_SHIFTS.includes(assignment.shiftType)) {
            // Garde de nuit : commence à 20h le jour assigné et finit à 8h le lendemain
            // Créneau du soir sur la date assignée
            astreinteAssignments.push({
              date: dateStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '20:00-24:00'
            });
            // Créneau du matin sur le jour suivant
            const nextDay = addDaysParis(assignmentDate, 1);
            const nextDayStr = formatParisDate(nextDay, 'yyyy-MM-dd');
            astreinteAssignments.push({
              date: nextDayStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '00:00-08:00'
            });
            
          } else if (associationId === 'RD' && DAY_SHIFTS_RD.includes(assignment.shiftType)) {
            // Garde de jour pour RD (weekends et jours fériés uniquement)
            astreinteAssignments.push({
              date: dateStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '08:00-20:00'
            });
          } else {
            // Garde du soir uniquement (RS, SS, etc.)
            astreinteAssignments.push({
              date: dateStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '20:00-24:00'
            });
          }
        });
      });
    });

    
    // Pour RD, combiner RM+RA en RMRA et SM+SA en SMSA seulement si c'est le même médecin
    if (associationId === 'RD') {
      // Créer une map pour regrouper par date et créneau
      const assignmentsByDateSlot = new Map<string, AstreinteAssignment[]>();
      
      astreinteAssignments.forEach(assignment => {
        const key = `${assignment.date}_${assignment.timeSlot}`;
        if (!assignmentsByDateSlot.has(key)) {
          assignmentsByDateSlot.set(key, []);
        }
        assignmentsByDateSlot.get(key)!.push(assignment);
      });
      
      // Parcourir chaque groupe et détecter les combinaisons
      const combinedAssignments: AstreinteAssignment[] = [];
      const assignmentsToRemove = new Set<AstreinteAssignment>();
      
      assignmentsByDateSlot.forEach(assignments => {
        // Grouper par utilisateur pour ce créneau
        const userAssignments = new Map<string, AstreinteAssignment[]>();
        assignments.forEach(a => {
          if (!userAssignments.has(a.userId)) {
            userAssignments.set(a.userId, []);
          }
          userAssignments.get(a.userId)!.push(a);
        });
        
        // Pour chaque utilisateur, vérifier s'il a SM+SA ou RM+RA
        userAssignments.forEach((userAssigns) => {
          const hasSM = userAssigns.find(a => a.astreinteCode === 'SM');
          const hasSA = userAssigns.find(a => a.astreinteCode === 'SA');
          const hasRM = userAssigns.find(a => a.astreinteCode === 'RM');
          const hasRA = userAssigns.find(a => a.astreinteCode === 'RA');
          
          // Combiner SM+SA seulement si c'est le même médecin
          if (hasSM && hasSA) {
            combinedAssignments.push({
              ...hasSM,
              astreinteCode: 'SMSA',
              shiftType: 'SMSA'
            });
            assignmentsToRemove.add(hasSM);
            assignmentsToRemove.add(hasSA);
          }
          
          // Combiner RM+RA seulement si c'est le même médecin
          if (hasRM && hasRA) {
            combinedAssignments.push({
              ...hasRM,
              astreinteCode: 'RMRA',
              shiftType: 'RMRA'
            });
            assignmentsToRemove.add(hasRM);
            assignmentsToRemove.add(hasRA);
          }
        });
      });
      
      // Filtrer les assignments pour enlever ceux qui ont été combinés
      astreinteAssignments = astreinteAssignments.filter(a => !assignmentsToRemove.has(a));
      // Ajouter les combinaisons
      astreinteAssignments.push(...combinedAssignments);
      
    }
    
    // Analyser le nombre maximum d'occurrences pour chaque type de garde par créneau
    const maxOccurrencesByType = new Map<string, number>();
    const astreinteTypes = associationId === 'RG' ? ASTREINTE_TYPES_RG : ASTREINTE_TYPES_RD;
    
    // Initialiser avec 0 pour chaque type
    astreinteTypes.forEach(type => {
      maxOccurrencesByType.set(type, 0);
    });
    
    // Parcourir toutes les assignations pour trouver le max
    const assignmentsByDateSlotType = new Map<string, Map<string, string[]>>();
    astreinteAssignments.forEach(assignment => {
      const key = `${assignment.date}_${assignment.timeSlot}`;
      if (!assignmentsByDateSlotType.has(key)) {
        assignmentsByDateSlotType.set(key, new Map());
      }
      
      const slotData = assignmentsByDateSlotType.get(key)!;
      if (!slotData.has(assignment.astreinteCode)) {
        slotData.set(assignment.astreinteCode, []);
      }
      
      slotData.get(assignment.astreinteCode)!.push(assignment.userName);
    });
    
    // Calculer le nombre max pour chaque type
    assignmentsByDateSlotType.forEach(slotData => {
      slotData.forEach((medecins, type) => {
        const currentMax = maxOccurrencesByType.get(type) || 0;
        maxOccurrencesByType.set(type, Math.max(currentMax, medecins.length));
      });
    });
    
    
    // 3. Créer le fichier Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Feuil1');
    
    // Configuration des colonnes
    // Première colonne pour les dates/heures
    worksheet.getColumn(1).width = 15;
    
    // Générer les en-têtes avec répétition selon le nombre max d'occurrences et séparation par groupes
    const headers = ['', ''];  // Deux colonnes vides pour Date et Heure
    const astreinteGroups = associationId === 'RG' ? ASTREINTE_GROUPS_RG : ASTREINTE_GROUPS_RD;
    
    astreinteGroups.forEach((group, groupIndex) => {
      // Ajouter une colonne vide entre les groupes (sauf pour le premier)
      if (groupIndex > 0) {
        headers.push('');
      }
      
      // Ajouter les colonnes pour chaque type dans le groupe
      group.forEach(type => {
        const maxCount = maxOccurrencesByType.get(type) || 1;
        for (let i = 0; i < Math.max(1, maxCount); i++) {
          headers.push(type);
        }
      });
    });
    
    worksheet.addRow(headers);
    
    // Style pour l'en-tête - Jaune/Or comme dans le fichier exemple
    const headerRow = worksheet.getRow(1);
    headerRow.height = 15;
    
    // Appliquer le style à chaque cellule de l'en-tête
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber > 2) {  // Seulement pour les colonnes de garde
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF00FFFF' }  // Bleu cyan
        };
        cell.font = {
          bold: true,
          size: 9,
          name: 'Arial'
        };
      } else {
        cell.font = { 
          size: 11,
          name: 'Arial'
        };  // Taille par défaut pour les premières colonnes
      }
    });
    
    // Ajuster la largeur des colonnes
    worksheet.getColumn(1).width = 15;  // Date
    worksheet.getColumn(2).width = 12;  // Créneau horaire
    
    // Parcourir toutes les colonnes et définir leur largeur
    for (let i = 3; i <= headers.length; i++) {
      if (headers[i - 1] === '') {
        // Colonne de séparation : plus étroite
        worksheet.getColumn(i).width = 3;
      } else {
        // Colonne de garde : largeur normale
        worksheet.getColumn(i).width = 12;
      }
    }
    
    // 4. Remplir les données
    // Nous avons déjà organisé les données dans assignmentsByDateSlotType
    
    // Générer la liste des dates pour la période
    // On inclut toujours le jour précédent pour voir le créneau 20:00-24:00 de la veille
    // Et le jour suivant pour voir le créneau 00:00-08:00 du lendemain
    const extendedStartDate = addDaysParis(startDate, -1);
    const extendedEndDate = addDaysParis(endDate, 1);
    
    
    // S'assurer que les dates sont en timezone Paris
    const parisStartDate = toParisTime(extendedStartDate);
    const parisExtendedEndDate = toParisTime(extendedEndDate);
    const dates = eachDayOfInterval({ start: parisStartDate, end: parisExtendedEndDate });
    
    
    // Créer les lignes pour chaque jour et créneau
    let rowIndex = 1; // Commencer après l'en-tête
    
    
    dates.forEach(date => {
      const dateStr = formatParisDate(date, 'yyyy-MM-dd');
      const dateStrExcel = formatParisDate(date, 'dd/MM/yyyy');
      
      
      const isWeekendDay = isWeekend(date);
      const isHolidayDay = isHoliday(date);
      const isBridgeDayCheck = isBridgeDay(date);
      const isSpecialDay = isWeekendDay || isHolidayDay || isBridgeDayCheck;
      
      // Pour éviter d'afficher des données hors période, on vérifie les dates
      const startDateStr = formatParisDate(startDate, 'yyyy-MM-dd');
      const endDateStr = formatParisDate(endDate, 'yyyy-MM-dd');
      const isBeforeStart = dateStr < startDateStr;
      const isAfterEnd = dateStr > endDateStr;
      const isInMainPeriod = !isBeforeStart && !isAfterEnd;
      
      // Ligne pour le créneau 00:00-08:00
      const morningKey = `${dateStr}_00:00-08:00`;
      const morningData = assignmentsByDateSlotType.get(morningKey) || new Map();
      const morningRow = [dateStrExcel, '00:00-08:00'];  // Utiliser le format dd/MM/yyyy pour Excel
      
      
      let hasMorningData = false;
      astreinteGroups.forEach((group, groupIndex) => {
        // Ajouter une colonne vide entre les groupes (sauf pour le premier)
        if (groupIndex > 0) {
          morningRow.push('');
        }
        
        // Ajouter les données pour chaque type dans le groupe
        group.forEach(type => {
          const medecins = morningData.get(type) || [];
          const maxCount = maxOccurrencesByType.get(type) || 1;
          
          // Distribuer les médecins dans les colonnes appropriées
          for (let i = 0; i < Math.max(1, maxCount); i++) {
            morningRow.push(medecins[i] || '');
            if (medecins[i]) hasMorningData = true;
          }
        });
      });
      
      if (hasMorningData) {
        // Toujours afficher les créneaux 00:00-08:00 s'il y a des données
        // Car ils appartiennent à la date affichée, même s'ils proviennent d'une garde de nuit de la veille
        {
          try {
            const row = worksheet.addRow(morningRow);
            rowIndex++;
            
            // La date est déjà formatée comme chaîne, pas besoin de format Excel
            
            // Alternance de couleurs (gris clair pour les lignes paires)
            const hasBackground = rowIndex % 2 === 0;
            
            // Appliquer un style gris si on est après la fin de la période
            const isOutOfMainPeriod = isAfterEnd;
            applyRowStyle(row, hasBackground, isOutOfMainPeriod);
            
            // Détecter et formater les doublons
            const duplicates = findDuplicatesInRow(morningRow);
            if (duplicates.size > 0) {
              applyDuplicateFormatting(row, morningRow, duplicates, hasBackground);
            }
          } catch (error) {
            console.error(`[exportPlanningToAstreinte] ERREUR lors de l'ajout de la ligne matin ${dateStr}:`, error);
          }
        }
      }
      
      // Ligne pour le créneau 08:00-20:00 (seulement pour RD et seulement weekends/jours fériés)
      if (associationId === 'RD' && isSpecialDay && isInMainPeriod) {
        const dayKey = `${dateStr}_08:00-20:00`;
        const dayData = assignmentsByDateSlotType.get(dayKey) || new Map();
        const dayRow = [dateStrExcel, '08:00-20:00'];  // Utiliser le format dd/MM/yyyy pour Excel
        
        let hasDayData = false;
        astreinteGroups.forEach((group, groupIndex) => {
          // Ajouter une colonne vide entre les groupes (sauf pour le premier)
          if (groupIndex > 0) {
            dayRow.push('');
          }
          
          // Ajouter les données pour chaque type dans le groupe
          group.forEach(type => {
            const medecins = dayData.get(type) || [];
            const maxCount = maxOccurrencesByType.get(type) || 1;
            
            // Distribuer les médecins dans les colonnes appropriées
            for (let i = 0; i < Math.max(1, maxCount); i++) {
              dayRow.push(medecins[i] || '');
              if (medecins[i]) hasDayData = true;
            }
          });
        });
        
        if (hasDayData) {
          const row = worksheet.addRow(dayRow);
          rowIndex++;
          
          // La date est déjà formatée comme chaîne, pas besoin de format Excel
          
          // Alternance de couleurs (gris clair pour les lignes paires)
          const hasBackground = rowIndex % 2 === 0;
          applyRowStyle(row, hasBackground);
          
          // Détecter et formater les doublons
          const duplicates = findDuplicatesInRow(dayRow);
          if (duplicates.size > 0) {
            applyDuplicateFormatting(row, dayRow, duplicates, hasBackground);
          }
        }
      }
      
      // Ligne pour le créneau 20:00-24:00
      const eveningKey = `${dateStr}_20:00-24:00`;
      const eveningData = assignmentsByDateSlotType.get(eveningKey) || new Map();
      const eveningRow = [dateStrExcel, '20:00-24:00'];  // Utiliser le format dd/MM/yyyy pour Excel
      
      let hasEveningData = false;
      astreinteGroups.forEach((group, groupIndex) => {
        // Ajouter une colonne vide entre les groupes (sauf pour le premier)
        if (groupIndex > 0) {
          eveningRow.push('');
        }
        
        // Ajouter les données pour chaque type dans le groupe
        group.forEach(type => {
          const medecins = eveningData.get(type) || [];
          const maxCount = maxOccurrencesByType.get(type) || 1;
          
          // Distribuer les médecins dans les colonnes appropriées
          for (let i = 0; i < Math.max(1, maxCount); i++) {
            eveningRow.push(medecins[i] || '');
            if (medecins[i]) hasEveningData = true;
          }
        });
      });
      
      if (hasEveningData) {
        // Ne pas afficher le créneau 20:00-24:00 du jour après la fin
        if (isAfterEnd) {
          // Skip ce créneau car il appartient au jour suivant
        } else {
          const row = worksheet.addRow(eveningRow);
          rowIndex++;
          
          // La date est déjà formatée comme chaîne, pas besoin de format Excel
          
          // Alternance de couleurs (gris clair pour les lignes paires)
          const hasBackground = rowIndex % 2 === 0;
          
          // Appliquer un style gris si on est avant le début de la période
          const isOutOfMainPeriod = isBeforeStart;
          
          applyRowStyle(row, hasBackground, isOutOfMainPeriod);
          
          // Détecter et formater les doublons
          const duplicates = findDuplicatesInRow(eveningRow);
          if (duplicates.size > 0) {
            applyDuplicateFormatting(row, eveningRow, duplicates, hasBackground);
          }
        }
      }
    });
    
    
    // Appliquer les bordures
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // 5. Générer et télécharger le fichier
    const { fr } = await import('date-fns/locale');
    const monthYear = formatParisDate(startDate, 'MMMM yyyy', { locale: fr });
    const fileName = `Ordigard ${monthYear}.xlsx`;
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Erreur lors de l\'export astreinte:', error);
    throw new Error('Impossible de générer le fichier d\'astreinte');
  }
};