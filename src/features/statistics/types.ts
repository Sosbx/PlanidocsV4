import type { PeriodSelection } from '../../types/planning';

export interface PeriodStats {
  unavailable: number;
  total: number;
  percentage: number;
  primary: number;
  secondary: number;
  both: number;
}

export interface DesiderataStats {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isBridgeDay: boolean;
  periods: {
    M: PeriodStats;
    AM: PeriodStats;
    S: PeriodStats;
  };
  totalUnavailable: number;
  totalUsers: number;
  overallPercentage: number;
  comments: string[];
}

export interface DoctorStats {
  userId: string;
  name: string;
  totalDesiderata: number;
  primaryCount: number;
  secondaryCount: number;
  weekendCount: number;
  holidayCount: number;
  averagePerMonth: number;
}

export interface PeriodAnalysis {
  periodId: string;
  startDate: Date;
  endDate: Date;
  associationId: string;
  totalUsers: number;
  participationRate: number;
  averageDesiderataPerUser: number;
  criticalDays: DesiderataStats[];
  holidayAnalysis: {
    christmas: { unavailable: number; percentage: number };
    newYear: { unavailable: number; percentage: number };
    otherHolidays: { date: string; name: string; unavailable: number; percentage: number }[];
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }[];
}

export type StatsFilter = {
  periodId?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  showOnlyHolidays?: boolean;
  showOnlyWeekends?: boolean;
  minPercentage?: number;
};