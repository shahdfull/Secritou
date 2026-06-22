ALTER TABLE "Project"
  ADD COLUMN "clientApprovedAt"   TIMESTAMPTZ(6),
  ADD COLUMN "clientApprovedById" TEXT;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_clientApprovedById_fkey"
  FOREIGN KEY ("clientApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
