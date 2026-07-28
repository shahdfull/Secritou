-- RG-008 (refonte paiement à la tâche, LOT 4) : Commission porte désormais 3 régimes
-- (PROJECT_PERCENT/TASK_FIXED/MANAGER_PROJECT_FEE). invoiceId/paymentId/basis/ratePct
-- deviennent nullables (spécifiques à PROJECT_PERCENT) ; taskId/baseAmount/coefficient
-- s'ajoutent (spécifiques à TASK_FIXED). Toute ligne existante est backfillée à
-- source = 'PROJECT_PERCENT' (défaut de colonne) — rétrocompatible, aucune ligne perdue.

-- CreateEnum
CREATE TYPE "CommissionSource" AS ENUM ('PROJECT_PERCENT', 'TASK_FIXED', 'MANAGER_PROJECT_FEE');

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "baseAmount" DECIMAL(14,3),
ADD COLUMN     "coefficient" DECIMAL(4,3),
ADD COLUMN     "source" "CommissionSource" NOT NULL DEFAULT 'PROJECT_PERCENT',
ADD COLUMN     "taskId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL,
ALTER COLUMN "paymentId" DROP NOT NULL,
ALTER COLUMN "basis" DROP NOT NULL,
ALTER COLUMN "ratePct" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Commission_taskId_partnerId_key" ON "Commission"("taskId", "partnerId");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
