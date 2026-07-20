// SEC-087: this file previously tested `projectFilter`/`isProjectInScope` — two functions
// defined LOCALLY in this file, mirroring a `companyId` concept that does not exist anywhere in
// this mono-tenant repo (CLAUDE.md: no companyId/tenantId). It would have stayed green even if
// the real scoping (task.repository.ts#buildWhere, serviceScope.ts#assertProjectInScope) had
// drifted from its documented behavior — exactly the class of defect CLAUDE.md warns against
// ("a test that reimplements its target... proves nothing").
//
// This test imports and calls the real taskService.getAllTasks/getTaskById against a real
// database instead — proving MANAGER read scoping actually works:
// 1. ADMIN sees tasks across every pole.
// 2. A MANAGER only sees tasks whose project belongs to their own pole.
// 3. A MANAGER of another pole 404s on getTaskById for a task outside their scope.
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
});

async function makeTaskInService(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: `${namePrefix} task`, projectId: project.id } });
  createdTaskIds.push(task.id);
  return task;
}

describe("task read scope by role — SEC-087 (real code, not a reimplementation)", () => {
  test("ADMIN sees tasks across every pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const taskA = await makeTaskInService(serviceA, "admin-scope-a");
    const taskB = await makeTaskInService(serviceB, "admin-scope-b");

    const result = await taskService.getAllTasks(undefined, "admin-id", "ADMIN", { page: 1, pageSize: 200 });
    const ids = result.data.map((t) => t.id);
    assert.ok(ids.includes(taskA.id));
    assert.ok(ids.includes(taskB.id));
  });

  test("MANAGER only sees tasks whose project belongs to their own pole", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const taskA = await makeTaskInService(serviceA, "manager-scope-a");
    const taskB = await makeTaskInService(serviceB, "manager-scope-b");

    const result = await taskService.getAllTasks(
      undefined,
      "manager-id",
      "MANAGER",
      { page: 1, pageSize: 200 },
      { userRole: "MANAGER", userServiceId: serviceA }
    );
    const ids = result.data.map((t) => t.id);
    assert.ok(ids.includes(taskA.id), "a MANAGER must see a task in their own pole");
    assert.ok(!ids.includes(taskB.id), "a MANAGER must never see a task from another pole");
  });

  test("MANAGER of another pole 404s on getTaskById for a task outside their scope", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const taskB = await makeTaskInService(serviceB, "manager-getbyid-b");

    await assert.rejects(
      () => taskService.getTaskById(taskB.id, "manager-id", "MANAGER", { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );

    const found = await taskService.getTaskById(taskB.id, "manager-id", "MANAGER", { userRole: "MANAGER", userServiceId: serviceB });
    assert.equal(found.id, taskB.id);
  });
});
