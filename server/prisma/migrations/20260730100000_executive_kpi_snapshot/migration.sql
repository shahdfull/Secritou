-- SEC-031: real, immutable end-of-month snapshots of overdue/pending invoice totals, so
-- overdueGrowthMoM/pendingGrowthMoM (executiveMetrics.repository.ts) can compare against what the
-- amount actually WAS at the time instead of re-querying Invoice.status (mutable).

-- CreateTable
CREATE TABLE "ExecutiveKpiSnapshot" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "monthStart" DATE NOT NULL,
    "overdueAmount" DECIMAL(14,3) NOT NULL,
    "pendingAmount" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveKpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutiveKpiSnapshot_monthStart_idx" ON "ExecutiveKpiSnapshot"("monthStart");

-- AddForeignKey
ALTER TABLE "ExecutiveKpiSnapshot" ADD CONSTRAINT "ExecutiveKpiSnapshot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (partial, COALESCE-normalized)
-- Prisma's schema language cannot express "treat NULL serviceId as a single shared value for
-- uniqueness purposes" — a plain @@unique([serviceId, monthStart]) would let Postgres accept
-- unlimited company-wide (serviceId IS NULL) rows for the same month, since NULLs are never
-- considered equal in a standard unique index. COALESCE to a sentinel that can never collide with
-- a real Service.id (a UUID) closes that gap while still allowing one row per (real pole, month)
-- and exactly one company-wide row per month. Same "partial index, not expressible in schema.prisma"
-- pattern as migration 20260713120000_invoice_partial_unique.
CREATE UNIQUE INDEX "ExecutiveKpiSnapshot_serviceId_monthStart_key"
  ON "ExecutiveKpiSnapshot" (COALESCE("serviceId", '__company_wide__'), "monthStart");
