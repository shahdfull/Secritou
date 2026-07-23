// SEC-171 (2nd wave): taskWithRelationsSelect (server/src/utils/prismaSelects.ts) was reused
// unchanged by taskRepository.findAll (the main task list endpoint, up to 200 rows per call) —
// every listed task carried its full `description` (Text, potentially long), even though no
// list/Kanban view renders it (grep confirmed: TaskDetailDrawer.tsx is the sole consumer). The
// first wave of SEC-171 fixed the same over-fetching pattern for leadRepository — this is the
// Task counterpart. Fixed with a dedicated `taskListSelect` for findAll only; findById/create/
// update/delete keep using taskWithRelationsSelect unchanged (their callers — e.g. right after a
// mutation — expect the full task back).
//
// This test imports and calls the real taskService.getAllTasks/getTaskById against a real
// database — not a reimplementation — and confirms a task created with a long description does
// NOT carry it in the list result, while getTaskById still returns it.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 1 });
    if (services.length < 1) throw new Error("need at least 1 seeded Service row");
    serviceA = services[0]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("taskRepository.findAll excludes description from the list payload (SEC-171)", () => {
  test("a task with a long description does not carry it in the list result, but getTaskById still returns it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec171-task client", serviceId: serviceA } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec171-task project", clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);
    const longDescription = "x".repeat(5000);
    const task = await prisma.task.create({ data: { title: "sec171 task", projectId: project.id, description: longDescription } });

    const listResult = await taskService.getAllTasks(project.id, "admin-id", "ADMIN", { page: 1, pageSize: 50, orderDir: "desc" });
    const found = listResult.data.find((t2) => t2.id === task.id);
    assert.ok(found, "the task must appear in the list");
    assert.equal("description" in found!, false, "description must not be present in the list payload at all");

    const detail = await taskService.getTaskById(task.id, "admin-id", "ADMIN");
    assert.equal(detail.description, longDescription, "the detail view (getTaskById) must still return the full description");
  });
});
