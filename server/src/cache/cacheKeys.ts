import { COMPANY_ID } from "../config/constants.js";

export const cacheKeys = {
  dashboardSummary: (serviceId?: string | null) =>
    serviceId !== undefined
      ? `cache:dashboard:summary:${COMPANY_ID}:${serviceId ?? "__none__"}`
      : `cache:dashboard:summary:${COMPANY_ID}`,
  clientSummary: (clientId: string) => `cache:client:summary:${COMPANY_ID}:${clientId}`,
  projectSummary: (projectId: string) => `cache:project:summary:${COMPANY_ID}:${projectId}`,
  successSummary: (clientId: string) => `cache:success:summary:${COMPANY_ID}:${clientId}`,
  onboardingSummary: (clientId: string) => `cache:onboarding:summary:${COMPANY_ID}:${clientId}`,
  authMe: (userId: string) => `cache:auth:me:${userId}`,
  managerPermissions: (userId: string) => `cache:manager:permissions:${userId}`,
  // AI tool-call reads (aiTools.ts) are cached per (tool name, args, caller scope) — scope is
  // included so a MANAGER's cached result is never served to a different pole, and ADMIN/MANAGER
  // results never collide with each other even for the same tool+args. argsKey must be a stable,
  // deterministic serialization of the tool's parsed args (sorted keys) — see aiToolCache.ts.
  aiToolResult: (toolName: string, argsKey: string, scopeKey: string) =>
    `cache:ai:tool:${COMPANY_ID}:${toolName}:${scopeKey}:${argsKey}`,
};

export const cacheTags = {
  company: () => `tag:company:${COMPANY_ID}`,
  dashboard: () => `tag:dashboard:${COMPANY_ID}`,
  client: (clientId: string) => `tag:client:${COMPANY_ID}:${clientId}`,
  project: (projectId: string) => `tag:project:${COMPANY_ID}:${projectId}`,
  success: (clientId: string) => `tag:success:${COMPANY_ID}:${clientId}`,
  onboarding: (clientId: string) => `tag:onboarding:${COMPANY_ID}:${clientId}`,
};
