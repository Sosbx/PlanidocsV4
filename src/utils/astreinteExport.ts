import { formatParisDate, createParisDate } from '../utils/timezoneUtils';
import { collection, getDocs } from '../lib/firebase/exports/firestore';
import { db } from '../lib/firebase/config';
import { getCollectionName, COLLECTIONS } from '../utils/collectionUtils';
import { batchLoadUsersPlannings } from '../lib/firebase/planning/batchOperations';
import type { GeneratedPlanning } from '../types/planning';
import type { User } from '../types/users';
import * as ExcelJS from 'exceljs';
import { eachDayOfInterval, getDate, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
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
const WEEKEND_ONLY_SHIFTS_RD = ['RS', 'RM', 'RA', 'RMRA', 'SM', 'SA', 'SS', 'HS', 'SMSA'];

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
  associationId: string
): Promise<void> => {
  try {
    console.log('=== DÉBUT EXPORT ASTREINTE ===');
    console.log(`Association: ${associationId}`);
    console.log(`Période: ${formatParisDate(startDate, 'dd/MM/yyyy')} - ${formatParisDate(endDate, 'dd/MM/yyyy')}`);
    
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
    console.log(`Nombre d'utilisateurs trouvés: ${users.size}`);

    // 2. Récupérer tous les plannings générés en utilisant la même méthode que la vue globale
    const plannings = await batchLoadUsersPlannings({
      userIds,
      includeArchived: true, // Inclure les archives car les données peuvent être archivées
      startDate,
      endDate,
      associationId
    });
    
    console.log(`Nombre de périodes trouvées: ${Object.keys(plannings).length}`);
    
    // Si aucune période trouvée, essayer de récupérer toutes les périodes sans filtre de date
    let allPlannings = plannings;
    if (Object.keys(plannings).length === 0) {
      console.log('Aucune période trouvée pour les dates spécifiées. Récupération de toutes les périodes...');
      allPlannings = await batchLoadUsersPlannings({
        userIds,
        includeArchived: true,
        associationId
      });
      console.log(`Nombre total de périodes dans la base: ${Object.keys(allPlannings).length}`);
    }
    
    // Sélectionner le bon mapping selon l'association
    const SHIFT_TO_ASTREINTE_MAP = associationId === 'RG' ? SHIFT_TO_ASTREINTE_MAP_RG : SHIFT_TO_ASTREINTE_MAP_RD;
    
    let totalAssignments = 0;
    let astreinteCount = 0;
    let astreinteAssignments: AstreinteAssignment[] = [];
    const uniqueShiftTypes = new Set<string>();
    
    // Parcourir toutes les périodes
    Object.entries(plannings).forEach(([periodId, periodPlannings]) => {
      console.log(`Traitement de la période: ${periodId}`);
      
      // Parcourir tous les utilisateurs de cette période
      Object.entries(periodPlannings).forEach(([userId, userPlanning]) => {
        const user = users.get(userId);
        if (!user || !userPlanning.assignments) return;
        
        // Parcourir toutes les assignments de cet utilisateur
        Object.entries(userPlanning.assignments).forEach(([_key, assignment]) => {
          if (!assignment || !assignment.date || !assignment.shiftType) return;
          
          totalAssignments++;
          uniqueShiftTypes.add(assignment.shiftType);
          
          // Gérer différents formats de date
          let assignmentDate: Date;
          if (typeof assignment.date === 'string') {
            // Si c'est une string au format ISO ou autre, la parser correctement
            assignmentDate = new Date(assignment.date);
          } else if (assignment.date instanceof Date) {
            assignmentDate = assignment.date;
          } else {
            // Si c'est un autre format, essayer de le convertir
            assignmentDate = new Date(assignment.date);
          }
          
          // Vérifier si la date est dans notre période (normalement déjà filtré par batchLoadUsersPlannings)
          if (assignmentDate < startDate || assignmentDate > endDate) return;
          
          // Pour RD, vérifier si c'est un type weekend-only et si on est en weekend/férié/pont
          if (associationId === 'RD' && WEEKEND_ONLY_SHIFTS_RD.includes(assignment.shiftType)) {
            const isWeekendDay = isWeekend(assignmentDate);
            const isHolidayDay = isHoliday(assignmentDate);
            const isBridgeDayCheck = isBridgeDay(assignmentDate);
            if (!isWeekendDay && !isHolidayDay && !isBridgeDayCheck) {
              return; // Skip si ce n'est ni weekend ni férié ni pont
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
            // Garde complète : créer deux entrées (matin et soir)
            astreinteAssignments.push({
              date: dateStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '00:00-08:00'
            });
            astreinteAssignments.push({
              date: dateStr,
              userName,
              userId,
              shiftType: assignment.shiftType,
              astreinteCode,
              timeSlot: '20:00-24:00'
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

    console.log(`Total assignments analysés: ${totalAssignments}`);
    console.log(`Types de gardes uniques trouvés: ${Array.from(uniqueShiftTypes).sort().join(', ')}`);
    console.log(`Assignments d'astreinte trouvés: ${astreinteCount}`);
    console.log(`Nombre d'astreintes à exporter avant combinaison: ${astreinteAssignments.length}`);
    
    // Pour RD, combiner RM+RA en RMRA et SM+SA en SMSA
    if (associationId === 'RD') {
      // Créer une map pour regrouper par médecin, date et créneau
      const assignmentsByUserDateSlot = new Map<string, AstreinteAssignment[]>();
      
      astreinteAssignments.forEach(assignment => {
        const key = `${assignment.userId}_${assignment.date}_${assignment.timeSlot}`;
        if (!assignmentsByUserDateSlot.has(key)) {
          assignmentsByUserDateSlot.set(key, []);
        }
        assignmentsByUserDateSlot.get(key)!.push(assignment);
      });
      
      // Parcourir chaque groupe et détecter les combinaisons
      const combinedAssignments: AstreinteAssignment[] = [];
      const assignmentsToRemove = new Set<AstreinteAssignment>();
      
      assignmentsByUserDateSlot.forEach(assignments => {
        const hasRM = assignments.find(a => a.astreinteCode === 'RM');
        const hasRA = assignments.find(a => a.astreinteCode === 'RA');
        const hasSM = assignments.find(a => a.astreinteCode === 'SM');
        const hasSA = assignments.find(a => a.astreinteCode === 'SA');
        
        // Si RM et RA existent, créer RMRA
        if (hasRM && hasRA) {
          combinedAssignments.push({
            ...hasRM,
            astreinteCode: 'RMRA',
            shiftType: 'RMRA'
          });
          assignmentsToRemove.add(hasRM);
          assignmentsToRemove.add(hasRA);
          console.log(`Combinaison RM+RA → RMRA pour ${hasRM.userName} le ${hasRM.date}`);
        }
        
        // Si SM et SA existent, créer SMSA
        if (hasSM && hasSA) {
          combinedAssignments.push({
            ...hasSM,
            astreinteCode: 'SMSA',
            shiftType: 'SMSA'
          });
          assignmentsToRemove.add(hasSM);
          assignmentsToRemove.add(hasSA);
          console.log(`Combinaison SM+SA → SMSA pour ${hasSM.userName} le ${hasSM.date}`);
        }
      });
      
      // Filtrer les assignments pour enlever ceux qui ont été combinés
      astreinteAssignments = astreinteAssignments.filter(a => !assignmentsToRemove.has(a));
      // Ajouter les combinaisons
      astreinteAssignments.push(...combinedAssignments);
      
      console.log(`Nombre d'astreintes après combinaison: ${astreinteAssignments.length}`);
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
    
    console.log('Nombre max d\'occurrences par type:', Object.fromEntries(maxOccurrencesByType));
    
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
    console.log(`Nombre d'entrées dans assignmentsByDateSlotType: ${assignmentsByDateSlotType.size}`);
    if (assignmentsByDateSlotType.size > 0) {
      console.log('Exemple de clés:', Array.from(assignmentsByDateSlotType.keys()).slice(0, 3));
    }
    
    // Générer la liste des dates pour la période
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Créer les lignes pour chaque jour et créneau
    let rowIndex = 1; // Commencer après l'en-tête
    dates.forEach(date => {
      const dateStr = formatParisDate(date, 'yyyy-MM-dd');
      const isWeekendDay = isWeekend(date);
      const isHolidayDay = isHoliday(date);
      const isBridgeDayCheck = isBridgeDay(date);
      const isSpecialDay = isWeekendDay || isHolidayDay || isBridgeDayCheck;
      
      // Ligne pour le créneau 00:00-08:00
      const morningKey = `${dateStr}_00:00-08:00`;
      const morningData = assignmentsByDateSlotType.get(morningKey) || new Map();
      const morningRow = [date, '00:00-08:00'];  // Date complète et créneau horaire séparés
      
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
        const row = worksheet.addRow(morningRow);
        rowIndex++;
        
        // Formater la date
        row.getCell(1).numFmt = 'dd/mm/yy';
        
        // Alternance de couleurs (gris clair pour les lignes paires)
        const hasBackground = rowIndex % 2 === 0;
        if (hasBackground) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }  // Gris très clair
            };
            cell.font = { 
              size: 9,
              name: 'Arial',
              bold: true
            };
          });
        } else {
          row.eachCell((cell) => {
            cell.font = { 
              size: 9,
              name: 'Arial',
              bold: true
            };
          });
        }
        
        // Détecter et formater les doublons
        const duplicates = findDuplicatesInRow(morningRow);
        if (duplicates.size > 0) {
          applyDuplicateFormatting(row, morningRow, duplicates, hasBackground);
        }
      }
      
      // Ligne pour le créneau 08:00-20:00 (seulement pour RD et seulement weekends/jours fériés)
      if (associationId === 'RD' && isSpecialDay) {
        const dayKey = `${dateStr}_08:00-20:00`;
        const dayData = assignmentsByDateSlotType.get(dayKey) || new Map();
        const dayRow = [date, '08:00-20:00'];  // Date complète et créneau horaire séparés
        
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
          
          // Formater la date
          row.getCell(1).numFmt = 'dd/mm/yy';
          
          // Alternance de couleurs (gris clair pour les lignes paires)
          const hasBackground = rowIndex % 2 === 0;
          if (hasBackground) {
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' }  // Gris très clair
              };
              cell.font = { 
                size: 9,
                name: 'Arial',
                bold: true
              };
            });
          } else {
            row.eachCell((cell) => {
              cell.font = { 
                size: 9,
                name: 'Arial',
                bold: true
              };
            });
          }
          
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
      const eveningRow = [date, '20:00-24:00'];  // Date complète et créneau horaire séparés
      
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
        const row = worksheet.addRow(eveningRow);
        rowIndex++;
        
        // Formater la date
        row.getCell(1).numFmt = 'dd/mm/yy';
        
        // Alternance de couleurs (gris clair pour les lignes paires)
        const hasBackground = rowIndex % 2 === 0;
        if (hasBackground) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }  // Gris très clair
            };
            cell.font = { 
              size: 9,
              name: 'Arial',
              bold: true
            };
          });
        } else {
          row.eachCell((cell) => {
            cell.font = { 
              size: 9,
              name: 'Arial',
              bold: true
            };
          });
        }
        
        // Détecter et formater les doublons
        const duplicates = findDuplicatesInRow(eveningRow);
        if (duplicates.size > 0) {
          applyDuplicateFormatting(row, eveningRow, duplicates, hasBackground);
        }
      }
    });
    
    console.log(`Nombre de lignes ajoutées au fichier Excel: ${worksheet.rowCount - 1}`);
    
    // Si aucune donnée d'astreinte n'a été trouvée, afficher un avertissement
    if (astreinteAssignments.length === 0) {
      console.warn('ATTENTION: Aucune garde d\'astreinte trouvée pour cette période.');
      console.warn('Vérifiez que les types de gardes correspondent aux mappings définis.');
      console.warn(`Types d'astreintes attendus pour ${associationId}: ${Object.keys(SHIFT_TO_ASTREINTE_MAP).join(', ')}`);
    }
    
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