// No test imported commissionService directly before this file. computeForPaymentTx's real,
// invoice-triggered path was already covered by commissionCreationExclusivity.test.ts (RG-008),
// but setSplits (the rate validation an ADMIN goes through when assigning partner splits on a
// project) and markPaid (the payout confirmation) had zero coverage — not even a mirror.
//
// This test imports and calls the real commissionService — not a reimplementation — against a
// real, migrated database. Skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";
import type { Prisma } from "@prisma/client";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commissionService: typeof import("../src/services/commission.service.js").commissionService;
let dbAvailable = true;

let serviceId: string;
let adminId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdServiceIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commissionService } = await import("../src/services/commission.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
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
  await prisma.commission.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectCommissionSplit.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
});

async function makeProject(namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  return project;
}

async function makePartner(namePrefix: string) {
  const partner = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} partner`, passwordHash: "x", role: "MANAGER", serviceId },
  });
  createdUserIds.push(partner.id);
  return partner;
}

async function makeFreelancer(namePrefix: string) {
  const freelancer = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} freelancer`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancer.id);
  return freelancer;
}

async function assignTask(projectId: string, assigneeId: string, namePrefix: string) {
  const task = await prisma.task.create({
    data: { title: `${namePrefix} task`, projectId, assigneeId },
  });
  createdTaskIds.push(task.id);
  return task;
}

// A dedicated Service per auto-split scenario, isolated from the shared seeded serviceId — the
// auto-split calculation counts every MANAGER on the project's pole, which would be polluted by
// unrelated managers sharing the seeded service across concurrent test files.
async function makeIsolatedProject(namePrefix: string) {
  const service = await prisma.service.create({ data: { name: `${namePrefix}-service-${Date.now()}` } });
  createdServiceIds.push(service.id);
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId: service.id } });
  createdProjectIds.push(project.id);
  return project;
}

