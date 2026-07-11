-- CreateColumn (schema.prisma already declared these; no prior migration ever created them)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(6);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_archivedAt_idx" ON "Client"("archivedAt");
CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx" ON "Client"("deletedAt");
