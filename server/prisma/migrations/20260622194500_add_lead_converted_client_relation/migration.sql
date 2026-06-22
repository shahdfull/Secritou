-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedClientId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_convertedClientId_idx" ON "Lead"("convertedClientId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

