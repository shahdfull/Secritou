export const cacheKeys = {
  dashboardSummary: (companyId: string) => `cache:dashboard:summary:${companyId}`,
  authMe: (userId: string) => `cache:auth:me:${userId}`,
};

export const cacheTags = {
  company: (companyId: string) => `tag:company:${companyId}`,
  dashboard: (companyId: string) => `tag:dashboard:${companyId}`,
};
