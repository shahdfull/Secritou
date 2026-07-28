// RG-006/RG-007/RG-009 (refonte paiement à la tâche, LOT 3). Real calls against
// taskService.createTask/updateTask — not a reimplementation — against a real, migrated
// database. Skipped if unreachable.
//
// taskService transitively imports jobs/queues.js, which opens a real BullMQ/ioredis connection
// at module load. This file relies on test/run-all.test.ts's own top-level after() to close that
// shared connection (same pattern as commissionAutoSplitTaskTrigger.test.ts) — run via
// `npm run test:unit`; standalone it will hang on exit.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let adminId: string;
const createdServiceIds: string[] = [];
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) throw new Error("no ADMIN seeded");
    adminId = admin.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.commissionSplitHistory.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectCommissionSplit.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
});

// A dedicated Service/Project in PER_TASK mode with a payout budget, isolated from other test
// files' data (mirrors commissionAutoSplitTaskTrigger.test.ts's own makeIsolatedProject).
async function makePerTaskProject(namePrefix: string, payoutBudget: number) {
  const service = await prisma.service.create({ data: { name: `${namePrefix}-service-${Date.now()}` } });
  createdServiceIds.push(service.id);
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({
    data: { name: `${namePrefix} project`, clientId: client.id, serviceId: service.id, commissionSplitMode: "PER_TASK", payoutBudget },
  });
  createdProjectIds.push(project.id);
  return { project, service };
}

async function makeFreelancer(namePrefix: string) {
  const freelancer = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} freelancer`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancer.id);
  return freelancer;
}

async function makeManagerForService(namePrefix: string, serviceId: string) {
  const manager = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} manager`, passwordHash: "x", role: "MANAGER", serviceId },
  });
  createdUserIds.push(manager.id);
  return manager;
}

// SEC-195 pattern: dbAvailable is only correct after before() resolves, so it's checked inside
// each test body via t.skip(), never in a synchronously-evaluated { skip } option.
describe("RG-006: payout budget envelope, worst-case coefficient (real code)", () => {
  test("createTask with a payoutAmount that fits the budget at the 1.20x worst case succeeds", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project } = await makePerTaskProject("rg006-fits", 120);

    const task = await taskService.createTask(
      { title: "Fits budget", projectId: project.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);

    const persisted = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(Number(persisted!.payoutAmount), 100);
  });

  test("a payoutAmount that fits at 1.00x but fails at the 1.20x worst case is rejected with 422 PAYOUT_BUDGET_EXCEEDED", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    // 100 * 1.20 = 120, exactly the budget: still allowed. 101 * 1.20 = 121.2 > 120: rejected.
    // budget = 100 means a task at 100 (1.00x, fits) still fails the same task at 1.20x
    // (100 * 1.20 = 120 > 100) — this is exactly the "passes at 1.00x, fails at 1.20x" case.
    const { project } = await makePerTaskProject("rg006-worstcase", 100);

    await assert.rejects(
      () => taskService.createTask({ title: "Fails worst case", projectId: project.id, payoutAmount: 100 }, { userRole: "ADMIN" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PAYOUT_BUDGET_EXCEEDED");
        return true;
      }
    );

    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    assert.equal(tasks.length, 0, "a rejected write must not create the task with a payoutAmount that violates the envelope");
  });

  test("setting payoutAmount via updateTask is rejected with 422 PAYOUT_BUDGET_NOT_SET when no budget is fixed", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg006-nobudget-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg006-nobudget client" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg006-nobudget project", clientId: client.id, serviceId: service.id, commissionSplitMode: "PER_TASK" },
    });
    createdProjectIds.push(project.id);

    const task = await taskService.createTask({ title: "No budget task", projectId: project.id }, { userRole: "ADMIN" });
    createdTaskIds.push(task.id);

    await assert.rejects(
      () => taskService.updateTask(task.id, { payoutAmount: 50 }, { userRole: "ADMIN" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PAYOUT_BUDGET_NOT_SET");
        return true;
      }
    );
  });

  test("updateTask accepts a payoutAmount change that keeps the total within budget, accounting for other tasks", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project } = await makePerTaskProject("rg006-multi", 240);
    const taskA = await taskService.createTask({ title: "Task A", projectId: project.id, payoutAmount: 50 }, { userRole: "ADMIN" });
    createdTaskIds.push(taskA.id);
    const taskB = await taskService.createTask({ title: "Task B", projectId: project.id, payoutAmount: 50 }, { userRole: "ADMIN" });
    createdTaskIds.push(taskB.id);
    // Current worst case: (50 + 50) * 1.20 = 120, well under 240.

    // Raising task B to 100: (50 + 100) * 1.20 = 180, still under 240 — must succeed.
    await taskService.updateTask(taskB.id, { payoutAmount: 100 }, { userRole: "ADMIN" });
    const updated = await prisma.task.findUnique({ where: { id: taskB.id } });
    assert.equal(Number(updated!.payoutAmount), 100);
  });
});

