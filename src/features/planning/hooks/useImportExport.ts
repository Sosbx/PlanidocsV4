import { User } from '../../../types/users';
import { createParisDate } from '@/utils/timezoneUtils';
import { ShiftAssignment, GeneratedPlanning, PlanningPeriod } from '../../../types/planning';
import useImport, { ImportResult } from './useImport';
import useExport from './useExport';

/**
 * Interface pour le résultat du hook useImportExport
 */
interface UseImportExportResult {
  isProcessing: boolean;
  error: string | null;
  handleFileUpload: (files: File[]) => Promise<void>;
  handleExportPDF: (userId?: string, includeDesiderata?: boolean, customStartDate?: Date, customEndDate?: Date) => Promise<void>;
  handleExportCSV: (userId?: string) => Promise<void>;
  handleExportAllPDF: (includeDesiderata?: boolean, customStartDate?: Date, customEndDate?: Date) => Promise<void>;
  handleExportAllCSV: () => Promise<void>;
  lastImportResult: ImportResult | null;
}

/**
 * Interface pour les options du hook useImportExport
 */
interface UseImportExportOptions {
  uploadPeriodId: string;
  users: User[];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  saveGeneratedPlanning?: (userId: string, planning: GeneratedPlanning, periodId: string) => Promise<void>;
  loadExporters?: () => Promise<{
    toPdf: (assignments: Record<string, ShiftAssignment>, userName: string, startDate: Date, endDate: Date) => Promise<void>;
    toCsv: (assignments: Record<string, ShiftAssignment>, userName: string) => Promise<void>;
    allToPdf: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date, endDate: Date) => Promise<void>;
    allToCsv: (users: User[], planningsMap: Record<string, Record<string, ShiftAssignment>>, startDate: Date) => Promise<void>;
  }>;
  plannings?: Record<string, Record<string, GeneratedPlanning>>;
  startDate?: Date;
  endDate?: Date;
  onPlanningImported?: (userId: string, planning: GeneratedPlanning, periodId: string) => void;
  allPeriods?: PlanningPeriod[];
  createPlanningPeriod?: (period: Omit<PlanningPeriod, 'id'>) => Promise<string>;
  setUploadPeriodId?: (id: string) => void;
  refreshPeriods?: () => Promise<void>;
  newPeriodName?: string;
  isBagEnabled?: boolean;
  onImportComplete?: (result: ImportResult) => void;
}

/**
 * Hook personnalisé pour gérer l'import et l'export des plannings
 * Version refactorisée qui utilise les hooks spécialisés
 */
export const useImportExport = ({
  uploadPeriodId,
  users,
  onSuccess,
  onError,
  saveGeneratedPlanning,
  loadExporters,
  plannings,
  startDate = createParisDate(),
  endDate = new Date(createParisDate().setMonth(createParisDate().getMonth() + 3)),
  onPlanningImported,
  allPeriods = [],
  createPlanningPeriod,
  setUploadPeriodId,
  refreshPeriods,
  newPeriodName = '',
  isBagEnabled = true,
  onImportComplete
}: UseImportExportOptions): UseImportExportResult => {
  // Utiliser le hook d'importation
  const { 
    isProcessing: isImportProcessing, 
    error, 
    handleFileUpload,
    lastImportResult
  } = useImport({
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
    newPeriodName,
    isBagEnabled,
    onImportComplete
  });

  // Utiliser le hook d'exportation
  const { 
    isProcessing: isExportProcessing,
    handleExportPDF,
    handleExportCSV,
    handleExportAllPDF,
    handleExportAllCSV
  } = useExport({
    users,
    loadExporters,
    plannings,
    startDate,
    endDate,
    onSuccess,
    onError
  });

  // Combiner l'état de traitement des deux hooks
  const isProcessing = isImportProcessing || isExportProcessing;

  return {
    isProcessing,
    error,
    handleFileUpload,
    handleExportPDF,
    handleExportCSV,
    handleExportAllPDF,
    handleExportAllCSV,
    lastImportResult
  };
};

export default useImportExport;
