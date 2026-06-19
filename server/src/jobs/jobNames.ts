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
} as const;
