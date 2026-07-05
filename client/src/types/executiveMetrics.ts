export interface FinanceKPIs {
  cashMTD: number;
  cashYTD: number;
  cashTotal: number;
  billedMTD: number;
  billedYTD: number;
  billedTotal: number;
  overdueAmount: number;
  overdueCount: number;
  pendingAmount: number;
  pendingCount: number;
  cashGrowthMoM: number;
  cashGrowthYoY: number;
  cashByMonth: Array<{ month: string; cash: number; billed: number }>;
}

export interface ForecastKPIs {
  next30: number;
  next60: number;
  next90: number;
  overdueCarryover: number;
  proposalPipeline: number;
  conversionRate: number;
  confidenceScore: number;
}

export interface ClientKPIs {
  total: number;
  active: number;
  newMTD: number;
  newGrowthMoM: number;
  atRisk: number;
  lost: number;
  champions: number;
  churnRate: number;
  retentionRate: number;
  topClients: Array<{
    id: string;
    name: string;
    revenue: number;
    projects: number;
    health: string;
  }>;
}

export interface ProjectKPIs {
  total: number;
  planning: number;
  inProgress: number;
  review: number;
  completed: number;
  overdue: number;
  stale: number;
  blocked: number;
  criticalCount: number;
  watchCount: number;
  completionRate: number;
  avgDurationDays: number;
  tasksDone: number;
  tasksTotal: number;
  tasksOverdue: number;
}

export interface RiskItem {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  subtitle: string;
  link: string;
  entityId: string;
  daysAgo?: number;
}

export interface ExecutiveMetrics {
  generatedAt: string;
  finance: FinanceKPIs;
  forecast: ForecastKPIs;
  clients: ClientKPIs;
  projects: ProjectKPIs;
  risks: RiskItem[];
  alerts: {
    overdueInvoices: number;
    pendingApprovals: number;
    criticalProjects: number;
    hotLeads: number;
    expiringContracts: number;
  };
}
