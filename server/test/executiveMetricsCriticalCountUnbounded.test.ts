// SEC-161: activeProjects (the query feeding PROJECT_CRITICAL risk *rows*) is now bounded to
// take: 50 for performance — but criticalCount/watchCount must remain accurate over the FULL
// active-project set regardless, since they are now computed by a separate real SQL aggregate
// (criticalWatchCountsRaw in executiveMetrics.repository.ts), not derived from the bounded list.
// This test proves that decoupling actually holds: it creates more overdue-deadline projects than
// the take: 50 bound, and checks criticalCount still counts all of them, not just the sampled 50.
//
// Calls the real executiveMetricsRepository.getAll against a real database — not a
// reimplementation. Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let executiveMetricsRepository: typeof import("../src/repositories/executiveMetrics.repository.js").executiveMetricsRepository;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

const OVERDUE_PROJECT_COUNT = 55; // deliberately > the activeProjects take: 50 bound

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

describe("executiveMetricsRepository.getAll — criticalCount stays accurate beyond the activeProjects take bound (SEC-161)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test(`criticalCount counts all ${OVERDUE_PROJECT_COUNT} overdue-deadline projects, not just the sampled 50`, async () => {
    const client = await prisma.client.create({ data: { name: "SEC-161 unbounded-count test client", serviceId } });
    createdClientIds.push(client.id);
    const overdueDeadline = new Date(Date.now() - 5 * 86_400_000);

    const before = await executiveMetricsRepository.getAll(serviceId);

    for (let i = 0; i < OVERDUE_PROJECT_COUNT; i++) {
      const project = await prisma.project.create({
        data: {
          name: `SEC-161 unbounded-count overdue project ${i}`,
          clientId: client.id,
          serviceId,
          status: "IN_PROGRESS",
          deadline: overdueDeadline,
        },
      });
      createdProjectIds.push(project.id);
    }

    const after = await executiveMetricsRepository.getAll(serviceId);

    assert.equal(
      after.projects.criticalCount - before.projects.criticalCount,
      OVERDUE_PROJECT_COUNT,
      "criticalCount must increase by the full number of newly-overdue projects, proving it is not silently capped at the activeProjects take: 50 bound"
    );
  });
});
