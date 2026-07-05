ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billedInvoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "TimeEntry_projectId_billed_idx" ON "TimeEntry"("projectId", "billed");
