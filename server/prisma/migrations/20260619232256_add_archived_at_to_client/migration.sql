-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "archivedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");
