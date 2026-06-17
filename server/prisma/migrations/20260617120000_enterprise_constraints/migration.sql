-- Lead archival fields
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedClientId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "Lead_archivedAt_idx" ON "Lead"("archivedAt");
