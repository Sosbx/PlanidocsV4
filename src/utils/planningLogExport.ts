import { format } from 'date-fns';
import { createParisDate, formatParisDate } from '@/utils/timezoneUtils';
import { collection, getDocs, doc, getDoc } from '../lib/firebase/exports/firestore';
import { db } from '../lib/firebase/config';
import { getCollectionName, COLLECTIONS } from '../utils/collectionUtils';
import type { ShiftAssignment, GeneratedPlanning } from '../types/planning';
import type { User } from '../types/users';

interface PostType {
  baseCode: string;      // Ex: "MM", "NL", "CM"
  maxNumber: number;     // Plus grand numéro trouvé pour ce type
  minPostCount: number;  // Minimum de postes à générer (au moins 2)
}

interface EnrichedAssignment extends ShiftAssignment {
  userName?: string;
  userId?: string;
}

// Nombre de postes par défaut pour les types connus
const getDefaultPostCount = (type: string): number => {
  const defaults: Record<string, number> = {
    'ML': 5, 'AC': 5, 'MC': 5, 'AL': 5,
    'MM': 2, 'AM': 1,
    'NL': 2, 'NM': 3, 'NA': 3, 'NR': 1, 'NZ': 1, 'NC': 3,
    'SM': 1, 'SA': 1, 'SS': 1,
    'RM': 1, 'RA': 1, 'RS': 1,
    'HM': 1, 'HA': 1, 'HS': 1,
    'CM': 4, 'CA': 4, 'CS': 2, 'CT': 1
  };
  
  return defaults[type] || 2; // Par défaut, au moins 2 postes
};

// Ordre de tri des types de postes pour un affichage cohérent
const TYPE_ORDER = ['ML', 'AC', 'MC', 'AL', 'MM', 'AM', 'NL', 'NM', 'NA', 'NR', 'NZ', 'NC', 'SM', 'SA', 'SS', 'RM', 'RA', 'RS', 'HM', 'HA', 'HS', 'CM', 'CA', 'CS', 'CT'];


// Détection automatique des types de postes présents dans les plannings
const detectPostTypes = (
  assignments: EnrichedAssignment[], 
  associationId: string
): Map<string, PostType> => {
  const postTypesMap = new Map<string, PostType>();
  const associationLetter = associationId === 'RG' ? 'G' : 'D';
  
  // Parcourir tous les assignments pour détecter les patterns
  assignments.forEach(assignment => {
    const shiftType = assignment.shiftType;
    
    // Pattern: XXY# où XX=type (2 lettres), Y=association(D/G), #=numéro
    const match = shiftType.match(/^([A-Z]{2})([DG])(\d+)$/);
    if (match) {
      const [_, baseCode, assocLetter, number] = match;
      
      // Vérifier que c'est bien pour notre association
      if (assocLetter === associationLetter) {
        const postNum = parseInt(number);
        
        if (!postTypesMap.has(baseCode)) {
          postTypesMap.set(baseCode, {
            baseCode,
            maxNumber: postNum,
            minPostCount: Math.max(2, postNum) // Au minimum 2 postes
          });
        } else {
          const existing = postTypesMap.get(baseCode)!;
          existing.maxNumber = Math.max(existing.maxNumber, postNum);
          existing.minPostCount = Math.max(existing.minPostCount, existing.maxNumber);
        }
      }
    }
  });
  
  // Ajouter les types connus même s'ils ne sont pas dans les données
  // pour garantir la compatibilité avec l'ancien système
  TYPE_ORDER.forEach(type => {
    if (!postTypesMap.has(type)) {
      postTypesMap.set(type, {
        baseCode: type,
        maxNumber: 0,
        minPostCount: getDefaultPostCount(type)
      });
    }
  });
  
  return postTypesMap;
};

// Récupérer les plannings pour une période donnée
const fetchPlanningsForPeriod = async (
  startDate: Date,
  endDate: Date,
  associationId: string
): Promise<Map<string, EnrichedAssignment[]>> => {
  const planningsMap = new Map<string, EnrichedAssignment[]>();
  
  try {
    // Récupérer tous les documents de la collection (un document par utilisateur)
    const planningsSnapshot = await getDocs(
      collection(db, getCollectionName(COLLECTIONS.GENERATED_PLANNINGS, associationId))
    );
    
    console.log(`Nombre d'utilisateurs avec plannings: ${planningsSnapshot.docs.length}`);
    
    // Parcourir chaque document utilisateur
    for (const userDoc of planningsSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      if (!userData || !userData.periods) {
        console.log(`Pas de périodes pour l'utilisateur ${userId}`);
        continue;
      }
      
      // Parcourir toutes les périodes de cet utilisateur
      for (const [periodId, periodData] of Object.entries(userData.periods)) {
        if (!periodData || typeof periodData !== 'object') continue;
        
        const planning = periodData as GeneratedPlanning;
        if (!planning.assignments) continue;
        
        // Parcourir toutes les assignments de cette période
        for (const [__, assignment] of Object.entries(planning.assignments)) {
          if (!assignment || !assignment.date || !assignment.shiftType) continue;
          
          const assignmentDate = new Date(assignment.date);
          
          // Vérifier si la date est dans la période demandée
          if (assignmentDate >= startDate && assignmentDate <= endDate) {
            const dateKey = formatParisDate(assignmentDate, 'yyyy-MM-dd');
            
            if (!planningsMap.has(dateKey)) {
              planningsMap.set(dateKey, []);
            }
            
            planningsMap.get(dateKey)!.push({
              ...assignment,
              userId
            });
          }
        }
      }
    }

    // Enrichir avec les noms des utilisateurs
    const userCache = new Map<string, string>();
    
    // Charger tous les utilisateurs en une fois pour de meilleures performances
    const usersSnapshot = await getDocs(
      collection(db, getCollectionName(COLLECTIONS.USERS, associationId))
    );
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data() as User;
      if (userData && userData.lastName) {
        userCache.set(doc.id, userData.lastName.toUpperCase());
        console.log(`Utilisateur trouvé: ${doc.id} -> ${userData.lastName}`);
      }
    });
    
    console.log(`Nombre d'utilisateurs trouvés: ${userCache.size}`);
    
    // Enrichir les assignments avec les noms d'utilisateurs
    for (const assignments of planningsMap.values()) {
      for (const assignment of assignments) {
        if (assignment.userId) {
          assignment.userName = userCache.get(assignment.userId) || '';
          if (!assignment.userName) {
            console.log(`Nom non trouvé pour l'utilisateur: ${assignment.userId}`);
          }
        }
      }
    }
    
    // Log pour debug
    let totalAssignments = 0;
    let assignmentsWithNames = 0;
    planningsMap.forEach((assignments) => {
      totalAssignments += assignments.length;
      assignmentsWithNames += assignments.filter(a => a.userName).length;
    });
    console.log(`Total assignments: ${totalAssignments}, avec noms: ${assignmentsWithNames}`);
    
  } catch (error) {
    console.error('Erreur lors de la récupération des plannings:', error);
  }
  
  return planningsMap;
};

