-- Performance indexes and pg_trgm for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Analytics date-range indexes (also declared in schema.prisma)
CREATE INDEX IF NOT EXISTS "Lead_companyId_createdAt_idx" ON "Lead" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Client_companyId_createdAt_idx" ON "Client" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Project_companyId_createdAt_idx" ON "Project" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "FreelancerMission_company_status_updated_idx" ON "FreelancerMission" ("companyId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ServiceRequest_companyId_createdAt_idx" ON "ServiceRequest" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Document_companyId_createdAt_idx" ON "Document" ("companyId", "createdAt" DESC);

-- Task progress & overdue partial index
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Task_overdue_partial_idx" ON "Task" ("dueDate", "status")
  WHERE status != 'DONE' AND "dueDate" IS NOT NULL;

-- Auth & notifications
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");
CREATE INDEX IF NOT EXISTS "User_resetToken_idx" ON "User" ("resetToken");
CREATE INDEX IF NOT EXISTS "User_companyId_role_idx" ON "User" ("companyId", "role");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MissionApplication_missionId_status_idx" ON "MissionApplication" ("missionId", "status");
CREATE INDEX IF NOT EXISTS "ContactRequest_status_createdAt_idx" ON "ContactRequest" ("status", "createdAt" DESC);

-- Full-text search (trigram)
CREATE INDEX IF NOT EXISTS "Lead_name_trgm_idx" ON "Lead" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_email_trgm_idx" ON "Lead" USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_name_trgm_idx" ON "Client" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_email_trgm_idx" ON "Client" USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Project_name_trgm_idx" ON "Project" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx" ON "Task" USING gin (title gin_trgm_ops);
