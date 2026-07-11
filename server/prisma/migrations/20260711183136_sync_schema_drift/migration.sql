-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_PAID';

-- AlterTable
ALTER TABLE "AiConversation" ADD COLUMN     "persona" VARCHAR(100);

-- ApprovalTimeline.status is converted to VARCHAR(50) by migration
-- 20260625230000_remove_commented_approval_status (fixed to be self-contained) — not repeated here.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" VARCHAR(255);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_projectId_invoiceType_key" ON "Invoice"("projectId", "invoiceType");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- Proposal_leadId_key already exists as a partial unique index (Prisma's expected form for a
-- nullable @unique field on Postgres) — not real drift, skipped.

-- RenameIndex
ALTER INDEX "MetricSnapshot_clientId_source_metric_dimension_periodStar_key" RENAME TO "MetricSnapshot_clientId_source_metric_dimension_periodStart_key";
