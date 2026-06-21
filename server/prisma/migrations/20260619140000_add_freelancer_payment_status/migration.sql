-- AlterTable: add payment fields to FreelancerMission
ALTER TABLE "FreelancerMission"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paidAmount"    DECIMAL(12,2),
  ADD COLUMN "paidAt"        TIMESTAMPTZ(6),
  ADD COLUMN "paymentNote"   TEXT;

-- CreateIndex
CREATE INDEX "FreelancerMission_paymentStatus_idx" ON "FreelancerMission"("paymentStatus");
