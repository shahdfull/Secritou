export const cacheKeys = {
  dashboardSummary: (companyId: string) => `cache:dashboard:summary:${companyId}`,
  clientSummary: (companyId: string, clientId: string) => `cache:client:summary:${companyId}:${clientId}`,
  projectSummary: (companyId: string, projectId: string) => `cache:project:summary:${companyId}:${projectId}`,
  successSummary: (companyId: string, clientId: string) => `cache:success:summary:${companyId}:${clientId}`,
  onboardingSummary: (companyId: string, clientId: string) => `cache:onboarding:summary:${companyId}:${clientId}`,
  authMe: (userId: string) => `cache:auth:me:${userId}`,
  managerPermissions: (userId: string) => `cache:manager:permissions:${userId}`,
};

export const cacheTags = {
  company: (companyId: string) => `tag:company:${companyId}`,
  dashboard: (companyId: string) => `tag:dashboard:${companyId}`,
  client: (companyId: string, clientId: string) => `tag:client:${companyId}:${clientId}`,
  project: (companyId: string, projectId: string) => `tag:project:${companyId}:${projectId}`,
  success: (companyId: string, clientId: string) => `tag:success:${companyId}:${clientId}`,
  onboarding: (companyId: string, clientId: string) => `tag:onboarding:${companyId}:${clientId}`,
};
