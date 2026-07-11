-- Commission/Payout model: tracks what is owed to each associate (partner) per
-- payment received on a project, per a manually assigned per-project revenue split.

CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "ProjectCommissionSplit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ratePct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProjectCommissionSplit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectCommissionSplit_projectId_partnerId_key" ON "ProjectCommissionSplit"("projectId", "partnerId");
CREATE INDEX "ProjectCommissionSplit_projectId_idx" ON "ProjectCommissionSplit"("projectId");
CREATE INDEX "ProjectCommissionSplit_partnerId_idx" ON "ProjectCommissionSplit"("partnerId");

ALTER TABLE "ProjectCommissionSplit" ADD CONSTRAINT "ProjectCommissionSplit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCommissionSplit" ADD CONSTRAINT "ProjectCommissionSplit_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "basis" DECIMAL(14,3) NOT NULL,
    "ratePct" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Commission_paymentId_key" ON "Commission"("paymentId");
CREATE INDEX "Commission_partnerId_idx" ON "Commission"("partnerId");
CREATE INDEX "Commission_projectId_idx" ON "Commission"("projectId");
CREATE INDEX "Commission_invoiceId_idx" ON "Commission"("invoiceId");
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

ALTER TABLE "Commission" ADD CONSTRAINT "Commission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
