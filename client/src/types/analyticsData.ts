export interface LeadStats {
  total: number;
  byStatus: { status: string; count: number }[];
  wonCount: number;
  conversionRate: number;
}

export interface ClientStats {
  total: number;
  newThisMonth: number;
}

export interface ProjectStats {
  total: number;
  byStatus: { status: string; count: number }[];
  completedCount: number;
  completionRate: number;
}

export interface TaskStats {
  total: number;
  doneCount: number;
  overdueCount: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
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
}
