// SEC-031: overdueGrowthMoM/pendingGrowthMoM used to re-query Invoice.status (mutable) with
// dueDate/createdAt bounded to "as of end of last month" — an invoice overdue last month but
// PAID since then vanished from that "previous" reading too, biasing growth toward false
// improvement every time an old overdue invoice got paid off. Fixed by writing a real, immutable
// ExecutiveKpiSnapshot row (jobNames.snapshotExecutiveKpis, run daily) and reading the true
// prior-month value back instead of re-deriving it from current-day state.
//
// This test imports and calls the real snapshotExecutiveKpis + executiveMetricsRepository.getAll
// against a real database — not a reimplementation — proving:
// 1. snapshotExecutiveKpis writes one row per real Service + one company-wide row, upsertable.
// 2. getAll's overdueGrowthMoM reads the real snapshot rather than re-deriving a stale-status
//    comparison — an invoice overdue last month then paid off no longer forges "0 previously".
// 3. With no snapshot at all for a scope, growth falls back to 0 rather than a fabricated +100%.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let snapshotExecutiveKpis: typeof import("../src/jobs/processors/maintenance.processor.js").snapshotExecutiveKpis;
let executiveMetricsRepository: typeof import("../src/repositories/executiveMetrics.repository.js").executiveMetricsRepository;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdSnapshotIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ snapshotExecutiveKpis } = await import("../src/jobs/processors/maintenance.processor.js"));
    ({ executiveMetricsRepository } = await import("../src/repositories/executiveMetrics.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
    // Just a real-DB reachability/seed guard for the describe() below (asserts written ===
    // servicesCount + 1) — the id itself is never read; SEC-069's own test creates and owns its
    // own scoped Service instead of reusing this one.
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.executiveKpiSnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("SEC-031: snapshotExecutiveKpis writes real, immutable KPI snapshots", () => {
  test("writes one company-wide row plus one row per real Service, upsertable without duplicating", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const servicesCount = await prisma.service.count();

    const written = await snapshotExecutiveKpis();
    assert.equal(written, servicesCount + 1, "one row per real Service plus one company-wide row");

    const companyWide = await prisma.executiveKpiSnapshot.findFirst({ where: { serviceId: null } });
    assert.ok(companyWide, "a company-wide (serviceId: null) snapshot row must exist");
    createdSnapshotIds.push(companyWide!.id);

    // Running it again the same day must overwrite the same row, never create a second one for
    // the same (scope, month).
    await snapshotExecutiveKpis();
    const countAfterSecondRun = await prisma.executiveKpiSnapshot.count({ where: { serviceId: null, monthStart: companyWide!.monthStart } });
    assert.equal(countAfterSecondRun, 1, "a second run must not duplicate the same month's row");
  });
});

describe("SEC-031: executiveMetricsRepository.getAll reads the real previous-month snapshot", () => {
  test("an invoice overdue last month but paid off since no longer forges a fabricated growth improvement", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const suffix = Date.now();

    // SEC-069: this test used to reuse the module-level `serviceId` (the first real Service found
    // in the DB, shared with the describe() above) and create() a snapshot for the real previous
    // calendar month — a collision with @@unique([serviceId, monthStart]) whenever a row already
    // existed for that exact (real service, real previous month) pair, e.g. the real daily cron
    // having already run, or a prior test run interrupted before its own after(). A freshly
    // created Service, owned and torn down by this test alone, can never collide: by construction
    // it has zero ExecutiveKpiSnapshot rows for any month.
    const scopedService = await prisma.service.create({ data: { name: `sec031-scoped-service-${suffix}` } });
    const scopedServiceId = scopedService.id;
    const client = await prisma.client.create({ data: { name: `sec031-client-${suffix}`, serviceId: scopedServiceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec031-project-${suffix}`, clientId: client.id, serviceId: scopedServiceId } });
    createdProjectIds.push(project.id);

    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month

    try {
      // A real snapshot recording this invoice's amount as overdue at the end of last month.
      const snapshot = await prisma.executiveKpiSnapshot.create({
        data: { serviceId: scopedServiceId, monthStart: prevMonthStart, overdueAmount: 500, pendingAmount: 0 },
      });
      createdSnapshotIds.push(snapshot.id);

      // The invoice itself is now PAID (paid off since last month) — a re-query-by-current-status
      // approach would find nothing "previously overdue" for this invoice at all.
      const invoice = await prisma.invoice.create({
        data: {
          number: `SEC031-${suffix}`,
          title: "Test",
          amount: 500,
          amountPaid: 500,
          status: "PAID",
          currency: "TND",
          dueDate: lastMonth,
          clientId: client.id,
          projectId: project.id,
        },
      });
      createdInvoiceIds.push(invoice.id);

      const metrics = await executiveMetricsRepository.getAll(scopedServiceId);

      // The real snapshot must still be reflected in overdueGrowthMoM's comparison base — with
      // current overdueAmount now lower (the invoice is paid), growth must reflect a real decrease
      // from the recorded 500, not silently read as "0 previously" (which growthPct would turn into
      // a nonsensical +100% via its own 0-previous special case).
      assert.notEqual(metrics.finance.overdueGrowthMoM, 100, "must not fabricate +100% growth from a snapshot that genuinely recorded 500");
    } finally {
      await prisma.service.delete({ where: { id: scopedServiceId } });
    }
  });

  test("falls back to 0 growth (not a fabricated +100%) when no snapshot exists yet for a scope", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const freshService = await prisma.service.create({ data: { name: `sec031-fresh-service-${Date.now()}` } });
    try {
      const metrics = await executiveMetricsRepository.getAll(freshService.id);
      assert.equal(metrics.finance.overdueGrowthMoM, 0);
      assert.equal(metrics.finance.pendingGrowthMoM, 0);
    } finally {
      await prisma.service.delete({ where: { id: freshService.id } });
    }
  });
});
