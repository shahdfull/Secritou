-- RG-006/RG-007/RG-008/RG-009 (refonte paiement à la tâche, LOT 3) : montant de base par tâche,
-- barème de qualité saisi à la validation, et traçabilité de la validation elle-même
-- (validatedAt/validatedById), nécessaire à RG-009 (conflit d'intérêt manager/assigné).
-- Tous nullables sauf reworkCount (défaut 0) — aucune tâche existante n'est modifiée au-delà de
-- ce défaut.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "payoutAmount" DECIMAL(14,3),
ADD COLUMN     "qualityScore" INTEGER,
ADD COLUMN     "reworkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validatedAt" TIMESTAMPTZ(6),
ADD COLUMN     "validatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
