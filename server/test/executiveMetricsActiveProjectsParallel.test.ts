// SEC-161: executiveMetricsRepository.getAll's activeProjects query used to run as a separate
// `await` AFTER the main 26-query Promise.all, adding an unparallelized round-trip on every
// cache-miss load of the executive dashboard — despite depending only on projectScope/now, both
// already available before the Promise.all runs. Moved into the same Promise.all batch.
//
// This test imports and calls the real executiveMetricsRepository.getAll against a real database
// — not a reimplementation — confirming the health-scoring fields it derives from activeProjects
// (criticalCount is exercised by executiveMetricsProjectRisks.test.ts/SEC-024 already; this test
// covers the "watch" / non-critical classification path, the one previously-untested branch of
// the same per-project loop) are still populated correctly now that the query runs inside the
// parallel batch instead of after it.
//
// Requires a real, migrated database; skipped if unreachable.

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

describe("executiveMetricsRepository.getAll — activeProjects parallelized with the main batch (SEC-161)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a project deadline within the next 7 days is still classified as a watch item (projectHealth.watch), proving activeProjects data still reaches health scoring", async () => {
    const client = await prisma.client.create({ data: { name: "SEC-161 test client", serviceId } });
    createdClientIds.push(client.id);
    const upcomingDeadline = new Date(Date.now() + 3 * 86_400_000);
    const project = await prisma.project.create({
      data: {
        name: "SEC-161 upcoming-deadline project",
        clientId: client.id,
        serviceId,
        status: "IN_PROGRESS",
        deadline: upcomingDeadline,
      },
    });
    createdProjectIds.push(project.id);

    const metrics = await executiveMetricsRepository.getAll(serviceId);

    assert.ok(metrics.projects.watchCount >= 1, "the near-deadline project must be counted as a watch item");
    // Not critical: it has no overdue deadline, isn't stale, has no blocked tasks.
    const criticalRisk = metrics.risks.find((r) => r.type === "PROJECT_CRITICAL" && r.entityId === project.id);
    assert.equal(criticalRisk, undefined, "a project only near its deadline (not overdue) must not be flagged critical");
  });
});
