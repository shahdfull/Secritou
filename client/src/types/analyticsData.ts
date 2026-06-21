export interface LeadStats {
  total: number;
  byStatus: { status: string; count: number }[];
  wonCount: number;
  conversionRate: number;
  previousConversionRate?: number;
}

export interface ClientStats {
  total: number;
  newThisMonth: number;
  previousNew?: number;
}

export interface ProjectStats {
  total: number;
  byStatus: { status: string; count: number }[];
  completedCount: number;
  completionRate: number;
  previousCompletionRate?: number;
}

export interface TaskStats {
  total: number;
  doneCount: number;
  overdueCount: number;
  taskDonePct?: number;
  previousTaskDonePct?: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface ProjectStatusCount {
  status: string;
  count: number;
  color: string;
}

export interface AnalyticsSummary {
  leads: LeadStats;
  clients: ClientStats;
  projects: ProjectStats;
  tasks: TaskStats;
  leadsByMonth: MonthlyCount[];
  projectsByStatus: ProjectStatusCount[];
  revenueByMonth: MonthlyRevenue[];
}
