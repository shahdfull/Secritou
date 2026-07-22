// SEC-126 (ANOMALIES.yaml): taskScope.test.ts (SEC-087) only covers read scoping
// (getAllTasks/getTaskById) — taskService.updateTask has its own scope guards
// (assertProjectInScope for MANAGER, an assignee check for FREELANCER, task.service.ts:142-162)
// but no test had ever called the real service to prove either refusal actually fires.
//
// This test imports and calls the real taskService.updateTask — not a reimplementation —
// against a real database, proving:
// 1. A MANAGER whose pole doesn't own the task's project is refused (403 PROJECT_OUT_OF_SCOPE).
// 2. A FREELANCER who isn't the task's assignee is refused (403 TASK_NOT_ASSIGNED_TO_YOU).
// 3. A same-pole MANAGER and the actual assignee FREELANCER can both update it.
//
// Requires a real, migrated database; skipped if unreachable.

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
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId, status: "IN_PROGRESS" } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: `${namePrefix} task`, projectId: project.id, assigneeId } });
  createdTaskIds.push(task.id);
  return task;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("taskService.updateTask enforces scope on write (SEC-126)", () => {
  test("a MANAGER outside the task's pole is refused with PROJECT_OUT_OF_SCOPE", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const task = await makeTaskInService(serviceB, "sec126-manager-oop");

    await assert.rejects(
      () => taskService.updateTask(task.id, { title: "hacked" }, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 403 && err.code === "PROJECT_OUT_OF_SCOPE"
    );

    const unchanged = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(unchanged?.title, `sec126-manager-oop task`, "the refused update must not have applied");
  });

  test("a same-pole MANAGER can update the task", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const task = await makeTaskInService(serviceA, "sec126-manager-own");

    const updated = await taskService.updateTask(task.id, { title: "renamed by own-pole manager" }, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(updated.title, "renamed by own-pole manager");
  });

  test("a FREELANCER who isn't the assignee is refused with TASK_NOT_ASSIGNED_TO_YOU", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const assignee = await prisma.user.create({ data: { email: `sec126-assignee-${Date.now()}@example.com`, name: "Assignee", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(assignee.id);
    const stranger = await prisma.user.create({ data: { email: `sec126-stranger-${Date.now()}@example.com`, name: "Stranger", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(stranger.id);

    const task = await makeTaskInService(serviceA, "sec126-freelancer-scope", assignee.id);

    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "FREELANCER", userId: stranger.id }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 403 && err.code === "TASK_NOT_ASSIGNED_TO_YOU"
    );
  });

  test("the actual assignee FREELANCER can update the task's status", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const assignee = await prisma.user.create({ data: { email: `sec126-real-assignee-${Date.now()}@example.com`, name: "Real Assignee", passwordHash: "x", role: "FREELANCER" } });
    createdUserIds.push(assignee.id);

    const task = await makeTaskInService(serviceA, "sec126-freelancer-own", assignee.id);

    const updated = await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "FREELANCER", userId: assignee.id });
    assert.equal(updated.status, "IN_PROGRESS");
  });
});
