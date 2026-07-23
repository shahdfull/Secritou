// SEC-091: ProjectsClientPage.tsx used to fire getTimelineStatus + getCompletedTasksForClient
// separately for every visible project card (2×N requests for N cards). projectService
// .getPortalSummaries batches both calls for every id in one round trip, reusing the same two
// methods internally (not a reimplementation) — the two endpoints stay logically distinct
// (SEC-061), only the transport is batched.
//
// This test imports and calls the real projectService.getPortalSummaries against a real
// database, proving:
// 1. A single call returns both timeline + completedTasks for every requested project.
// 2. A project id belonging to another client is silently omitted from the response (not a
//    thrown error that would fail the whole batch) — the same 404-on-foreign-project security
//    property as getCompletedTasksForClient/getTimelineStatus, just non-fatal at the batch level.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
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

describe("projectService.getPortalSummaries — SEC-091", () => {
  test("returns timeline + completedTasks for every requested project in a single call", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const client = await prisma.client.create({ data: { name: "sec091 client", serviceId } });
    createdClientIds.push(client.id);
    const projectA = await prisma.project.create({ data: { name: "sec091 project A", clientId: client.id, serviceId } });
    const projectB = await prisma.project.create({ data: { name: "sec091 project B", clientId: client.id, serviceId } });
    createdProjectIds.push(projectA.id, projectB.id);

    const result = await projectService.getPortalSummaries([projectA.id, projectB.id], client.id);

    assert.ok(result[projectA.id], "project A must be present in the batched result");
    assert.ok(result[projectB.id], "project B must be present in the batched result");
    assert.ok(Array.isArray(result[projectA.id]!.timeline) && result[projectA.id]!.timeline.length > 0, "each entry carries the real timeline steps");
    assert.ok(Array.isArray(result[projectA.id]!.completedTasks), "each entry carries the real completedTasks array");
  });

  test("a project belonging to another client is silently omitted, not thrown as a batch-wide error (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const ownerClient = await prisma.client.create({ data: { name: "sec091 owner client", serviceId } });
    const otherClient = await prisma.client.create({ data: { name: "sec091 other client", serviceId } });
    createdClientIds.push(ownerClient.id, otherClient.id);
    const ownProject = await prisma.project.create({ data: { name: "sec091 own project", clientId: ownerClient.id, serviceId } });
    const foreignProject = await prisma.project.create({ data: { name: "sec091 foreign project", clientId: otherClient.id, serviceId } });
    createdProjectIds.push(ownProject.id, foreignProject.id);

    const result = await projectService.getPortalSummaries([ownProject.id, foreignProject.id], ownerClient.id);

    assert.ok(result[ownProject.id], "the caller's own project must still be present");
    assert.equal(result[foreignProject.id], undefined, "another client's project must never leak into the batched result");
  });
});
