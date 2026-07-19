// SEC-060 (actions en masse, item 3 du constat P1 rapport Product Owner) : aucune action en masse
// n'existait sur la liste des tâches — confirmé par recherche exhaustive de "bulk" dans
// client/src/features/tasks/, aucune occurrence.
//
// This test imports and calls the real taskService.bulkUpdateStatus/.bulkDelete against a real
// database — not a reimplementation — proving:
// 1. A batch with a mix of valid and invalid operations reports per-id success/failure rather
//    than failing the whole batch (invalid status transition on one task doesn't block the
//    others).
// 2. The critical security property: a MANAGER's pole scope is enforced per-task inside the
//    batch — a task belonging to a different pole fails with a per-id error, without blocking
//    the tasks that ARE in scope. The batch never silently widens a MANAGER's authority.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeProject(serviceId: string) {
  const client = await prisma.client.create({ data: { name: "bulk-actions client", serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "bulk-actions project", clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return project;
}

async function makeManager(suffix: string, serviceId: string) {
  const user = await prisma.user.create({
    data: { email: `bulk-mgr-${suffix}-${Date.now()}@test.local`, name: `M-${suffix}`, passwordHash: "x", role: "MANAGER", serviceId },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("taskService.bulkUpdateStatus — SEC-060", () => {
  test("a batch with one invalid transition reports per-task success/failure without blocking the others", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject(serviceA);
    const manager = await makeManager("bulk1", serviceA);
    const taskA = await prisma.task.create({ data: { title: "task A", projectId: project.id, status: "TODO" } });
    const taskB = await prisma.task.create({ data: { title: "task B", projectId: project.id, status: "DONE" } });
    createdTaskIds.push(taskA.id, taskB.id);

    // TODO -> IN_PROGRESS is a valid transition; DONE -> IN_PROGRESS is not
    // (ALLOWED_TASK_TRANSITIONS, @secritou/shared).
    const results = await taskService.bulkUpdateStatus(
      [taskA.id, taskB.id],
      "IN_PROGRESS",
      { userRole: "MANAGER", userServiceId: serviceA, userId: manager.id }
    );

    const resultA = results.find((r) => r.id === taskA.id);
    const resultB = results.find((r) => r.id === taskB.id);
    assert.equal(resultA?.success, true);
    assert.equal(resultB?.success, false);

    const refreshedA = await prisma.task.findUnique({ where: { id: taskA.id } });
    const refreshedB = await prisma.task.findUnique({ where: { id: taskB.id } });
    assert.equal(refreshedA?.status, "IN_PROGRESS");
    assert.equal(refreshedB?.status, "DONE", "the invalid transition must not have silently applied");
  });

  test("a task outside the MANAGER's pole fails with a per-id error, without blocking in-scope tasks (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectInScope = await makeProject(serviceA);
    const projectOutOfScope = await makeProject(serviceB);
    const manager = await makeManager("bulk2", serviceA);
    const inScopeTask = await prisma.task.create({ data: { title: "in scope", projectId: projectInScope.id, status: "TODO" } });
    const outOfScopeTask = await prisma.task.create({ data: { title: "out of scope", projectId: projectOutOfScope.id, status: "TODO" } });
    createdTaskIds.push(inScopeTask.id, outOfScopeTask.id);

    const results = await taskService.bulkUpdateStatus(
      [inScopeTask.id, outOfScopeTask.id],
      "IN_PROGRESS",
      { userRole: "MANAGER", userServiceId: serviceA, userId: manager.id }
    );

    const inScopeResult = results.find((r) => r.id === inScopeTask.id);
    const outOfScopeResult = results.find((r) => r.id === outOfScopeTask.id);
    assert.equal(inScopeResult?.success, true);
    assert.equal(outOfScopeResult?.success, false);

    const refreshedOutOfScope = await prisma.task.findUnique({ where: { id: outOfScopeTask.id } });
    assert.equal(refreshedOutOfScope?.status, "TODO", "a MANAGER must never be able to update a task outside their pole via the batch");
  });
});

describe("taskService.bulkDelete — SEC-060", () => {
  test("deletes every task in scope and reports per-id success", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject(serviceA);
    const manager = await makeManager("bulk3", serviceA);
    const taskA = await prisma.task.create({ data: { title: "delete me A", projectId: project.id } });
    const taskB = await prisma.task.create({ data: { title: "delete me B", projectId: project.id } });
    createdTaskIds.push(taskA.id, taskB.id);

    const results = await taskService.bulkDelete(
      [taskA.id, taskB.id],
      { userRole: "MANAGER", userServiceId: serviceA, userId: manager.id },
      manager.id,
      "MANAGER"
    );

    assert.ok(results.every((r) => r.success));
    const remaining = await prisma.task.findMany({ where: { id: { in: [taskA.id, taskB.id] } } });
    assert.equal(remaining.length, 0);
  });

  test("a task outside the MANAGER's pole is not deleted, reported as a per-id failure (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const projectOutOfScope = await makeProject(serviceB);
    const manager = await makeManager("bulk4", serviceA);
    const outOfScopeTask = await prisma.task.create({ data: { title: "must survive", projectId: projectOutOfScope.id } });
    createdTaskIds.push(outOfScopeTask.id);

    const results = await taskService.bulkDelete(
      [outOfScopeTask.id],
      { userRole: "MANAGER", userServiceId: serviceA, userId: manager.id },
      manager.id,
      "MANAGER"
    );

    assert.equal(results[0]?.success, false);
    const stillThere = await prisma.task.findUnique({ where: { id: outOfScopeTask.id } });
    assert.ok(stillThere, "a MANAGER must never be able to delete a task outside their pole via the batch");
  });
});
