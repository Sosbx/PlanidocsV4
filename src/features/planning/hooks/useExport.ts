import { useState, useCallback } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { User } from '../../../types/users';
import { ShiftAssignment, GeneratedPlanning, PeriodSelection } from '../../../types/planning';
import { getAllDesiderata } from '../../../lib/firebase/desiderata';
import { useAssociation } from '../../../context/association/AssociationContext';

interface UseExportOptions {
  users: User[];
  loadExporters?: () => Promise<{
    toPdf: (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date, desiderata?: Record<string, 'primary' | 'secondary' | null | PeriodSelection>, showAssignmentsOnly?: boolean) => Promise<void>;
    toCsv: (assignments: Record<string, ShiftAssignment>, userName: string) => Promise<void>;
    allToPdf: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date, desiderataMap?: Record<string, Record<string, 'primary' | 'secondary' | null | PeriodSelection>>, showAssignmentsOnly?: boolean) => Promise<void>;
    allToCsv: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => Promise<void>;
  }>;
  plannings?: Record<string, Record<string, GeneratedPlanning>>;
  startDate?: Date;
  endDate?: Date;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const useExport = ({
  users,
  loadExporters,
  plannings,
  startDate = createParisDate(),
  endDate = new Date(createParisDate().setMonth(createParisDate().getMonth() + 3)),
  onSuccess,
  onError
}: UseExportOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { currentAssociation } = useAssociation();

  /**
   * Exporte le planning d'un utilisateur en PDF
   */
  const handleExportPDF = useCallback(async (
    userId?: string, 
    includeDesiderata: boolean = false,
    customStartDate?: Date,
    customEndDate?: Date
  ) => {
    if (!loadExporters) {
      onError?.('Fonction d\'export non disponible');
      return;
    }
    
    if (!plannings || !userId) {
      onError?.('Aucun planning disponible à exporter');
      return;
    }
    
    try {
      setIsProcessing(true);
      onSuccess?.('Préparation de l\'export PDF...');
      
      // Trouver le planning de l'utilisateur
      let userPlanning: Record<string, ShiftAssignment> | null = null;
      let userName = '';
      
      // Chercher dans toutes les périodes
      for (const periodId in plannings) {
        const userPlanningForPeriod = plannings[periodId][userId];
        if (userPlanningForPeriod && userPlanningForPeriod.assignments) {
          userPlanning = userPlanningForPeriod.assignments;
          const user = users.find(u => u.id === userId);
          if (user) {
            userName = `${user.lastName} ${user.firstName}`;
          } else {
            userName = userId;
          }
          break;
        }
      }
      
      if (!userPlanning) {
        onError?.('Planning non trouvé pour cet utilisateur');
        setIsProcessing(false);
        return;
      }
      
      // Charger dynamiquement les exporteurs
      const exporters = await loadExporters();
      
      // Récupérer les desiderata si demandé
      let userDesiderata = undefined;
      if (includeDesiderata && currentAssociation) {
        try {
          // getAllDesiderata retourne les desiderata d'un seul utilisateur
          const desiderataData = await getAllDesiderata(
            userId,
            true, // includeArchived
            false, // currentPeriodOnly
            currentAssociation.id
          );
          
          // Convertir en format attendu par exportPlanningToPDF
          if (desiderataData?.selections) {
            userDesiderata = {};
            Object.entries(desiderataData.selections).forEach(([key, value]) => {
              if (value && typeof value === 'object' && 'type' in value) {
                userDesiderata[key] = value.type;
              } else if (value === 'primary' || value === 'secondary' || value === null) {
                userDesiderata[key] = value;
              }
            });
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des desiderata:', error);
        }
      }
      
      // Exporter en PDF avec ou sans desiderata
      await exporters.toPdf(
        userPlanning,
        userName,
        customStartDate || startDate,
        customEndDate || endDate,
        userDesiderata,
        !includeDesiderata // showAssignmentsOnly est l'inverse de includeDesiderata
      );
      
      onSuccess?.('Export PDF réussi');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error exporting to PDF:', error);
      onError?.(`Erreur lors de l'export PDF: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [loadExporters, plannings, users, startDate, endDate, onSuccess, onError, currentAssociation]);

  /**
   * Exporte le planning d'un utilisateur en CSV
   */
  const handleExportCSV = useCallback(async (userId?: string) => {
    if (!loadExporters) {
      onError?.('Fonction d\'export non disponible');
      return;
    }
    
    if (!plannings || !userId) {
      onError?.('Aucun planning disponible à exporter');
      return;
    }
    
    try {
      setIsProcessing(true);
      onSuccess?.('Préparation de l\'export CSV...');
      
      // Trouver le planning de l'utilisateur
      let userPlanning: Record<string, ShiftAssignment> | null = null;
      let userName = '';
      
      // Chercher dans toutes les périodes
      for (const periodId in plannings) {
        const userPlanningForPeriod = plannings[periodId][userId];
        if (userPlanningForPeriod && userPlanningForPeriod.assignments) {
          userPlanning = userPlanningForPeriod.assignments;
          const user = users.find(u => u.id === userId);
          if (user) {
            userName = `${user.lastName} ${user.firstName}`;
          } else {
            userName = userId;
          }
          break;
        }
      }
      
      if (!userPlanning) {
        onError?.('Planning non trouvé pour cet utilisateur');
        setIsProcessing(false);
        return;
      }
      
      // Charger dynamiquement les exporteurs
      const exporters = await loadExporters();
      
      // Exporter en CSV
      await exporters.toCsv(userPlanning, userName);
      
      onSuccess?.('Export CSV réussi');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error exporting to CSV:', error);
      onError?.(`Erreur lors de l'export CSV: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [loadExporters, plannings, users, onSuccess, onError]);

  /**
   * Exporte tous les plannings en PDF
   */
  const handleExportAllPDF = useCallback(async (
    includeDesiderata: boolean = false,
    customStartDate?: Date,
    customEndDate?: Date
  ) => {
    if (!loadExporters) {
      onError?.('Fonction d\'export non disponible');
      return;
    }
    
    if (!plannings) {
      onError?.('Aucun planning disponible à exporter');
      return;
    }
    
    try {
      setIsProcessing(true);
      onSuccess?.('Préparation de l\'export PDF...');
      
      // Sélectionner la période active ou la première période
      const selectedPeriodId = Object.keys(plannings)[0];
      
      if (!selectedPeriodId || !plannings[selectedPeriodId]) {
        onError?.('Aucune période sélectionnée ou aucun planning disponible pour cette période');
        setIsProcessing(false);
        return;
      }
      
      const planningsForPeriod = plannings[selectedPeriodId];
      
      // Filtrer les utilisateurs qui ont un planning dans cette période
      const usersWithPlannings = users.filter(user => {
        const userPlanning = planningsForPeriod[user.id];
        return userPlanning && 
          userPlanning.assignments && 
          Object.keys(userPlanning.assignments).length > 0;
      });

      if (usersWithPlannings.length === 0) {
        onError?.('Aucun planning à exporter pour cette période');
        setIsProcessing(false);
        return;
      }

      // Créer la map des plannings en s'assurant que chaque entrée est définie
      const planningsMap: Record<string, Record<string, ShiftAssignment>> = {};
      
      usersWithPlannings.forEach(user => {
        const userPlanning = planningsForPeriod[user.id];
        if (userPlanning && userPlanning.assignments) {
          planningsMap[user.id] = userPlanning.assignments;
        }
      });
      
      // Charger dynamiquement les exporteurs
      const exporters = await loadExporters();
      
      // Récupérer les desiderata si demandé
      let desiderataMap = undefined;
      if (includeDesiderata && currentAssociation) {
        try {
          // Récupérer les desiderata pour chaque utilisateur individuellement
          desiderataMap = {};
          
          for (const user of usersWithPlannings) {
            try {
              const desiderataData = await getAllDesiderata(
                user.id,
                true, // includeArchived
                false, // currentPeriodOnly
                currentAssociation.id
              );
              
              // Convertir en format attendu par exportPlanningToPDF
              if (desiderataData?.selections) {
                const userDesiderata = {};
                Object.entries(desiderataData.selections).forEach(([key, value]) => {
                  if (value && typeof value === 'object' && 'type' in value) {
                    userDesiderata[key] = value.type;
                  } else if (value === 'primary' || value === 'secondary' || value === null) {
                    userDesiderata[key] = value;
                  }
                });
                desiderataMap[user.id] = userDesiderata;
              }
            } catch (userError) {
              console.error(`Erreur lors de la récupération des desiderata pour ${user.id}:`, userError);
              // Continuer avec les autres utilisateurs
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des desiderata:', error);
        }
      }
      
      // Exporter tous les PDF avec ou sans desiderata
      await exporters.allToPdf(
        usersWithPlannings,
        planningsMap,
        customStartDate || startDate,
        customEndDate || endDate,
        desiderataMap,
        !includeDesiderata // showAssignmentsOnly est l'inverse de includeDesiderata
      );
      
      onSuccess?.('Export PDF réussi');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error exporting all PDFs:', error);
      onError?.(`Erreur lors du téléchargement des PDFs: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [loadExporters, plannings, users, startDate, endDate, onSuccess, onError, currentAssociation]);

  /**
   * Exporte tous les plannings en CSV
   */
  const handleExportAllCSV = useCallback(async () => {
    if (!loadExporters) {
      onError?.('Fonction d\'export non disponible');
      return;
    }
    
    if (!plannings) {
      onError?.('Aucun planning disponible à exporter');
      return;
    }
    
    try {
      setIsProcessing(true);
      onSuccess?.('Préparation de l\'export CSV...');
      
      // Sélectionner la période active ou la première période
      const selectedPeriodId = Object.keys(plannings)[0];
      
      if (!selectedPeriodId || !plannings[selectedPeriodId]) {
        onError?.('Aucune période sélectionnée ou aucun planning disponible pour cette période');
        setIsProcessing(false);
        return;
      }
      
      const planningsForPeriod = plannings[selectedPeriodId];
      
      // Filtrer les utilisateurs qui ont un planning dans cette période
      const usersWithPlannings = users.filter(user => {
        const userPlanning = planningsForPeriod[user.id];
        return userPlanning && 
          userPlanning.assignments && 
          Object.keys(userPlanning.assignments).length > 0;
      });

      if (usersWithPlannings.length === 0) {
        onError?.('Aucun planning à exporter pour cette période');
        setIsProcessing(false);
        return;
      }

      // Créer la map des plannings en s'assurant que chaque entrée est définie
      const planningsMap: Record<string, Record<string, ShiftAssignment>> = {};
      
      usersWithPlannings.forEach(user => {
        const userPlanning = planningsForPeriod[user.id];
        if (userPlanning && userPlanning.assignments) {
          planningsMap[user.id] = userPlanning.assignments;
        }
      });
      
      // Charger dynamiquement les exporteurs
      const exporters = await loadExporters();
      
      // Exporter tous les CSV
      await exporters.allToCsv(
        usersWithPlannings,
        planningsMap,
        startDate
      );
      
      onSuccess?.('Export CSV réussi');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error exporting all CSVs:', error);
      onError?.(`Erreur lors du téléchargement des CSVs: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [loadExporters, plannings, users, startDate, onSuccess, onError]);

  return {
    isProcessing,
    handleExportPDF,
    handleExportCSV,
    handleExportAllPDF,
    handleExportAllCSV
  };
};

export default useExport;
