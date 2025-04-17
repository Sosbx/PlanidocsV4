import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { User } from '../../../types/users';
import { GeneratedPlanning, PlanningPeriod, ShiftAssignment } from '../../../types/planning';
import { parseCSVFile } from '../utils/csvParser';
import { detectDateRangeFromFiles, generatePeriodName } from '../utils/dateRangeDetector';
import usePlanningPeriods from './usePlanningPeriods';
import { deletePlanningPeriod } from '../../../lib/firebase/planning';

// Type pour les importations réussies et échouées
export interface ImportResult {
  successfulImports: { fileName: string; user: User }[];
  failedFiles: { fileName: string; reason: string }[];
}

interface UseImportOptions {
  users: User[];
  uploadPeriodId: string;
  allPeriods: PlanningPeriod[];
  saveGeneratedPlanning?: (userId: string, planning: GeneratedPlanning, periodId: string) => Promise<void>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onPlanningImported?: (userId: string, planning: GeneratedPlanning, periodId: string) => void;
  createPlanningPeriod?: (period: Omit<PlanningPeriod, 'id'>) => Promise<string>;
  setUploadPeriodId?: (id: string) => void;
  refreshPeriods?: () => Promise<void>;
  newPeriodName?: string;
  isBagEnabled?: boolean;
  onImportComplete?: (result: ImportResult) => void;
}

