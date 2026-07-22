// SEC-024 (ANOMALIES.yaml): executiveMetricsRepository.getAll declared RiskItem.type as
// INVOICE_OVERDUE | APPROVAL_BLOCKED | PROJECT_CRITICAL | CONTRACT_EXPIRING | STALE_PROJECT |
// LEAD_HOT, but only 3 of the 6 were ever actually pushed into risks[] — PROJECT_CRITICAL and
// STALE_PROJECT were computed as counts (criticalCount/watchCount) alongside the loop but never
// surfaced as risk rows, and CONTRACT_EXPIRING queried Approval (there is no contract-expiry
// field anywhere in the schema) yet fed a badge (alerts.expiringContracts) with no matching
// risk row ever visible. Fix: CONTRACT_EXPIRING/expiringContracts removed (nothing real to
// compute), PROJECT_CRITICAL now pushed from the same per-project pass that already computes
// criticalCount. This test imports and calls the real executiveMetricsRepository.getAll against
// a real database — not a reimplementation — to prove a critical (overdue-deadline) project
// actually produces a PROJECT_CRITICAL risk row.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let executiveMetricsRepository: typeof import("../src/repositories/executiveMetrics.repository.js").executiveMetricsRepository;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ executiveMetricsRepository } = await import("../src/repositories/executiveMetrics.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("executiveMetricsRepository.getAll — PROJECT_CRITICAL risks (SEC-024)", () => {
  test("a project with a passed deadline produces a PROJECT_CRITICAL risk row, not just a count", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "SEC-024 test client", serviceId } });
    createdClientIds.push(client.id);
    const overdueDeadline = new Date(Date.now() - 5 * 86_400_000);
    const project = await prisma.project.create({
      data: {
        name: "SEC-024 overdue project",
        clientId: client.id,
        serviceId,
        status: "IN_PROGRESS",
        deadline: overdueDeadline,
      },
    });
    createdProjectIds.push(project.id);

    const metrics = await executiveMetricsRepository.getAll(serviceId);

    const risk = metrics.risks.find((r) => r.type === "PROJECT_CRITICAL" && r.entityId === project.id);
    assert.ok(risk, "expected a PROJECT_CRITICAL risk row for the overdue-deadline project");
    assert.equal(risk!.severity, "critical");
    assert.ok(!("expiringContracts" in metrics.alerts), "expiringContracts must no longer be part of alerts — nothing in the schema backs it");
  });
});
