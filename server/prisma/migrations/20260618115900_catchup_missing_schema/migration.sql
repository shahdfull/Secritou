-- =============================================================================
-- CATCH-UP MIGRATION: Add all schema objects missing from migration history
-- Must run BEFORE 20260618120000_add_file_keys which references FreelancerApplication
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New enum types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'SIGNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SpecApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMMENTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnhancedDocumentType" AS ENUM ('CONTRACT', 'DELIVERABLE', 'GUIDE', 'REPORT', 'INVOICE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentAccessLevel" AS ENUM ('ADMIN_ONLY', 'ADMIN_FREELANCER', 'CLIENT_ADMIN', 'ALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend ServiceRequestStatus with missing values
DO $$ BEGIN
  ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'WAITING_CLIENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Missing columns on existing tables
-- ---------------------------------------------------------------------------

-- User: mustChangePassword
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- User: resetToken (may already exist from migration 2)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "resetToken" VARCHAR(255);

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMPTZ(6);

-- Company: branding columns (may already exist from migration 6)
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "logoUrl" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "primaryColor" VARCHAR(20);

-- Lead: archival columns (may already exist from migration 8)
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "convertedClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(6);

-- ---------------------------------------------------------------------------
-- 2b. Deduplicate before adding unique constraints
-- ---------------------------------------------------------------------------

-- Remove duplicate Clients: keep the oldest row per (companyId, email) pair
DELETE FROM "Client" c1
USING "Client" c2
WHERE c1."companyId" = c2."companyId"
  AND c1.email IS NOT NULL
  AND c1.email = c2.email
  AND c1."createdAt" > c2."createdAt";

-- Remove duplicate Leads: keep the oldest row per (companyId, email) pair
DELETE FROM "Lead" l1
USING "Lead" l2
WHERE l1."companyId" = l2."companyId"
  AND l1.email IS NOT NULL
  AND l1.email = l2.email
  AND l1."createdAt" > l2."createdAt";

-- Client: unique constraint on (companyId, email)
DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_email_key" UNIQUE ("companyId", "email");
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

-- Lead: unique constraint on (companyId, email)
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_email_key" UNIQUE ("companyId", "email");
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

-- RefreshToken: familyId column
ALTER TABLE "RefreshToken"
  ADD COLUMN IF NOT EXISTS "familyId" VARCHAR(36);

-- Back-fill familyId for any existing rows (use id as stand-in family)
UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "RefreshToken"
  ALTER COLUMN "familyId" SET NOT NULL;