async function makeManagerForService(namePrefix: string, forServiceId: string) {
  const manager = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} manager`, passwordHash: "x", role: "MANAGER", serviceId: forServiceId },
  });
  createdUserIds.push(manager.id);
  return manager;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("commissionService.setSplits (real code, not a reimplementation)", () => {
  test("accepts splits summing to exactly 100%, persisted for real", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("split-100");
    const partnerA = await makePartner("split-100-a");
    const partnerB = await makePartner("split-100-b");

    const splits = await commissionService.setSplits(project.id, [
      { partnerId: partnerA.id, ratePct: 60 },
      { partnerId: partnerB.id, ratePct: 40 },
    ]);

    assert.equal(splits.length, 2);
    const persisted = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });
    assert.equal(persisted.length, 2, "splits must actually be written to the database");
  });

  test("accepts splits summing to less than 100% (not every project needs to allocate the full share)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("split-partial");
    const partner = await makePartner("split-partial-a");

    await assert.doesNotReject(() => commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 50 }]));
  });

  test("rejects splits summing to more than 100% with 422 COMMISSION_RATES_EXCEED_100", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("split-over");
    const partnerA = await makePartner("split-over-a");
    const partnerB = await makePartner("split-over-b");

    await assert.rejects(
      () =>
        commissionService.setSplits(project.id, [
          { partnerId: partnerA.id, ratePct: 70 },
          { partnerId: partnerB.id, ratePct: 40 },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "COMMISSION_RATES_EXCEED_100");
        return true;
      }
    );

    const persisted = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });
    assert.equal(persisted.length, 0, "a rejected call must not write any split");
  });

  test("rejects a non-positive rate with 422 INVALID_COMMISSION_RATE", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("split-zero-rate");
    const partner = await makePartner("split-zero-rate-a");

    await assert.rejects(
      () => commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 0 }]),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "INVALID_COMMISSION_RATE");
        return true;
      }
    );
  });

  test("rejects a duplicate partner in the same call with 422 DUPLICATE_COMMISSION_PARTNER", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("split-dup");
    const partner = await makePartner("split-dup-a");

    await assert.rejects(
      () =>
        commissionService.setSplits(project.id, [
          { partnerId: partner.id, ratePct: 30 },
          { partnerId: partner.id, ratePct: 20 },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "DUPLICATE_COMMISSION_PARTNER");
        return true;
      }
    );
  });

  test("rejects splits for a non-existent project with 404", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await assert.rejects(
      () => commissionService.setSplits("00000000-0000-0000-0000-000000000000", [{ partnerId: "00000000-0000-0000-0000-000000000001", ratePct: 50 }]),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("commissionService.markPaid (real code, not a reimplementation)", () => {
  async function makePendingCommission(namePrefix: string) {
    const project = await makeProject(namePrefix);
    const partner = await makePartner(`${namePrefix}-partner`);
    const invoice = await prisma.invoice.create({
      data: { number: `${namePrefix}-INV-${Date.now()}`, title: "Test", amount: 1000, currency: "TND", projectId: project.id, clientId: project.clientId! },
    });
    const payment = await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 400 } });
    const commission = await prisma.commission.create({
      data: { partnerId: partner.id, projectId: project.id, invoiceId: invoice.id, paymentId: payment.id, basis: 400, ratePct: 50, amount: 200 },
    });
    return commission;
  }

  test("marks a PENDING commission as PAID, stamping paidAt", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const commission = await makePendingCommission("markpaid-ok");

    const updated = await commissionService.markPaid(commission.id);

    assert.equal(updated.status, "PAID");
    assert.ok(updated.paidAt, "paidAt must be stamped");

    const persisted = await prisma.commission.findUnique({ where: { id: commission.id } });
    assert.equal(persisted!.status, "PAID", "the status change must actually be persisted, not just returned");
  });

  test("rejects marking an already-PAID commission again with 409 COMMISSION_ALREADY_PAID", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const commission = await makePendingCommission("markpaid-twice");
    await commissionService.markPaid(commission.id);

    await assert.rejects(
      () => commissionService.markPaid(commission.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "COMMISSION_ALREADY_PAID");
        return true;
      }
    );
  });

  test("rejects marking a non-existent commission with 404", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await assert.rejects(
      () => commissionService.markPaid("00000000-0000-0000-0000-000000000000"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

// RG-005-bis. Real calls against commissionService.recalcAutoSplit/resetToAutoSplit, not a
// reimplementation — each scenario uses its own isolated Service so unrelated MANAGERs from
// other tests/seed data can't leak into the "Managers of this pole" count.
describe("commissionService.recalcAutoSplit / resetToAutoSplit (RG-005-bis, real code)", () => {
  function byPartner(splits: { partnerId: string; ratePct: number | string | Prisma.Decimal }[]) {
    const map = new Map<string, number>();
    for (const s of splits) map.set(s.partnerId, Number(s.ratePct));
    return map;
  }

  test("no freelancer assigned, 2 managers: ADMIN 80%, managers split 20% evenly", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-80-20");
    const managerA = await makeManagerForService("auto-80-20-a", project.serviceId!);
    const managerB = await makeManagerForService("auto-80-20-b", project.serviceId!);

    const splits = await commissionService.recalcAutoSplit(project.id);
    const map = byPartner(splits);

    assert.equal(map.get(adminId), 80);
    assert.equal(map.get(managerA.id), 10);
    assert.equal(map.get(managerB.id), 10);
  });

  test("0 managers on the pole: the 20% Manager bucket rolls up to ADMIN (100%)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-0-managers");

    const splits = await commissionService.recalcAutoSplit(project.id);
    const map = byPartner(splits);

    assert.equal(map.size, 1);
    assert.equal(map.get(adminId), 100);
  });

  test("at least one freelancer assigned: ADMIN 40% / managers 20% / freelancers 40%, each bucket split evenly", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-40-20-40");
    const manager = await makeManagerForService("auto-40-20-40-mgr", project.serviceId!);
    const freelancerA = await makeFreelancer("auto-40-20-40-fa");
    const freelancerB = await makeFreelancer("auto-40-20-40-fb");
    await assignTask(project.id, freelancerA.id, "auto-40-20-40-ta");
    await assignTask(project.id, freelancerB.id, "auto-40-20-40-tb");

    const splits = await commissionService.recalcAutoSplit(project.id);
    const map = byPartner(splits);

    assert.equal(map.get(adminId), 40);
    assert.equal(map.get(manager.id), 20);
    assert.equal(map.get(freelancerA.id), 20);
    assert.equal(map.get(freelancerB.id), 20);
  });

  test("a project in MANUAL mode is never overwritten by recalcAutoSplit — only the desync flag is raised", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-manual-freeze");
    const manualPartner = await makePartner("auto-manual-freeze-partner");
    await commissionService.setSplits(project.id, [{ partnerId: manualPartner.id, ratePct: 55 }]);

    const before = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });
    await commissionService.recalcAutoSplit(project.id);
    const after = await prisma.projectCommissionSplit.findMany({ where: { projectId: project.id } });

    assert.equal(after.length, before.length);
    assert.equal(Number(after[0]!.ratePct), Number(before[0]!.ratePct));
    const updatedProject = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(updatedProject!.commissionSplitMode, "MANUAL");
    assert.equal(updatedProject!.commissionSplitDesynced, true, "a MANUAL project must be flagged desynced instead of overwritten");
  });

  test("setSplits (manual edit) switches the project to MANUAL and clears any desync flag", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-to-manual");
    const partner = await makePartner("auto-to-manual-partner");

    const before = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(before!.commissionSplitMode, "AUTO");

    await commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 70 }]);

    const updated = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(updated!.commissionSplitMode, "MANUAL");
    assert.equal(updated!.commissionSplitDesynced, false);
  });

  test("resetToAutoSplit switches back to AUTO, clears the desync flag, and recalculates", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-reset");
    const manualPartner = await makePartner("auto-reset-partner");
    await commissionService.setSplits(project.id, [{ partnerId: manualPartner.id, ratePct: 90 }]);
    // Cross the freelancer threshold while still MANUAL, to raise the desync flag.
    const freelancer = await makeFreelancer("auto-reset-freelancer");
    await assignTask(project.id, freelancer.id, "auto-reset-task");
    await commissionService.recalcAutoSplit(project.id);
    const desynced = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(desynced!.commissionSplitDesynced, true);

    const splits = await commissionService.resetToAutoSplit(project.id);
    const map = byPartner(splits);

    const updated = await prisma.project.findUnique({ where: { id: project.id } });
    assert.equal(updated!.commissionSplitMode, "AUTO");
    assert.equal(updated!.commissionSplitDesynced, false);
    // 0 managers on this isolated pole: their 20% bucket rolls up to ADMIN (40% base + 20%).
    assert.equal(map.get(adminId), 60);
    assert.equal(map.get(freelancer.id), 40);
  });

  test("recalcAutoSplit writes a CommissionSplitHistory row with the AUTO_RECALC trigger", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeIsolatedProject("auto-history");

    await commissionService.recalcAutoSplit(project.id);

    const history = await prisma.commissionSplitHistory.findMany({ where: { projectId: project.id } });
    assert.equal(history.length, 1);
    assert.equal(history[0]!.trigger, "AUTO_RECALC");
  });
});

// RG-030 (refonte paiement à la tâche, LOT 2). Real calls against
// commissionService.setProjectPayoutBudget/getProjectSplitState — not a reimplementation.
describe("commissionService.setProjectPayoutBudget / getProjectSplitState.payoutBudget (RG-030, real code)", () => {
  test("setProjectPayoutBudget persists a positive amount, readable back via getProjectSplitState", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("payout-budget-set");

    const result = await commissionService.setProjectPayoutBudget(project.id, 5000);
    assert.equal(result.payoutBudget, 5000);

    const state = await commissionService.getProjectSplitState(project.id);
    assert.equal(state.payoutBudget, 5000);
  });

  test("setProjectPayoutBudget(null) clears a previously set budget", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("payout-budget-clear");
    await commissionService.setProjectPayoutBudget(project.id, 3000);

    const result = await commissionService.setProjectPayoutBudget(project.id, null);
    assert.equal(result.payoutBudget, null);

    const state = await commissionService.getProjectSplitState(project.id);
    assert.equal(state.payoutBudget, null);
  });

  test("setProjectPayoutBudget rejects a non-existent project with 404", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await assert.rejects(
      () => commissionService.setProjectPayoutBudget("00000000-0000-0000-0000-000000000000", 1000),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test("getProjectSplitState.payoutBudget defaults to null when never set — no existing project is modified by the migration", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("payout-budget-default");

    const state = await commissionService.getProjectSplitState(project.id);
    assert.equal(state.payoutBudget, null);
  });

  test("getProjectSplitState.suggestedPayoutBudget is 65% of the accepted proposal's amount, never persisted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "payout-suggestion client" } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "payout-suggestion proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({
      data: { name: "payout-suggestion project", clientId: client.id, serviceId, proposalId: proposal.id },
    });
    createdProjectIds.push(project.id);

    const state = await commissionService.getProjectSplitState(project.id);
    assert.equal(state.suggestedPayoutBudget, 650, "65% of 1000");
    assert.equal(state.payoutBudget, null, "the suggestion must never be written to payoutBudget automatically");

    const persisted = await prisma.project.findUnique({ where: { id: project.id }, select: { payoutBudget: true } });
    assert.equal(persisted!.payoutBudget, null, "confirms the suggestion never reaches the database on its own");
  });

  test("getProjectSplitState.suggestedPayoutBudget is null for a project with no proposal", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const project = await makeProject("payout-suggestion-none");

    const state = await commissionService.getProjectSplitState(project.id);
    assert.equal(state.suggestedPayoutBudget, null);
  });
});
