import { FirestoreDocument } from './IRepository';
import { PlanningConfig, PlanningPeriod, GeneratedPlanning } from '../../types/planning';

export interface ArchivedPeriod {
  id: string;
  config: PlanningConfig;
  archivedAt: Date;
  name: string;
  validatedDesiderataCount: number;
  associationId: string;
}

export interface SimplePlanningPeriod {
  startDate: Date;
  endDate: Date;
}

export interface IPlanningRepository {
  // Config
  getConfig(associationId: string): Promise<PlanningConfig | null>;
  updateConfig(associationId: string, config: PlanningConfig): Promise<void>;
  deleteConfig(associationId: string): Promise<void>;
  subscribeToConfig(associationId: string, callback: (config: PlanningConfig | null) => void): () => void;
  
  // Archived periods
  getArchivedPeriods(associationId: string): Promise<ArchivedPeriod[]>;
  archivePeriod(
    associationId: string,
    config: PlanningConfig,
    validatedDesiderata: Record<string, any>,
    periodName: string,
    totalUsers: number
  ): Promise<string>;
  
  // Planning periods
  getPlanningPeriods(associationId: string): Promise<PlanningPeriod[]>;
  createPlanningPeriod(period: Omit<PlanningPeriod, 'id'>, associationId: string): Promise<string>;
  updatePlanningPeriod(periodId: string, updates: Partial<PlanningPeriod>, associationId: string): Promise<void>;
  deletePlanningPeriod(periodId: string, associationId: string): Promise<void>;
  validateBagAndMergePeriods(futurePeriodId: string, associationId: string): Promise<void>;
  subscribeToPeriodsConfig(associationId: string, callback: (data: { currentPeriod?: SimplePlanningPeriod; futurePeriod?: SimplePlanningPeriod | null }) => void): () => void;
  subscribeToPlanningPeriods(associationId: string, callback: (periods: PlanningPeriod[]) => void): () => void;
  
  // Generated planning
  saveGeneratedPlanning(userId: string, planning: GeneratedPlanning, periodId?: string, associationId?: string): Promise<void>;
  getGeneratedPlanning(userId: string, periodId?: string, associationId?: string): Promise<GeneratedPlanning | null>;
  
  // Assignments
  getAssignmentsByDate(date: string, associationId: string): Promise<Record<string, any>>;
  
  // Reset
  resetPlanningForAssociation(associationId: string): Promise<void>;
}