// Générer le contenu du fichier log
const generateLogContent = (
  plannings: Map<string, EnrichedAssignment[]>,
  postTypes: Map<string, PostType>,
  startDate: Date,
  endDate: Date,
  associationId: string
): string => {
  const lines: string[] = [];
  const associationLetter = associationId === 'RG' ? 'G' : 'D';
  
  // Trier les types détectés selon l'ordre défini
  const sortedPostTypes = Array.from(postTypes.entries())
    .sort(([a], [b]) => {
      const indexA = TYPE_ORDER.indexOf(a);
      const indexB = TYPE_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  
  // Pour chaque jour de la période
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = formatParisDate(currentDate, 'dd/MM/yyyy');
    const dayKey = formatParisDate(currentDate, 'yyyy-MM-dd');
    const dayAssignments = plannings.get(dayKey) || [];
    
    // Debug: afficher les assignments du jour pour le premier jour uniquement
    if (currentDate.getTime() === startDate.getTime()) {
      console.log(`Assignments pour ${dateStr}:`, dayAssignments.length, 'assignments trouvés');
      if (dayAssignments.length > 0) {
        console.log('Exemple:', dayAssignments[0]);
      }
    }
    
    // Pour chaque type de poste (dans l'ordre)
    for (const [baseCode, postType] of sortedPostTypes) {
      // Générer le nombre de postes requis
      for (let postNum = 1; postNum <= postType.minPostCount; postNum++) {
        const postCode = `${baseCode}${associationLetter}${postNum}`;
        
        // Chercher si un médecin est assigné
        // Les assignments ont des shiftType comme "ML" mais on génère des codes comme "MLD1"
        // Il faut donc comparer uniquement le baseCode
        // Trouver tous les médecins assignés à ce type de poste pour ce jour
        const assignmentsForType = dayAssignments.filter(a => a.shiftType === baseCode);
        
        // Prendre le médecin correspondant à cette ligne numérotée (postNum - 1 car index commence à 0)
        const assignment = assignmentsForType[postNum - 1];
        const doctorName = assignment?.userName?.toUpperCase() || '';
        
        // Ajouter la ligne avec le format exact : + TAB date TAB nom TAB poste
        lines.push(`+\t${dateStr}\t${doctorName}\t${postCode}`);
      }
    }
    
    // Passer au jour suivant
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return lines.join('\n');
};

// Télécharger le fichier
const downloadLogFile = (content: string): void => {
  const blob = new Blob([content], { 
    type: 'text/plain;charset=utf-8' 
  });
  
  const fileName = `export du ${formatParisDate(createParisDate(), 'dd-MM')} à ${formatParisDate(createParisDate(), 'HH-mm')} En_Cours.log`;
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Fonction principale d'export
export const exportPlanningToLog = async (
  startDate: Date,
  endDate: Date,
  associationId: string
): Promise<void> => {
  try {
    // 1. Récupérer tous les plannings de la période
    const plannings = await fetchPlanningsForPeriod(startDate, endDate, associationId);
    
    // 2. Récupérer tous les assignments pour la détection des types
    const allAssignments: EnrichedAssignment[] = [];
    plannings.forEach(dayAssignments => {
      allAssignments.push(...dayAssignments);
    });
    
    // Debug: afficher quelques assignments pour vérifier la structure
    console.log('Nombre total d\'assignments:', allAssignments.length);
    if (allAssignments.length > 0) {
      console.log('Exemple d\'assignment:', allAssignments[0]);
    }
    
    // 3. Analyser les types de postes présents
    const postTypes = detectPostTypes(allAssignments, associationId);
    
    // 4. Générer le contenu avec tous les postes (assignés ou non)
    const logContent = generateLogContent(plannings, postTypes, startDate, endDate, associationId);
    
    // 5. Télécharger le fichier
    downloadLogFile(logContent);
  } catch (error) {
    console.error('Erreur lors de l\'export du planning:', error);
    throw error;
  }
};