describe("RG-007: a task cannot leave TODO without payoutAmount set, on a PER_TASK project (real code)", () => {
  test("updateTask rejects a TODO -> IN_PROGRESS transition with no payoutAmount, 422 TASK_PAYOUT_NOT_SET", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project } = await makePerTaskProject("rg007-block", 1000);
    const task = await taskService.createTask({ title: "No payout task", projectId: project.id }, { userRole: "ADMIN" });
    createdTaskIds.push(task.id);

    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "TASK_PAYOUT_NOT_SET");
        return true;
      }
    );
  });

  test("updateTask allows the TODO -> IN_PROGRESS transition once payoutAmount is set", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project } = await makePerTaskProject("rg007-allow", 1000);
    const task = await taskService.createTask({ title: "Payout set task", projectId: project.id, payoutAmount: 200 }, { userRole: "ADMIN" });
    createdTaskIds.push(task.id);

    const updated = await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    assert.equal(updated.status, "IN_PROGRESS");
  });

  test("a task on an AUTO-mode project can leave TODO without payoutAmount — RG-007 only applies to PER_TASK", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg007-auto-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg007-auto client" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg007-auto project", clientId: client.id, serviceId: service.id },
    });
    createdProjectIds.push(project.id);
    const task = await taskService.createTask({ title: "Auto mode task", projectId: project.id }, { userRole: "ADMIN" });
    createdTaskIds.push(task.id);

    const updated = await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    assert.equal(updated.status, "IN_PROGRESS");
  });
});

describe("RG-009: self-validation conflict of interest (real code)", () => {
  test("a MANAGER cannot validate (move to DONE) their own task in their own pole — 403 SELF_VALIDATION_FORBIDDEN", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project, service } = await makePerTaskProject("rg009-forbidden", 1000);
    const manager = await makeManagerForService("rg009-forbidden-mgr", service.id);
    const task = await taskService.createTask(
      { title: "Manager's own task", projectId: project.id, assigneeId: manager.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    await assert.rejects(
      () => taskService.updateTask(task.id, { status: "DONE" }, { userRole: "MANAGER", userId: manager.id, userServiceId: service.id }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "SELF_VALIDATION_FORBIDDEN");
        return true;
      }
    );
  });

  test("an ADMIN can validate a task assigned to the pole's own Manager", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project, service } = await makePerTaskProject("rg009-admin-ok", 1000);
    const manager = await makeManagerForService("rg009-admin-ok-mgr", service.id);
    const task = await taskService.createTask(
      { title: "Manager's own task, ADMIN validates", projectId: project.id, assigneeId: manager.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    const updated = await taskService.updateTask(task.id, { status: "DONE" }, { userRole: "ADMIN", userId: adminId });

    assert.equal(updated.status, "DONE");
    assert.equal(updated.validatedById, adminId);
    assert.ok(updated.validatedAt, "validatedAt must be stamped on the DONE transition");
  });

  test("a MANAGER can validate a FREELANCER's task in their own pole — no conflict of interest", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { project, service } = await makePerTaskProject("rg009-freelancer-ok", 1000);
    const manager = await makeManagerForService("rg009-freelancer-ok-mgr", service.id);
    const freelancer = await makeFreelancer("rg009-freelancer-ok-fl");
    const task = await taskService.createTask(
      { title: "Freelancer task", projectId: project.id, assigneeId: freelancer.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    const updated = await taskService.updateTask(
      task.id,
      { status: "DONE" },
      { userRole: "MANAGER", userId: manager.id, userServiceId: service.id }
    );

    assert.equal(updated.status, "DONE");
    assert.equal(updated.validatedById, manager.id);
  });
});