-- ServiceRequest: assignedToId and priority (schema has these, migrations don't)
ALTER TABLE "ServiceRequest"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL';

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. FreelancerApplication table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "FreelancerApplication" (
    "id"              TEXT NOT NULL,
    "firstName"       VARCHAR(255) NOT NULL,
    "lastName"        VARCHAR(255) NOT NULL,
    "email"           VARCHAR(255) NOT NULL,
    "phone"           VARCHAR(50),
    "position"        VARCHAR(255) NOT NULL,
    "cvUrl"           VARCHAR(500) NOT NULL,
    "portfolioUrl"    VARCHAR(500) NOT NULL,
    "status"          "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "userId"          TEXT,
    "accountCreatedAt" TIMESTAMPTZ(6),
    "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreelancerApplication_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FreelancerApplication" ADD CONSTRAINT "FreelancerApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "FreelancerApplication_email_idx"  ON "FreelancerApplication"("email");
CREATE INDEX IF NOT EXISTS "FreelancerApplication_status_idx" ON "FreelancerApplication"("status");
CREATE INDEX IF NOT EXISTS "FreelancerApplication_createdAt_idx" ON "FreelancerApplication"("createdAt");
CREATE INDEX IF NOT EXISTS "FreelancerApplication_status_createdAt_idx" ON "FreelancerApplication"("status", "createdAt");

-- ---------------------------------------------------------------------------
-- 4. ClientOnboarding & related tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ClientOnboarding" (
    "id"             TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "clientId"       TEXT NOT NULL,
    "companyId"      TEXT NOT NULL,
    "assignedUserId" TEXT,
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_projectId_key" UNIQUE ("projectId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ClientOnboarding_projectId_idx"  ON "ClientOnboarding"("projectId");
CREATE INDEX IF NOT EXISTS "ClientOnboarding_clientId_idx"   ON "ClientOnboarding"("clientId");
CREATE INDEX IF NOT EXISTS "ClientOnboarding_companyId_idx"  ON "ClientOnboarding"("companyId");

CREATE TABLE IF NOT EXISTS "OnboardingStep" (
    "id"           TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "stepType"     VARCHAR(100) NOT NULL,
    "title"        VARCHAR(255) NOT NULL,
    "description"  TEXT,
    "status"       "OnboardingStepStatus" NOT NULL DEFAULT 'PENDING',
    "orderIndex"   INTEGER NOT NULL DEFAULT 0,
    "deadline"     TIMESTAMPTZ(6),
    "completedAt"  TIMESTAMPTZ(6),
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_onboardingId_fkey"
    FOREIGN KEY ("onboardingId") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OnboardingStep_onboardingId_idx"             ON "OnboardingStep"("onboardingId");
CREATE INDEX IF NOT EXISTS "OnboardingStep_onboardingId_orderIndex_idx"  ON "OnboardingStep"("onboardingId", "orderIndex");

CREATE TABLE IF NOT EXISTS "Contract" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "contractUrl"      VARCHAR(500),
    "status"           "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt"         TIMESTAMPTZ(6),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Contract" ADD CONSTRAINT "Contract_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Contract" ADD CONSTRAINT "Contract_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Payment" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "amount"           DECIMAL(10,2),
    "amountPaid"       DECIMAL(10,2),
    "status"           "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "deadline"         TIMESTAMPTZ(6),
    "paidAt"           TIMESTAMPTZ(6),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Questionnaire" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "serviceType"      VARCHAR(100) NOT NULL,
    "data"             JSONB,
    "isDraft"          BOOLEAN NOT NULL DEFAULT true,
    "submittedAt"      TIMESTAMPTZ(6),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Specifications" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "requirements"     TEXT,
    "objectives"       TEXT,
    "features"         TEXT,
    "deliverables"     TEXT,
    "timeline"         TEXT,
    "approvalStatus"   "SpecApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "feedback"         TEXT,
    "approvedAt"       TIMESTAMPTZ(6),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specifications_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Specifications" ADD CONSTRAINT "Specifications_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Specifications" ADD CONSTRAINT "Specifications_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "KickoffMeeting" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "meetingDate"      TIMESTAMPTZ(6),
    "participants"     TEXT,
    "meetingLink"      VARCHAR(500),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KickoffMeeting_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductionProgress" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "analysis"         INTEGER NOT NULL DEFAULT 0,
    "design"           INTEGER NOT NULL DEFAULT 0,
    "development"      INTEGER NOT NULL DEFAULT 0,
    "testing"          INTEGER NOT NULL DEFAULT 0,
    "deployment"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionProgress_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ProductionProgress" ADD CONSTRAINT "ProductionProgress_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionProgress" ADD CONSTRAINT "ProductionProgress_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Delivery" (
    "id"               TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "deliverables"     TEXT,
    "documentation"    VARCHAR(500),
    "accessDetails"    TEXT,
    "userGuides"       VARCHAR(500),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_onboardingStepId_key" UNIQUE ("onboardingStepId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_onboardingStepId_fkey"
    FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5. Proposal Center
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Proposal" (
    "id"          TEXT NOT NULL,
    "title"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status"      "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "amount"      DECIMAL(12,2),
    "currency"    VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "expiresAt"   TIMESTAMPTZ(6),
    "viewedAt"    TIMESTAMPTZ(6),
    "acceptedAt"  TIMESTAMPTZ(6),
    "rejectedAt"  TIMESTAMPTZ(6),
    "pdfUrl"      VARCHAR(500),
    "clientId"    TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "projectId"   TEXT,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Proposal_clientId_idx"         ON "Proposal"("clientId");
CREATE INDEX IF NOT EXISTS "Proposal_companyId_idx"        ON "Proposal"("companyId");
CREATE INDEX IF NOT EXISTS "Proposal_status_idx"           ON "Proposal"("status");
CREATE INDEX IF NOT EXISTS "Proposal_expiresAt_idx"        ON "Proposal"("expiresAt");
CREATE INDEX IF NOT EXISTS "Proposal_createdAt_idx"        ON "Proposal"("createdAt");
CREATE INDEX IF NOT EXISTS "Proposal_companyId_status_idx" ON "Proposal"("companyId", "status");

CREATE TABLE IF NOT EXISTS "ProposalSection" (
    "id"         TEXT NOT NULL,
    "title"      VARCHAR(255) NOT NULL,
    "content"    TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "proposalId" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ProposalSection_proposalId_idx"            ON "ProposalSection"("proposalId");
CREATE INDEX IF NOT EXISTS "ProposalSection_proposalId_orderIndex_idx" ON "ProposalSection"("proposalId", "orderIndex");

CREATE TABLE IF NOT EXISTS "ProposalHistory" (
    "id"         TEXT NOT NULL,
    "action"     VARCHAR(100) NOT NULL,
    "comment"    TEXT,
    "userId"     TEXT,
    "proposalId" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalHistory_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ProposalHistory" ADD CONSTRAINT "ProposalHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProposalHistory" ADD CONSTRAINT "ProposalHistory_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ProposalHistory_proposalId_idx"           ON "ProposalHistory"("proposalId");
CREATE INDEX IF NOT EXISTS "ProposalHistory_proposalId_createdAt_idx" ON "ProposalHistory"("proposalId", "createdAt");

-- ---------------------------------------------------------------------------
-- 6. Approval Center
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Approval" (
    "id"          TEXT NOT NULL,
    "title"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status"      "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate"     TIMESTAMPTZ(6),
    "clientId"    TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "projectId"   TEXT,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Approval" ADD CONSTRAINT "Approval_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Approval" ADD CONSTRAINT "Approval_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Approval" ADD CONSTRAINT "Approval_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Approval_clientId_idx"         ON "Approval"("clientId");
CREATE INDEX IF NOT EXISTS "Approval_companyId_idx"        ON "Approval"("companyId");
CREATE INDEX IF NOT EXISTS "Approval_status_idx"           ON "Approval"("status");
CREATE INDEX IF NOT EXISTS "Approval_dueDate_idx"          ON "Approval"("dueDate");
CREATE INDEX IF NOT EXISTS "Approval_createdAt_idx"        ON "Approval"("createdAt");
CREATE INDEX IF NOT EXISTS "Approval_companyId_status_idx" ON "Approval"("companyId", "status");

CREATE TABLE IF NOT EXISTS "ApprovalAttachment" (
    "id"         TEXT NOT NULL,
    "name"       VARCHAR(255) NOT NULL,
    "url"        VARCHAR(500) NOT NULL,
    "approvalId" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAttachment_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_approvalId_fkey"
    FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ApprovalAttachment_approvalId_idx" ON "ApprovalAttachment"("approvalId");

CREATE TABLE IF NOT EXISTS "ApprovalTimeline" (
    "id"         TEXT NOT NULL,
    "action"     VARCHAR(100) NOT NULL,
    "comment"    TEXT,
    "status"     "ApprovalStatus" NOT NULL,
    "userId"     TEXT,
    "approvalId" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalTimeline_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ApprovalTimeline" ADD CONSTRAINT "ApprovalTimeline_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ApprovalTimeline" ADD CONSTRAINT "ApprovalTimeline_approvalId_fkey"
    FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ApprovalTimeline_approvalId_idx"           ON "ApprovalTimeline"("approvalId");
CREATE INDEX IF NOT EXISTS "ApprovalTimeline_approvalId_createdAt_idx" ON "ApprovalTimeline"("approvalId", "createdAt");

-- ---------------------------------------------------------------------------
-- 7. Enhanced Document Center
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "EnhancedDocument" (
    "id"          TEXT NOT NULL,
    "name"        VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type"        "EnhancedDocumentType" NOT NULL DEFAULT 'OTHER',
    "url"         VARCHAR(500) NOT NULL,
    "fileKey"     VARCHAR(500),
    "version"     INTEGER NOT NULL DEFAULT 1,
    "parentId"    TEXT,
    "tags"        TEXT[] NOT NULL DEFAULT '{}',
    "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'CLIENT_ADMIN',
    "clientId"    TEXT,
    "companyId"   TEXT NOT NULL,
    "projectId"   TEXT,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnhancedDocument_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "EnhancedDocument" ADD CONSTRAINT "EnhancedDocument_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "EnhancedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EnhancedDocument" ADD CONSTRAINT "EnhancedDocument_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EnhancedDocument" ADD CONSTRAINT "EnhancedDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EnhancedDocument" ADD CONSTRAINT "EnhancedDocument_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EnhancedDocument_clientId_idx"       ON "EnhancedDocument"("clientId");
CREATE INDEX IF NOT EXISTS "EnhancedDocument_companyId_idx"      ON "EnhancedDocument"("companyId");
CREATE INDEX IF NOT EXISTS "EnhancedDocument_type_idx"           ON "EnhancedDocument"("type");
CREATE INDEX IF NOT EXISTS "EnhancedDocument_tags_idx"           ON "EnhancedDocument" USING gin("tags");
CREATE INDEX IF NOT EXISTS "EnhancedDocument_createdAt_idx"      ON "EnhancedDocument"("createdAt");
CREATE INDEX IF NOT EXISTS "EnhancedDocument_companyId_type_idx" ON "EnhancedDocument"("companyId", "type");

CREATE TABLE IF NOT EXISTS "DocumentAccessLog" (
    "id"         TEXT NOT NULL,
    "action"     VARCHAR(100) NOT NULL,
    "userId"     TEXT,
    "documentId" TEXT NOT NULL,
    "ipAddress"  VARCHAR(45),
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "EnhancedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "DocumentAccessLog_documentId_idx"           ON "DocumentAccessLog"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentAccessLog_userId_idx"               ON "DocumentAccessLog"("userId");
CREATE INDEX IF NOT EXISTS "DocumentAccessLog_documentId_createdAt_idx" ON "DocumentAccessLog"("documentId", "createdAt");

-- ---------------------------------------------------------------------------
-- 8. Invoice Center
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id"          TEXT NOT NULL,
    "number"      VARCHAR(100) NOT NULL,
    "title"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount"      DECIMAL(12,2) NOT NULL,
    "currency"    VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "amountPaid"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status"      "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate"     TIMESTAMPTZ(6),
    "sentAt"      TIMESTAMPTZ(6),
    "paidAt"      TIMESTAMPTZ(6),
    "pdfUrl"      VARCHAR(500),
    "clientId"    TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "projectId"   TEXT,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Invoice_clientId_idx"         ON "Invoice"("clientId");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx"        ON "Invoice"("companyId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx"           ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx"          ON "Invoice"("dueDate");
CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx"        ON "Invoice"("createdAt");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_number_idx"           ON "Invoice"("number");

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    "id"          TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity"    INTEGER NOT NULL DEFAULT 1,
    "unitPrice"   DECIMAL(12,2) NOT NULL,
    "total"       DECIMAL(12,2) NOT NULL,
    "invoiceId"   TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

CREATE TABLE IF NOT EXISTS "InvoicePayment" (
    "id"        TEXT NOT NULL,
    "amount"    DECIMAL(12,2) NOT NULL,
    "method"    VARCHAR(100),
    "reference" VARCHAR(255),
    "invoiceId" TEXT NOT NULL,
    "paidAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

CREATE TABLE IF NOT EXISTS "InvoiceReminder" (
    "id"        TEXT NOT NULL,
    "type"      VARCHAR(100) NOT NULL,
    "sentAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "InvoiceReminder_invoiceId_idx" ON "InvoiceReminder"("invoiceId");

-- ---------------------------------------------------------------------------
-- 9. Client Success Center
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ClientSuccess" (
    "id"        TEXT NOT NULL,
    "clientId"  TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "score"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSuccess_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ClientSuccess" ADD CONSTRAINT "ClientSuccess_clientId_key" UNIQUE ("clientId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClientSuccess" ADD CONSTRAINT "ClientSuccess_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClientSuccess" ADD CONSTRAINT "ClientSuccess_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ClientSuccess_clientId_idx"  ON "ClientSuccess"("clientId");
CREATE INDEX IF NOT EXISTS "ClientSuccess_companyId_idx" ON "ClientSuccess"("companyId");

CREATE TABLE IF NOT EXISTS "SuccessObjective" (
    "id"           TEXT NOT NULL,
    "title"        VARCHAR(255) NOT NULL,
    "description"  TEXT,
    "targetValue"  DECIMAL(12,2),
    "currentValue" DECIMAL(12,2),
    "unit"         VARCHAR(50),
    "targetDate"   TIMESTAMPTZ(6),
    "completedAt"  TIMESTAMPTZ(6),
    "successId"    TEXT NOT NULL,
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessObjective_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SuccessObjective" ADD CONSTRAINT "SuccessObjective_successId_fkey"
    FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SuccessObjective_successId_idx" ON "SuccessObjective"("successId");

CREATE TABLE IF NOT EXISTS "SuccessMetric" (
    "id"           TEXT NOT NULL,
    "name"         VARCHAR(255) NOT NULL,
    "initialValue" DECIMAL(12,2) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "unit"         VARCHAR(50),
    "successId"    TEXT NOT NULL,
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessMetric_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SuccessMetric" ADD CONSTRAINT "SuccessMetric_successId_fkey"
    FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SuccessMetric_successId_idx" ON "SuccessMetric"("successId");

CREATE TABLE IF NOT EXISTS "MetricHistory" (
    "id"        TEXT NOT NULL,
    "value"     DECIMAL(12,2) NOT NULL,
    "date"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricId"  TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricHistory_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "MetricHistory" ADD CONSTRAINT "MetricHistory_metricId_fkey"
    FOREIGN KEY ("metricId") REFERENCES "SuccessMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "MetricHistory_metricId_idx"      ON "MetricHistory"("metricId");
CREATE INDEX IF NOT EXISTS "MetricHistory_metricId_date_idx" ON "MetricHistory"("metricId", "date");

CREATE TABLE IF NOT EXISTS "SuccessRecommendation" (
    "id"          TEXT NOT NULL,
    "title"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority"    INTEGER NOT NULL DEFAULT 0,
    "status"      VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "successId"   TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessRecommendation_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SuccessRecommendation" ADD CONSTRAINT "SuccessRecommendation_successId_fkey"
    FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SuccessRecommendation_successId_idx"          ON "SuccessRecommendation"("successId");
CREATE INDEX IF NOT EXISTS "SuccessRecommendation_successId_priority_idx" ON "SuccessRecommendation"("successId", "priority");

CREATE TABLE IF NOT EXISTS "SuccessTimeline" (
    "id"          TEXT NOT NULL,
    "title"       VARCHAR(255) NOT NULL,
    "description" TEXT,
    "eventType"   VARCHAR(100) NOT NULL,
    "date"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "successId"   TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessTimeline_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SuccessTimeline" ADD CONSTRAINT "SuccessTimeline_successId_fkey"
    FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SuccessTimeline_successId_idx"      ON "SuccessTimeline"("successId");
CREATE INDEX IF NOT EXISTS "SuccessTimeline_successId_date_idx" ON "SuccessTimeline"("successId", "date");