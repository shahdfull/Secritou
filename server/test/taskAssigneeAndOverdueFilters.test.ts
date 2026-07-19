// SEC-056 (U1, rapport designer UI/UX, session 2026-07-19) : TasksListView.tsx only offered a
// status filter + text search — missing project (already supported server-side, see SEC-052),
// assignee, and "overdue only" filters, even though these dimensions already existed elsewhere in
// the app (sortable columns, the red-text overdue convention). The server had no generic
// assigneeId filter (only the FREELANCER auto-scope) and no overdue filter at all.
//
// This test imports and calls the real taskService.getAllTasks against a real database — not a
// reimplementation — proving:
// 1. assigneeId filters correctly for ADMIN/MANAGER.
// 2. assigneeId can NEVER override a FREELANCER's own auto-scope — the critical security
//    property: a freelancer must not be able to browse another freelancer's tasks by supplying
//    an arbitrary assigneeId query param.
// 3. overdue filters correctly (dueDate in the past, status != DONE).
// 4. overdue takes priority over a conflicting options.status without silently corrupting the
//    Prisma where clause (both are "status" keys internally).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];

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
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeProject() {
  const client = await prisma.client.create({ data: { name: "task-filters client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "task-filters project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  return project;
}

async function makeFreelancer(suffix: string) {
  const user = await prisma.user.create({
    data: { email: `flancer-${suffix}@test.local`, name: `F-${suffix}`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("assigneeId filter — SEC-056", () => {
  test("ADMIN filtering by assigneeId only sees that assignee's tasks", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const freelancerA = await makeFreelancer("a1");
    const freelancerB = await makeFreelancer("a2");
    const taskA = await prisma.task.create({ data: { title: "task A", projectId: project.id, assigneeId: freelancerA.id } });
    const taskB = await prisma.task.create({ data: { title: "task B", projectId: project.id, assigneeId: freelancerB.id } });
    createdTaskIds.push(taskA.id, taskB.id);

    const result = await taskService.getAllTasks(undefined, "admin-id", "ADMIN", { page: 1, pageSize: 50 }, undefined, { assigneeId: freelancerA.id });

    const ids = result.data.map((tk) => tk.id);
    assert.ok(ids.includes(taskA.id));
    assert.ok(!ids.includes(taskB.id));
  });

  test("a FREELANCER's own auto-scope cannot be overridden by an arbitrary assigneeId (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const freelancerSelf = await makeFreelancer("self1");
    const freelancerOther = await makeFreelancer("other1");
    const taskSelf = await prisma.task.create({ data: { title: "self task", projectId: project.id, assigneeId: freelancerSelf.id } });
    const taskOther = await prisma.task.create({ data: { title: "other task", projectId: project.id, assigneeId: freelancerOther.id } });
    createdTaskIds.push(taskSelf.id, taskOther.id);

    // freelancerSelf calls the endpoint while supplying freelancerOther's id as assigneeId —
    // must still only ever see their own tasks, never freelancerOther's.
    const result = await taskService.getAllTasks(
      undefined,
      freelancerSelf.id,
      "FREELANCER",
      { page: 1, pageSize: 50 },
      undefined,
      { assigneeId: freelancerOther.id }
    );

    const ids = result.data.map((tk) => tk.id);
    assert.ok(ids.includes(taskSelf.id));
    assert.ok(!ids.includes(taskOther.id));
  });
});

describe("overdue filter — SEC-056", () => {
  test("overdue=true returns only past-due, non-DONE tasks", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const overdueTask = await prisma.task.create({ data: { title: "overdue", projectId: project.id, dueDate: yesterday, status: "IN_PROGRESS" } });
    const overdueButDone = await prisma.task.create({ data: { title: "overdue but done", projectId: project.id, dueDate: yesterday, status: "DONE" } });
    const notYetDue = await prisma.task.create({ data: { title: "not due yet", projectId: project.id, dueDate: tomorrow, status: "TODO" } });
    createdTaskIds.push(overdueTask.id, overdueButDone.id, notYetDue.id);

    const result = await taskService.getAllTasks(project.id, "admin-id", "ADMIN", { page: 1, pageSize: 50 }, undefined, { overdue: true });

    const ids = result.data.map((tk) => tk.id);
    assert.ok(ids.includes(overdueTask.id));
    assert.ok(!ids.includes(overdueButDone.id), "a DONE task must never count as overdue");
    assert.ok(!ids.includes(notYetDue.id));
  });

  test("overdue=true takes priority over a conflicting options.status without corrupting the query", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const project = await makeProject();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const overdueTask = await prisma.task.create({ data: { title: "overdue conflict", projectId: project.id, dueDate: yesterday, status: "IN_PROGRESS" } });
    createdTaskIds.push(overdueTask.id);

    // Passing status: "DONE" alongside overdue: true is a combination the client never actually
    // offers (the "overdue" toggle disables the status dropdown), but the server must not
    // silently break — it must not throw, and overdue must win rather than producing two
    // conflicting `status` keys in the same where clause.
    const result = await taskService.getAllTasks(
      project.id,
      "admin-id",
      "ADMIN",
      { page: 1, pageSize: 50, status: "DONE" },
      undefined,
      { overdue: true }
    );

    const ids = result.data.map((tk) => tk.id);
    assert.ok(ids.includes(overdueTask.id));
  });
});