export const useImport = ({
  users,
  uploadPeriodId,
  allPeriods,
  saveGeneratedPlanning,
  onSuccess,
  onError,
  onPlanningImported,
  createPlanningPeriod,
  setUploadPeriodId,
  refreshPeriods,
  newPeriodName = '',
  isBagEnabled = true,
  onImportComplete
}: UseImportOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  
  const { createPeriodFromDateRange, findMatchingPeriod, findSimilarPeriods } = usePlanningPeriods({
    createPlanningPeriod,
    allPeriods
  });

  /**
   * Gère l'upload de fichiers CSV
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!files?.length) {
      return;
    }
    
    if (!saveGeneratedPlanning) {
      onError?.('Fonction de sauvegarde non disponible');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    // Initialiser les tableaux pour suivre les résultats
    const successfulImports: { fileName: string; user: User }[] = [];
    const failedFiles: { fileName: string; reason: string }[] = [];
    
    try {
      // Étape 1: Détecter la plage de dates à partir des fichiers
      const { 
        startDate: detectedStartDate, 
        endDate: detectedEndDate,
        failedFiles: detectDateFailedFiles 
      } = await detectDateRangeFromFiles(files);
      
      // Ajouter les fichiers qui ont échoué lors de la détection des dates
      detectDateFailedFiles.forEach(({file, reason}) => {
        failedFiles.push({
          fileName: file.name,
          reason: `Erreur lors de l'analyse des dates: ${reason}`
        });
      });
      
      console.log(`Plage de dates détectée: ${detectedStartDate.toISOString()} - ${detectedEndDate.toISOString()}`);
      console.log(`${detectDateFailedFiles.length} fichiers n'ont pas pu être analysés pour les dates`);
      
      // Étape 2: Vérifier si une période existante correspond à cette plage
      let selectedPeriodId = uploadPeriodId;
      let selectedPeriod = allPeriods.find(p => p.id === selectedPeriodId);
      
      // Variables pour stocker les informations des périodes créées
      let pastPeriodId: string | null = null;
      let pastPeriod: PlanningPeriod | null = null;
      let futurePeriodId: string | null = null;
      let futurePeriod: PlanningPeriod | null = null;
      
      // Si aucune période n'est sélectionnée ou si les dates ne correspondent pas à la période sélectionnée
      if (!selectedPeriod || !selectedPeriodId || 
          detectedStartDate < selectedPeriod.startDate || 
          detectedEndDate > selectedPeriod.endDate) {
        
        if (!createPlanningPeriod || !setUploadPeriodId) {
          onError?.('Fonctions de création de période non disponibles');
          setIsProcessing(false);
          return;
        }
        
        // Vérifier s'il existe des périodes similaires (avec un chevauchement d'au moins 50%)
        const similarPeriods = findSimilarPeriods(detectedStartDate, detectedEndDate);
        
        if (similarPeriods.length > 0) {
          // Afficher les périodes similaires
          const periodsNames = similarPeriods.map(p => p.name).join(', ');
          
          // Demander confirmation à l'utilisateur
          const shouldReplace = window.confirm(
            `Des périodes similaires existent déjà pour cette plage de dates : ${periodsNames}. Voulez-vous les remplacer ?`
          );
          
          if (!shouldReplace) {
            // Si l'utilisateur ne confirme pas, utiliser la première période similaire
            selectedPeriodId = similarPeriods[0].id;
            selectedPeriod = similarPeriods[0];
            setUploadPeriodId(selectedPeriodId);
          } else {
            // Si l'utilisateur confirme, supprimer les périodes existantes
            for (const period of similarPeriods) {
              try {
                await deletePlanningPeriod(period.id);
                console.log(`Période existante supprimée : ${period.name} (${period.id})`);
              } catch (error) {
                console.error(`Erreur lors de la suppression de la période ${period.id}:`, error);
                // Continuer malgré l'erreur
              }
            }
            
            // Créer une ou deux périodes adaptées aux dates détectées
            const result = await createPeriodFromDateRange(
              detectedStartDate, 
              detectedEndDate, 
              newPeriodName, 
              isBagEnabled
            );
            
            // Récupérer tous les champs retournés
            const newPeriodId = result.periodId;
            const newPeriod = result.period;
            pastPeriodId = result.pastPeriodId;
            pastPeriod = result.pastPeriod;
            futurePeriodId = result.futurePeriodId;
            futurePeriod = result.futurePeriod;
            
            selectedPeriodId = newPeriodId;
            
            // Rafraîchir les périodes
            if (refreshPeriods) {
              await refreshPeriods();
            }
            
            // Mettre à jour la période sélectionnée (période principale retournée)
            setUploadPeriodId(newPeriodId);
            
            // Utiliser directement la période retournée au lieu de la chercher dans allPeriods
            if (newPeriod) {
              selectedPeriod = newPeriod;
            } else {
              console.warn("Période créée mais objet période non retourné - recherche dans allPeriods");
              // Fallback: rechercher dans allPeriods (comportement d'origine)
              selectedPeriod = allPeriods.find(p => p.id === newPeriodId);
            }
            
            // Si nous avons deux périodes (passée et future), nous traiterons les fichiers différemment
            const hasTwoPeriods = pastPeriodId && futurePeriodId;
            
            if (hasTwoPeriods) {
              console.log(`Deux périodes créées: passé (${pastPeriodId}) et future (${futurePeriodId})`);
            }
            
            onSuccess?.(`Nouvelle période créée: ${generatePeriodName(detectedStartDate, detectedEndDate)}${hasTwoPeriods ? ' (divisée en 2 périodes)' : ''}`);
          }
          
        } else {
          // Si aucune période similaire n'existe, créer une nouvelle période
          const result = await createPeriodFromDateRange(
            detectedStartDate, 
            detectedEndDate, 
            newPeriodName, 
            isBagEnabled
          );
          
          // Récupérer tous les champs retournés
          const newPeriodId = result.periodId;
          const newPeriod = result.period;
          pastPeriodId = result.pastPeriodId;
          pastPeriod = result.pastPeriod;
          futurePeriodId = result.futurePeriodId;
          futurePeriod = result.futurePeriod;
          
          selectedPeriodId = newPeriodId;
          
          // Rafraîchir les périodes
          if (refreshPeriods) {
            await refreshPeriods();
          }
          
          // Mettre à jour la période sélectionnée (période principale retournée)
          setUploadPeriodId(newPeriodId);
          
          // Utiliser directement la période retournée au lieu de la chercher dans allPeriods
          if (newPeriod) {
            selectedPeriod = newPeriod;
          } else {
            console.warn("Période créée mais objet période non retourné - recherche dans allPeriods");
            // Fallback: rechercher dans allPeriods (comportement d'origine)
            selectedPeriod = allPeriods.find(p => p.id === newPeriodId);
          }
          
          // Si nous avons deux périodes (passée et future), nous traiterons les fichiers différemment
          const hasTwoPeriods = pastPeriodId && futurePeriodId;
          
          if (hasTwoPeriods) {
            console.log(`Deux périodes créées: passé (${pastPeriodId}) et future (${futurePeriodId})`);
          }
          
          onSuccess?.(`Nouvelle période créée: ${generatePeriodName(detectedStartDate, detectedEndDate)}${hasTwoPeriods ? ' (divisée en 2 périodes)' : ''}`);
        }
      }
      
      if (!selectedPeriod || !selectedPeriodId) {
        onError?.('Impossible de créer ou de sélectionner une période valide');
        setIsProcessing(false);
        return;
      }
      
      // Étape 3: Traiter les fichiers et les importer dans la période sélectionnée
      // Filtrer les fichiers qui ont déjà échoué lors de la détection des dates
      const validFiles = files.filter(file => 
        !detectDateFailedFiles.some(failedFile => failedFile.file.name === file.name)
      );
      
      // Vérifier si nous avons deux périodes (passée et future)
      const hasTwoPeriods = pastPeriodId && futurePeriodId && pastPeriod && futurePeriod;
      
      // Date limite séparant passé et futur
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        // Vérifier le type de fichier
        if (file.type !== 'text/csv' && file.name.toLowerCase().indexOf('.csv') === -1) {
          failedFiles.push({
            fileName: file.name,
            reason: 'Format de fichier invalide'
          });
          continue;
        }
        
        try {
          const assignments = await parseCSVFile(file);
          
          // Si nous n'avons qu'une seule période, faire la vérification traditionnelle
          if (!hasTwoPeriods) {
            // Convertir les dates de la période en timestamps pour faciliter les comparaisons
            const periodStartTime = selectedPeriod.startDate.getTime();
            const periodEndTime = selectedPeriod.endDate.getTime();
            
            // Vérifier que toutes les dates sont dans la période
            const datesOutOfRange: string[] = [];
            
            for (const key in assignments) {
              const assignment = assignments[key];
              const assignmentDate = new Date(assignment.date);
              const assignmentTime = assignmentDate.getTime();
              
              if (assignmentTime < periodStartTime || assignmentTime > periodEndTime) {
                datesOutOfRange.push(format(assignmentDate, 'dd/MM/yyyy'));
              }
            }
            
            if (datesOutOfRange.length > 0) {
              // Limiter le nombre de dates affichées si trop nombreuses
              const displayDates = datesOutOfRange.length > 5 
                ? datesOutOfRange.slice(0, 5).join(', ') + ` et ${datesOutOfRange.length - 5} autres`
                : datesOutOfRange.join(', ');
                
              failedFiles.push({
                fileName: file.name,
                reason: `Certaines dates sont en dehors de la période sélectionnée (${format(selectedPeriod.startDate, 'dd/MM/yyyy')} - ${format(selectedPeriod.endDate, 'dd/MM/yyyy')}). Dates hors période : ${displayDates}`
              });
              continue;
            }
            
            const planning: GeneratedPlanning = {
              periodId: selectedPeriodId,
              assignments,
              uploadedAt: new Date(),
              periods: {
                [selectedPeriodId]: {
                  assignments,
                  uploadedAt: new Date()
                }
              }
            };
            
            // Extraire l'identifiant de l'utilisateur du nom du fichier
            const fileName = file.name.toUpperCase();
            const user = users.find(u => fileName.includes(u.lastName.toUpperCase()));
            
            if (!user) {
              failedFiles.push({
                fileName: file.name,
                reason: 'Utilisateur non trouvé. Le nom du fichier doit contenir le NOM de l\'utilisateur (ex: DUPONT.csv)'
              });
              continue;
            }
            
            // Sauvegarder dans Firebase avec la période sélectionnée
            await saveGeneratedPlanning(user.id, planning, selectedPeriodId);
            
            // Notifier le composant parent de l'importation réussie
            if (onPlanningImported) {
              onPlanningImported(user.id, planning, selectedPeriodId);
            }
            
            // Ajouter à la liste des importations réussies
            successfulImports.push({
              fileName: file.name,
              user
            });
          } else {
            // Mode deux périodes - traiter différemment
            console.log(`Traitement de ${file.name} avec division entre périodes passée et future`);
            
            // Diviser les assignments entre passé et futur
            const pastAssignments: Record<string, ShiftAssignment> = {};
            const futureAssignments: Record<string, ShiftAssignment> = {};
            
            for (const key in assignments) {
              const assignment = assignments[key];
              const assignmentDate = new Date(assignment.date);
              
              // Assigner au passé ou au futur selon la date
              if (assignmentDate < today) {
                pastAssignments[key] = assignment;
              } else {
                futureAssignments[key] = assignment;
              }
            }
            
            // Extraire l'identifiant de l'utilisateur du nom du fichier
            const fileName = file.name.toUpperCase();
            const user = users.find(u => fileName.includes(u.lastName.toUpperCase()));
            
            if (!user) {
              failedFiles.push({
                fileName: file.name,
                reason: 'Utilisateur non trouvé. Le nom du fichier doit contenir le NOM de l\'utilisateur (ex: DUPONT.csv)'
              });
              continue;
            }
            
            let hasImportedPast = false;
            let hasImportedFuture = false;
            
            // Importer les assignments passés
            if (Object.keys(pastAssignments).length > 0 && pastPeriodId && pastPeriod) {
              // Vérifier que toutes les dates passées sont dans la période passée
              const pastPeriodStartTime = new Date(pastPeriod.startDate).getTime();
              const pastPeriodEndTime = new Date(pastPeriod.endDate).getTime();
              const pastDatesOutOfRange: string[] = [];
              
              for (const key in pastAssignments) {
                const assignment = pastAssignments[key];
                const assignmentDate = new Date(assignment.date);
                const assignmentTime = assignmentDate.getTime();
                
                if (assignmentTime < pastPeriodStartTime || assignmentTime > pastPeriodEndTime) {
                  pastDatesOutOfRange.push(format(assignmentDate, 'dd/MM/yyyy'));
                }
              }
              
              // Afficher les détails sur les dates hors période pour le débogage
              if (pastDatesOutOfRange.length > 0) {
                console.log(`[IMPORT] ATTENTION: ${pastDatesOutOfRange.length} dates passées sont en dehors de la période passée`, 
                  pastDatesOutOfRange, 
                  `Période passée: ${new Date(pastPeriod.startDate).toISOString()} - ${new Date(pastPeriod.endDate).toISOString()}`);
                
                // Pour chaque date hors plage, afficher les détails pour le débogage
                for (const dateStr of pastDatesOutOfRange) {
                  const date = new Date(dateStr);
                  console.log(`[IMPORT] Date hors plage: ${dateStr}, timestamp: ${date.getTime()}`);
                  console.log(`[IMPORT] Comparaison: date < startDate = ${date < pastPeriod.startDate}, date > endDate = ${date > pastPeriod.endDate}`);
                }
              }
              
              // IMPORTANT: Ignorer la vérification de dates pour les périodes passées
              // et sauvegarder TOUTES les gardes passées, même si certaines dates sont en dehors de la période
              
              // Créer le planning pour la période passée
              const pastPlanning: GeneratedPlanning = {
                periodId: pastPeriodId,
                assignments: pastAssignments,
                uploadedAt: new Date(),
                periods: {
                  [pastPeriodId]: {
                    assignments: pastAssignments,
                    uploadedAt: new Date(),
                    isArchived: true // Explicitement marquer comme archivée
                  }
                }
              };
              
              console.log(`[IMPORT] Sauvegarde du planning passé pour l'utilisateur ${user.lastName} (ID: ${user.id}), période ${pastPeriodId}`);
              console.log(`[IMPORT] Nombre de gardes passées: ${Object.keys(pastAssignments).length}`);
              
              // Sauvegarder dans Firebase pour la période passée
              await saveGeneratedPlanning(user.id, pastPlanning, pastPeriodId);
              
              // Notifier le composant parent de l'importation réussie
              if (onPlanningImported) {
                onPlanningImported(user.id, pastPlanning, pastPeriodId);
              }
              
              hasImportedPast = true;
              console.log(`[IMPORT] Importé ${Object.keys(pastAssignments).length} gardes passées pour ${user.lastName}`);
            }
            
            // Importer les assignments futurs
            if (Object.keys(futureAssignments).length > 0 && futurePeriodId && futurePeriod) {
              // Vérifier que toutes les dates futures sont dans la période future
              const futurePeriodStartTime = new Date(futurePeriod.startDate).getTime();
              const futurePeriodEndTime = new Date(futurePeriod.endDate).getTime();
              const futureDatesOutOfRange: string[] = [];
              
              for (const key in futureAssignments) {
                const assignment = futureAssignments[key];
                const assignmentDate = new Date(assignment.date);
                const assignmentTime = assignmentDate.getTime();
                
                if (assignmentTime < futurePeriodStartTime || assignmentTime > futurePeriodEndTime) {
                  futureDatesOutOfRange.push(format(assignmentDate, 'dd/MM/yyyy'));
                }
              }
              
              if (futureDatesOutOfRange.length === 0) {
                // Créer le planning pour la période future
                const futurePlanning: GeneratedPlanning = {
                  periodId: futurePeriodId,
                  assignments: futureAssignments,
                  uploadedAt: new Date(),
                  periods: {
                    [futurePeriodId]: {
                      assignments: futureAssignments,
                      uploadedAt: new Date(),
                      isArchived: false // Explicitement marquer comme non-archivée
                    }
                  }
                };
                
                console.log(`[IMPORT] Sauvegarde du planning futur pour l'utilisateur ${user.lastName} (ID: ${user.id}), période ${futurePeriodId}`);
                console.log(`[IMPORT] Nombre de gardes futures: ${Object.keys(futureAssignments).length}`);
                
                // Sauvegarder dans Firebase pour la période future
                await saveGeneratedPlanning(user.id, futurePlanning, futurePeriodId);
                
                // Notifier le composant parent de l'importation réussie
                if (onPlanningImported) {
                  onPlanningImported(user.id, futurePlanning, futurePeriodId);
                }
                
                hasImportedFuture = true;
                console.log(`Importé ${Object.keys(futureAssignments).length} gardes futures pour ${user.lastName}`);
              } else {
                console.warn(`${futureDatesOutOfRange.length} dates futures sont en dehors de la période future`);
              }
            }
            
            // Ajouter à la liste des importations réussies si au moins une partie a été importée
            if (hasImportedPast || hasImportedFuture) {
              successfulImports.push({
                fileName: file.name,
                user
              });
            } else {
              failedFiles.push({
                fileName: file.name,
                reason: 'Aucune date n\'a pu être importée car elles sont toutes en dehors des périodes créées'
              });
            }
          }
        } catch (err: any) {
          failedFiles.push({
            fileName: file.name,
            reason: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      // Enregistrer le résultat de l'importation
      const importResult: ImportResult = {
        successfulImports,
        failedFiles
      };
      setLastImportResult(importResult);
      
      // Notifier le composant parent du résultat complet
      if (onImportComplete) {
        onImportComplete(importResult);
      }
      
      // Construire le message de résultat
      if (successfulImports.length > 0) {
        onSuccess?.(`${successfulImports.length} plannings importés avec succès`);
      }
      
      if (failedFiles.length > 0) {
        const errorMessage = `${failedFiles.length} fichiers n'ont pas pu être importés:\n` + 
          failedFiles.map(f => `- ${f.fileName}: ${f.reason}`).join('\n');
        setError(errorMessage);
        onError?.(errorMessage);
      } else if (successfulImports.length === 0) {
        setError('Aucun fichier n\'a pu être importé');
        onError?.('Aucun fichier n\'a pu être importé');
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [
    users, 
    saveGeneratedPlanning, 
    onSuccess, 
    onError, 
    uploadPeriodId, 
    allPeriods, 
    createPeriodFromDateRange,
    setUploadPeriodId,
    refreshPeriods,
    newPeriodName,
    isBagEnabled,
    onPlanningImported,
    onImportComplete
  ]);

  return {
    isProcessing,
    error,
    handleFileUpload,
    lastImportResult
  };
};

export default useImport;
