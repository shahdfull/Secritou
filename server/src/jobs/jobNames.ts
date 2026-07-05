export const queueNames = {
  communication: "communication",
  maintenance: "maintenance",
} as const;

export const jobNames = {
  sendNotification: "send-notification",
  sendEmail: "send-email",
  cleanupRefreshTokens: "cleanup-refresh-tokens",
  archiveColdData: "archive-cold-data",
  warmDashboardSummaries: "warm-dashboard-summaries",
  recalculateClientScores: "recalculate-client-scores",
  expireProposals: "expire-proposals",
  markOverdueInvoices: "mark-overdue-invoices",
  checkStaleProjects: "check-stale-projects",
  checkOverdueDeadlines: "check-overdue-deadlines",
  checkInvoiceFollowup: "check-invoice-followup",
  weeklyCeoReport: "weekly-ceo-report",
  checkTaskDeadlines: "check-task-deadlines",
} as const;
