-- Migration: add_company_to_freelancer_application
-- Adds nullable companyId to FreelancerApplication for multi-tenant isolation.
-- Nullable because applications are submitted publicly (no auth = no companyId).
-- companyId is set at acceptance time by the admin who processes the application.

ALTER TABLE "FreelancerApplication"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "FreelancerApplication"
  ADD CONSTRAINT "FreelancerApplication_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "FreelancerApplication_companyId_idx"
  ON "FreelancerApplication"("companyId");

CREATE INDEX "FreelancerApplication_companyId_status_idx"
  ON "FreelancerApplication"("companyId", "status");
