-- DropForeignKey
ALTER TABLE "ClientOnboarding" DROP CONSTRAINT "ClientOnboarding_projectId_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "archivedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
