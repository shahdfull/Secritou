// RG-032 (refonte paiement à la tâche, LOT 4). Real calls against taskService.updateTask (the
// DONE transition) — not a reimplementation — against a real, migrated database. Skipped if
// unreachable. Run via `npm run test:unit` (test/run-all.test.ts owns the shared Redis/BullMQ
// connection close, same as taskPayoutRules.test.ts).

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

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
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.commission.deleteMany({ where: { taskId: { in: createdTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
});

async function makePerTaskProject(namePrefix: string, payoutBudget: number) {
  const service = await prisma.service.create({ data: { name: `${namePrefix}-service-${Date.now()}` } });
  createdServiceIds.push(service.id);
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({
    data: { name: `${namePrefix} project`, clientId: client.id, serviceId: service.id, commissionSplitMode: "PER_TASK", payoutBudget },
  });
  createdProjectIds.push(project.id);
  return project;
}

async function makeFreelancer(namePrefix: string) {
  const freelancer = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} freelancer`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancer.id);
  return freelancer;
}

describe("RG-032: TASK_FIXED commission generated on the DONE transition (real code)", () => {
  test("a task with no dueDate, qualityScore 3, no rework: coefficient 1.00, amount = payoutAmount", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makePerTaskProject("rg008-nominal", 1000);
    const freelancer = await makeFreelancer("rg008-nominal-fl");
    const task = await taskService.createTask(
      { title: "Nominal", projectId: project.id, assigneeId: freelancer.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    await taskService.updateTask(task.id, { status: "DONE", qualityScore: 3 }, { userRole: "ADMIN" });

    const commission = await prisma.commission.findFirst({ where: { taskId: task.id } });
    assert.ok(commission, "a TASK_FIXED commission must be created on the DONE transition");
    assert.equal(commission!.source, "TASK_FIXED");
    assert.equal(commission!.partnerId, freelancer.id);
    assert.equal(Number(commission!.baseAmount), 100);
    assert.equal(Number(commission!.coefficient), 1.00);
    assert.equal(Number(commission!.amount), 100);
    assert.equal(commission!.status, "PENDING");
  });

  test("qualityScore 5 and no rework: coefficient 1.10", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makePerTaskProject("rg008-bonus", 1000);
    const freelancer = await makeFreelancer("rg008-bonus-fl");
    const task = await taskService.createTask(
      { title: "Bonus", projectId: project.id, assigneeId: freelancer.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    await taskService.updateTask(task.id, { status: "DONE", qualityScore: 5 }, { userRole: "ADMIN" });

    const commission = await prisma.commission.findFirst({ where: { taskId: task.id } });
    assert.equal(Number(commission!.coefficient), 1.10);
    assert.equal(Number(commission!.amount), 110);
  });

  test("qualityScore 1 and reworkCount >= 3: coefficient clamped to the 0.85 floor (-0.05 quality -0.05 rework, still 0.90 raw, but a late+bad case clamps lower)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makePerTaskProject("rg008-floor", 1000);
    const freelancer = await makeFreelancer("rg008-floor-fl");
    const pastDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const task = await taskService.createTask(
      { title: "Floor", projectId: project.id, assigneeId: freelancer.id, payoutAmount: 100, dueDate: pastDue },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    // Force reworkCount to 3 directly (no API path to increment it — out of this lot's scope).
    await prisma.task.update({ where: { id: task.id }, data: { reworkCount: 3 } });

    await taskService.updateTask(task.id, { status: "DONE", qualityScore: 1 }, { userRole: "ADMIN" });

    // coefDeadline 0.85 (>24h late) + bonusQualite -0.05 (score 1) + malusReprises -0.05 = 0.75,
    // clamped to the 0.85 floor.
    const commission = await prisma.commission.findFirst({ where: { taskId: task.id } });
    assert.equal(Number(commission!.coefficient), 0.85);
    assert.equal(Number(commission!.amount), 85);
  });

  test("a project in AUTO mode generates no TASK_FIXED commission on DONE", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg008-auto-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg008-auto client" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "rg008-auto project", clientId: client.id, serviceId: service.id } });
    createdProjectIds.push(project.id);
    const freelancer = await makeFreelancer("rg008-auto-fl");
    const task = await taskService.createTask(
      { title: "Auto mode", projectId: project.id, assigneeId: freelancer.id },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    await taskService.updateTask(task.id, { status: "DONE", qualityScore: 4 }, { userRole: "ADMIN" });

    const commission = await prisma.commission.findFirst({ where: { taskId: task.id } });
    assert.equal(commission, null, "no commission should be generated for an AUTO-mode project");
  });

  test("moving a DONE task with an existing commission away from DONE does not delete the commission", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makePerTaskProject("rg008-nodelete", 1000);
    const freelancer = await makeFreelancer("rg008-nodelete-fl");
    const task = await taskService.createTask(
      { title: "No delete", projectId: project.id, assigneeId: freelancer.id, payoutAmount: 100 },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);
    await taskService.updateTask(task.id, { status: "IN_PROGRESS" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });
    await taskService.updateTask(task.id, { status: "DONE", qualityScore: 3 }, { userRole: "ADMIN" });

    await taskService.updateTask(task.id, { status: "REVIEW" }, { userRole: "ADMIN" });

    const commission = await prisma.commission.findFirst({ where: { taskId: task.id } });
    assert.ok(commission, "the commission must still exist after the task leaves DONE — never auto-deleted");
  });
});
