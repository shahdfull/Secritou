-- Migration: Remove companyId from all models (single-tenant refactor)
-- Secritou serves one agency only; companyId was multi-tenancy scaffolding.

-- ─── 1. Drop foreign key constraints ─────────────────────────────────────────

ALTER TABLE "User"                  DROP CONSTRAINT IF EXISTS "User_companyId_fkey";
ALTER TABLE "Lead"                  DROP CONSTRAINT IF EXISTS "Lead_companyId_fkey";
ALTER TABLE "Client"                DROP CONSTRAINT IF EXISTS "Client_companyId_fkey";
ALTER TABLE "Project"               DROP CONSTRAINT IF EXISTS "Project_companyId_fkey";
ALTER TABLE "ServiceRequest"        DROP CONSTRAINT IF EXISTS "ServiceRequest_companyId_fkey";
ALTER TABLE "Document"              DROP CONSTRAINT IF EXISTS "Document_companyId_fkey";
ALTER TABLE "ClientOnboarding"      DROP CONSTRAINT IF EXISTS "ClientOnboarding_companyId_fkey";
ALTER TABLE "Proposal"              DROP CONSTRAINT IF EXISTS "Proposal_companyId_fkey";
ALTER TABLE "Approval"              DROP CONSTRAINT IF EXISTS "Approval_companyId_fkey";
ALTER TABLE IF EXISTS "EnhancedDocument" DROP CONSTRAINT IF EXISTS "EnhancedDocument_companyId_fkey";
ALTER TABLE "Invoice"               DROP CONSTRAINT IF EXISTS "Invoice_companyId_fkey";
ALTER TABLE "ClientSuccess"         DROP CONSTRAINT IF EXISTS "ClientSuccess_companyId_fkey";
ALTER TABLE "FreelancerApplication" DROP CONSTRAINT IF EXISTS "FreelancerApplication_companyId_fkey";
ALTER TABLE "AiConversation"        DROP CONSTRAINT IF EXISTS "AiConversation_companyId_fkey";
ALTER TABLE "CustomQuestion"        DROP CONSTRAINT IF EXISTS "CustomQuestion_companyId_fkey";
ALTER TABLE "CreditNote"            DROP CONSTRAINT IF EXISTS "CreditNote_companyId_fkey";
ALTER TABLE "Service"               DROP CONSTRAINT IF EXISTS "Service_companyId_fkey";
ALTER TABLE "Rating"                DROP CONSTRAINT IF EXISTS "Rating_companyId_fkey";

-- ─── 2. Drop unique constraints that include companyId ────────────────────────

ALTER TABLE "Client"  DROP CONSTRAINT IF EXISTS "Client_companyId_email_key";
ALTER TABLE "Lead"    DROP CONSTRAINT IF EXISTS "Lead_companyId_email_key";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_companyId_number_key";
ALTER TABLE "User"    DROP CONSTRAINT IF EXISTS "User_companyId_email_key";

-- ─── 3. Drop indexes on companyId columns ─────────────────────────────────────

DROP INDEX IF EXISTS "User_companyId_idx";
DROP INDEX IF EXISTS "User_companyId_role_idx";
DROP INDEX IF EXISTS "User_companyId_createdAt_idx";
DROP INDEX IF EXISTS "User_company_role_idx";
DROP INDEX IF EXISTS "Lead_companyId_status_idx";
DROP INDEX IF EXISTS "Lead_companyId_createdAt_idx";
DROP INDEX IF EXISTS "Lead_companyId_status_createdAt_idx";
DROP INDEX IF EXISTS "Lead_companyId_active_createdAt_idx";
DROP INDEX IF EXISTS "Client_companyId_idx";
DROP INDEX IF EXISTS "Client_companyId_createdAt_idx";
DROP INDEX IF EXISTS "Project_companyId_status_idx";
DROP INDEX IF EXISTS "Project_companyId_createdAt_idx";
DROP INDEX IF EXISTS "ServiceRequest_companyId_status_idx";
DROP INDEX IF EXISTS "ServiceRequest_companyId_createdAt_idx";
DROP INDEX IF EXISTS "FreelancerMission_companyId_status_idx";
DROP INDEX IF EXISTS "FreelancerMission_company_status_updated_idx";
DROP INDEX IF EXISTS "FreelancerMission_companyId_status_updatedAt_idx";
DROP INDEX IF EXISTS "FreelancerMission_companyId_createdAt_idx";
DROP INDEX IF EXISTS "Document_companyId_idx";
DROP INDEX IF EXISTS "Document_companyId_createdAt_idx";
DROP INDEX IF EXISTS "LeadArchive_companyId_createdAt_idx";
DROP INDEX IF EXISTS "DocumentArchive_companyId_createdAt_idx";
DROP INDEX IF EXISTS "ClientOnboarding_companyId_idx";
DROP INDEX IF EXISTS "Proposal_companyId_idx";
DROP INDEX IF EXISTS "Proposal_companyId_status_idx";
DROP INDEX IF EXISTS "Approval_companyId_idx";
DROP INDEX IF EXISTS "Approval_companyId_status_idx";
DROP INDEX IF EXISTS "EnhancedDocument_companyId_idx";
DROP INDEX IF EXISTS "EnhancedDocument_companyId_type_idx";
DROP INDEX IF EXISTS "Invoice_companyId_idx";
DROP INDEX IF EXISTS "Invoice_companyId_status_idx";
DROP INDEX IF EXISTS "ClientSuccess_companyId_idx";
DROP INDEX IF EXISTS "FreelancerApplication_companyId_status_idx";

-- ─── 4. Drop companyId columns ────────────────────────────────────────────────

ALTER TABLE "User"                  DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Lead"                  DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Client"                DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Project"               DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "ServiceRequest"        DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Document"              DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "ClientOnboarding"      DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Proposal"              DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Approval"              DROP COLUMN IF EXISTS "companyId";
ALTER TABLE IF EXISTS "EnhancedDocument" DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Invoice"               DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "ClientSuccess"         DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "FreelancerApplication" DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "AiConversation"        DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "CustomQuestion"        DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "CreditNote"            DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Service"               DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "Rating"                DROP COLUMN IF EXISTS "companyId";

-- ─── 5. Add new unique constraints without companyId ─────────────────────────

-- Client: unique email (was companyId+email)
ALTER TABLE "Client"  ADD CONSTRAINT "Client_email_key"  UNIQUE ("email");

-- Lead: unique email (was companyId+email)
ALTER TABLE "Lead"    ADD CONSTRAINT "Lead_email_key"    UNIQUE ("email");

-- Invoice: unique number (was companyId+number)
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_number_key" UNIQUE ("number");

-- ─── 6. Remove Service → Company relation (no longer needed) ─────────────────

-- (companyId column was already dropped above; Company.services relation is gone)
