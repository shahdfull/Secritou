// RG-005-bis (REFERENTIEL.md §5): recalcAutoSplit must fire from a real task assignment, not
// just be callable directly — this test calls taskService.createTask/updateTask for real
// (not a reimplementation) and checks the resulting ProjectCommissionSplit rows and
// CommissionSplitHistory trigger, against a real, migrated database. Skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

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

// taskService transitively imports jobs/queues.js, which opens a real BullMQ/ioredis connection
// at module load. This file relies on test/run-all.test.ts's own top-level after() to close that
// shared connection (same pattern as every other test file that touches a queue-importing
// service, e.g. analyticsCommissionScope.test.ts) — a second close here would race it. Run this
// file via `npm run test:unit` (test/run-all.test.ts); running it standalone will hang on exit,
// same as those other files.

async function makeIsolatedProject(namePrefix: string) {
  const service = await prisma.service.create({ data: { name: `${namePrefix}-service-${Date.now()}` } });
  createdServiceIds.push(service.id);
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId: service.id } });
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

// SEC-195 pattern: dbAvailable is only correct after before() resolves, so it's checked inside
// each test body via t.skip(), never in a synchronously-evaluated { skip } option.
describe("taskService createTask/updateTask trigger recalcAutoSplit on the 0<->1 freelancer threshold (RG-005-bis)", () => {
  test("createTask assigning the project's first freelancer triggers a recalculation to the 'has freelancer' split", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("trigger-create");
    const freelancer = await makeFreelancer("trigger-create-fl");

    const task = await taskService.createTask(
      { title: "First task", projectId: project.id, assigneeId: freelancer.id },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);

    const splits = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });
    const byPartner = new Map(splits.map((s) => [s.partnerId, Number(s.ratePct)]));
    // 0 managers on this pole: their 20% bucket rolls up to ADMIN even when a freelancer is
    // assigned (40% base + 20% rollup = 60%), per RG-005-bis's roll-up rule.
    assert.equal(byPartner.get(adminId), 60, "no manager on this pole: ADMIN gets 40% base + the managers' 20% rollup");
    assert.equal(byPartner.get(freelancer.id), 40, "the sole freelancer gets the full 40% freelancer bucket");

    const history = await prisma.commissionSplitHistory.findMany({ where: { projectId: project.id } });
    assert.equal(history.length, 1);
    assert.equal(history[0]!.trigger, "AUTO_RECALC");
  });

  test("createTask with no assignee does not trigger a recalculation", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("trigger-create-noassignee");

    const task = await taskService.createTask({ title: "Unassigned task", projectId: project.id }, { userRole: "ADMIN" });
    createdTaskIds.push(task.id);

    const history = await prisma.commissionSplitHistory.findMany({ where: { projectId: project.id } });
    assert.equal(history.length, 0, "no freelancer assignment means no threshold crossing, so no recalculation");
  });

  // SEC-016: the assigneeId:null unassignment path is real now (shared/src/schemas/task.schema.ts
  // accepts assigneeId.nullable(), and TaskEditDialog.tsx has a "Retirer l'assigné" button — see
  // server/test/taskUpdateScope.test.ts for the plain persistence proof), but until this test was
  // added, nothing proved that removing the project's sole freelancer crosses the 1->0 threshold
  // and re-triggers recalcAutoSplit down to the "no freelancer" split.
  test("updateTask removing the project's sole freelancer (assigneeId: null) crosses the threshold back to 0 and re-triggers recalcAutoSplit", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("trigger-unassign");
    const freelancer = await makeFreelancer("trigger-unassign-fl");
    const task = await taskService.createTask(
      { title: "Solo freelancer task", projectId: project.id, assigneeId: freelancer.id },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);

    // First recalc landed on task creation (0->1 crossing): sanity-checked by the "has freelancer"
    // test above. Now remove the assignee — this must cross 1->0 and re-fire recalcAutoSplit.
    await taskService.updateTask(task.id, { assigneeId: null }, { userRole: "ADMIN" });

    const persisted = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(persisted?.assigneeId, null, "the assignee must actually be cleared for the threshold to cross");

    const history = await prisma.commissionSplitHistory.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(history.length, 2, "the 0->1 crossing on create and the 1->0 crossing on unassignment must each fire exactly one recalculation");
    assert.equal(history[1]!.trigger, "AUTO_RECALC");

    const splits = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });
    const byPartner = new Map(splits.map((s) => [s.partnerId, Number(s.ratePct)]));
    // Back to "no freelancer" on a pole with 0 managers: computeAutoSplit gives ADMIN the 80%
    // no-freelancer base bucket PLUS the managers' 20% bucket rolled up (0 managers on this
    // pole), for a full 100% — same distribution as if no freelancer had ever been assigned
    // (mirrors the "no freelancer" branch already asserted by the sibling createTask test above).
    assert.equal(byPartner.get(adminId), 100, "with the sole freelancer removed and 0 managers on the pole, ADMIN must receive the full no-freelancer split");
    assert.equal(byPartner.has(freelancer.id), false, "the departed freelancer must no longer hold any share of the split");
  });

  test("updateTask reassigning between two freelancers (still >=1 assigned) does not cross the threshold, no extra recalculation", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("trigger-reassign");
    const freelancerA = await makeFreelancer("trigger-reassign-fa");
    const freelancerB = await makeFreelancer("trigger-reassign-fb");
    const task = await taskService.createTask(
      { title: "Reassigned task", projectId: project.id, assigneeId: freelancerA.id },
      { userRole: "ADMIN" }
    );
    createdTaskIds.push(task.id);

    await taskService.updateTask(task.id, { assigneeId: freelancerB.id }, { userRole: "ADMIN" });

    const history = await prisma.commissionSplitHistory.findMany({ where: { projectId: project.id } });
    assert.equal(history.length, 1, "reassigning between two freelancers never drops the count to 0, so no second recalculation fires");
  });
});
