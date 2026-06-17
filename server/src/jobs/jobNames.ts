export const queueNames = {
  communication: "communication",
  maintenance: "maintenance",
} as const;

export const jobNames = {
  sendNotification: "send-notification",
  cleanupRefreshTokens: "cleanup-refresh-tokens",
  archiveColdData: "archive-cold-data",
  warmDashboardSummaries: "warm-dashboard-summaries",
} as const;
