// SEC-126: taskScope.test.ts (SEC-087) only proved the READ path (getAllTasks/getTaskById) with
// the real code — taskService.updateTask enforces the exact same scope
// (assertProjectInScope for ADMIN/MANAGER, assigneeId check for FREELANCER, task.service.ts:142-162)
// but was never exercised for either cross-pole MANAGER or a foreign FREELANCER. The guard
// itself was already correct; this closes the test gap.
//
// This test imports and calls the real taskService.updateTask against a real database — not a
// reimplementation — proving both rejection paths, while a same-pole MANAGER and the task's own
// assignee can still update it normally.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

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

async function makeTaskInService(serviceId: string, namePrefix: string, assigneeId?: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: `${namePrefix} task`, projectId: project.id, assigneeId } });
  createdTaskIds.push(task.id);
  return task;
}

describe("taskService.updateTask enforces scope on write (SEC-126)", () => {
  test("a pole-B MANAGER is rejected with 403 updating a pole-A task", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTaskInService(serviceA, "sec126-manager");

    await assert.rejects(
      () => taskService.updateTask(task.id, { title: "hacked" }, { userRole: "MANAGER", userServiceId: serviceB }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        return true;
      }
    );

    const untouched = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(untouched?.title, `sec126-manager task`);
  });

  test("a FREELANCER who is not the task's assignee is rejected with 403", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const owner = await prisma.user.create({ data: { email: `sec126-owner-${Date.now()}@test.local`, name: "Owner", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(owner.id);
    const stranger = await prisma.user.create({ data: { email: `sec126-stranger-${Date.now()}@test.local`, name: "Stranger", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(stranger.id);
    const task = await makeTaskInService(serviceA, "sec126-freelancer", owner.id);

    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "DONE" }, { userRole: "FREELANCER", userId: stranger.id }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        assert.equal((err as InstanceType<typeof HttpError>).code, "TASK_NOT_ASSIGNED_TO_YOU");
        return true;
      }
    );
  });

  test("a same-pole MANAGER and the task's own assignee can still update it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const owner = await prisma.user.create({ data: { email: `sec126-ownok-${Date.now()}@test.local`, name: "Owner OK", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(owner.id);
    const task = await makeTaskInService(serviceA, "sec126-ok", owner.id);

    const updated = await taskService.updateTask(task.id, { title: "renamed" }, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(updated.title, "renamed");

    const byOwner = await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "FREELANCER", userId: owner.id });
    assert.equal(byOwner.status, "IN_PROGRESS");
  });
});
