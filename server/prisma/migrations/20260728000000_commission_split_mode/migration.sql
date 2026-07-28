-- CreateEnum
CREATE TYPE "CommissionSplitMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "commissionSplitDesynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionSplitMode" "CommissionSplitMode" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "CommissionSplitHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "previousSplits" JSONB NOT NULL,
    "newSplits" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionSplitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionSplitHistory_projectId_idx" ON "CommissionSplitHistory"("projectId");

-- AddForeignKey
ALTER TABLE "CommissionSplitHistory" ADD CONSTRAINT "CommissionSplitHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
