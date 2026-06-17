-- Enterprise scale PostgreSQL hardening
-- This migration is additive and safe for the current Prisma model.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Company
CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx" ON "Company" USING gin ("name" gin_trgm_ops);

-- User
CREATE INDEX IF NOT EXISTS "User_companyId_createdAt_idx" ON "User" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "User_clientId_idx" ON "User" ("clientId");
CREATE INDEX IF NOT EXISTS "User_company_role_idx" ON "User" ("companyId", "role");
CREATE INDEX IF NOT EXISTS "User_resetToken_notnull_idx" ON "User" ("resetToken") WHERE "resetToken" IS NOT NULL;

-- Lead
CREATE INDEX IF NOT EXISTS "Lead_companyId_status_createdAt_idx" ON "Lead" ("companyId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_companyId_active_createdAt_idx" ON "Lead" ("companyId", "createdAt" DESC) WHERE "archivedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "Lead_name_trgm_idx" ON "Lead" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_email_trgm_idx" ON "Lead" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_source_trgm_idx" ON "Lead" USING gin ("source" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_notes_trgm_idx" ON "Lead" USING gin ("notes" gin_trgm_ops);

-- Client
CREATE INDEX IF NOT EXISTS "Client_companyId_createdAt_idx" ON "Client" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Client_name_trgm_idx" ON "Client" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_email_trgm_idx" ON "Client" USING gin ("email" gin_trgm_ops);

-- Project
CREATE INDEX IF NOT EXISTS "Project_companyId_status_idx" ON "Project" ("companyId", "status");
CREATE INDEX IF NOT EXISTS "Project_companyId_createdAt_idx" ON "Project" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Project_clientId_idx" ON "Project" ("clientId");
CREATE INDEX IF NOT EXISTS "Project_name_trgm_idx" ON "Project" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Project_description_trgm_idx" ON "Project" USING gin ("description" gin_trgm_ops);

-- Task
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Task_projectId_createdAt_idx" ON "Task" ("projectId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task" ("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_projectId_assigneeId_idx" ON "Task" ("projectId", "assigneeId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_open_idx" ON "Task" ("dueDate") WHERE "status" <> 'DONE' AND "dueDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx" ON "Task" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Task_description_trgm_idx" ON "Task" USING gin ("description" gin_trgm_ops);

-- Comment
CREATE INDEX IF NOT EXISTS "Comment_taskId_createdAt_idx" ON "Comment" ("taskId", "createdAt" ASC);

-- ContactRequest
CREATE INDEX IF NOT EXISTS "ContactRequest_status_createdAt_idx" ON "ContactRequest" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ContactRequest_createdAt_idx" ON "ContactRequest" ("createdAt" DESC);

-- FreelancerProfile
CREATE INDEX IF NOT EXISTS "FreelancerProfile_createdAt_idx" ON "FreelancerProfile" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "FreelancerProfile_hourlyRate_idx" ON "FreelancerProfile" ("hourlyRate");
CREATE INDEX IF NOT EXISTS "FreelancerProfile_availability_createdAt_idx" ON "FreelancerProfile" ("availability", "createdAt" DESC);

-- FreelancerMission
CREATE INDEX IF NOT EXISTS "FreelancerMission_companyId_status_updatedAt_idx" ON "FreelancerMission" ("companyId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "FreelancerMission_companyId_createdAt_idx" ON "FreelancerMission" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "FreelancerMission_freelancerId_idx" ON "FreelancerMission" ("freelancerId");
CREATE INDEX IF NOT EXISTS "FreelancerMission_open_createdAt_idx" ON "FreelancerMission" ("createdAt" DESC) WHERE "status" = 'OPEN';

-- MissionApplication
CREATE INDEX IF NOT EXISTS "MissionApplication_missionId_createdAt_idx" ON "MissionApplication" ("missionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MissionApplication_missionId_status_idx" ON "MissionApplication" ("missionId", "status");
CREATE INDEX IF NOT EXISTS "MissionApplication_freelancerId_idx" ON "MissionApplication" ("freelancerId");

-- PortfolioItem
CREATE INDEX IF NOT EXISTS "PortfolioItem_freelancerId_createdAt_idx" ON "PortfolioItem" ("freelancerId", "createdAt" DESC);

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_unread_idx" ON "Notification" ("userId") WHERE "read" = false;

-- Document
CREATE INDEX IF NOT EXISTS "Document_companyId_createdAt_idx" ON "Document" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Document_clientId_idx" ON "Document" ("clientId");
CREATE INDEX IF NOT EXISTS "Document_projectId_idx" ON "Document" ("projectId");

-- RefreshToken
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");

-- ---------------------------------------------------------------------------
-- Archive tables: append-only cold storage, partitioned by time.
-- These tables are intentionally separate from the Prisma-managed hot tables.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "LeadArchive" (
  LIKE "Lead" INCLUDING DEFAULTS INCLUDING GENERATED
) PARTITION BY RANGE ("createdAt");

CREATE TABLE IF NOT EXISTS "ContactRequestArchive" (
  LIKE "ContactRequest" INCLUDING DEFAULTS INCLUDING GENERATED
) PARTITION BY RANGE ("createdAt");

CREATE TABLE IF NOT EXISTS "NotificationArchive" (
  LIKE "Notification" INCLUDING DEFAULTS INCLUDING GENERATED
) PARTITION BY RANGE ("createdAt");

CREATE TABLE IF NOT EXISTS "DocumentArchive" (
  LIKE "Document" INCLUDING DEFAULTS INCLUDING GENERATED
) PARTITION BY RANGE ("createdAt");

-- Default future partitions can be created by the maintenance job if needed.
-- Example monthly partitions for the current year can be added by the DBA/job runner.

CREATE INDEX IF NOT EXISTS "LeadArchive_companyId_createdAt_idx" ON "LeadArchive" ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadArchive_status_createdAt_idx" ON "LeadArchive" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ContactRequestArchive_status_createdAt_idx" ON "ContactRequestArchive" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationArchive_userId_createdAt_idx" ON "NotificationArchive" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentArchive_companyId_createdAt_idx" ON "DocumentArchive" ("companyId", "createdAt" DESC);
