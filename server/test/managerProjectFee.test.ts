// RG-006/RG-010/RG-011 (refonte paiement à la tâche, LOT 5). Real calls against
// projectService.clientApprove and commissionService.setSplits/resetToAutoSplit/setManagerFee —
// not reimplementations — against a real, migrated database. Skipped if unreachable. Run via
// `npm run test:unit` (test/run-all.test.ts owns the shared Redis/BullMQ connection close).

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let commissionService: typeof import("../src/services/commission.service.js").commissionService;
let dbAvailable = true;

const createdServiceIds: string[] = [];
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ commissionService } = await import("../src/services/commission.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.commission.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectManagerFee.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.invoice.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
});

async function makeApprovableProject(namePrefix: string, opts: { payoutBudget?: number } = {}) {
  const service = await prisma.service.create({ data: { name: `${namePrefix}-service-${Date.now()}` } });
  createdServiceIds.push(service.id);
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId: service.id } });
  createdClientIds.push(client.id);
  const clientUser = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} user`, passwordHash: "x", role: "CLIENT", clientId: client.id },
  });
  createdUserIds.push(clientUser.id);
  const proposal = await prisma.proposal.create({
    data: { title: `${namePrefix} proposal`, amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
  });
  createdProposalIds.push(proposal.id);
  const project = await prisma.project.create({
    data: {
      name: `${namePrefix} project`,
      clientId: client.id,
      serviceId: service.id,
      status: "REVIEW",
      proposalId: proposal.id,
      commissionSplitMode: "PER_TASK",
      payoutBudget: opts.payoutBudget,
    },
  });
  createdProjectIds.push(project.id);
  await prisma.invoice.create({
    data: {
      number: `${namePrefix}-DEP-${Date.now()}`,
      title: "Deposit",
      amount: 300,
      amountHT: 300,
      currency: "TND",
      status: "PAID",
      invoiceType: "DEPOSIT",
      clientId: client.id,
      projectId: project.id,
      proposalId: proposal.id,
    },
  });
  return { client, clientUser, project, service };
}

async function makeManagerForService(namePrefix: string, serviceId: string) {
  const manager = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} manager`, passwordHash: "x", role: "MANAGER", serviceId },
  });
  createdUserIds.push(manager.id);
  return manager;
}

describe("RG-011: MANAGER_PROJECT_FEE generated on project delivery (real code)", () => {
  test("a ProjectManagerFee fixed in advance produces a MANAGER_PROJECT_FEE commission when the project is client-approved", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, clientUser, project, service } = await makeApprovableProject("rg011-nominal", { payoutBudget: 500 });
    const manager = await makeManagerForService("rg011-nominal-mgr", service.id);
    await commissionService.setManagerFee(project.id, manager.id, 200);

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const commission = await prisma.commission.findFirst({ where: { projectId: project.id, source: "MANAGER_PROJECT_FEE" } });
    assert.ok(commission, "a MANAGER_PROJECT_FEE commission must be created on delivery");
    assert.equal(commission!.partnerId, manager.id);
    assert.equal(Number(commission!.amount), 200);
  });

  test("no ProjectManagerFee set: no MANAGER_PROJECT_FEE commission is created on delivery", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, clientUser, project } = await makeApprovableProject("rg011-none");

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const commission = await prisma.commission.findFirst({ where: { projectId: project.id, source: "MANAGER_PROJECT_FEE" } });
    assert.equal(commission, null, "no fee was fixed, so no commission should be generated");
  });

  test("a project in AUTO mode never generates a MANAGER_PROJECT_FEE commission on delivery, even if a fee row somehow exists", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg011-auto-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg011-auto client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: { email: `rg011-auto-${Date.now()}@example.com`, name: "rg011-auto user", passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(clientUser.id);
    const proposal = await prisma.proposal.create({
      data: { title: "rg011-auto proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({
      data: { name: "rg011-auto project", clientId: client.id, serviceId: service.id, status: "REVIEW", proposalId: proposal.id },
    });
    createdProjectIds.push(project.id);
    await prisma.invoice.create({
      data: { number: `rg011-auto-DEP-${Date.now()}`, title: "Deposit", amount: 300, amountHT: 300, currency: "TND", status: "PAID", invoiceType: "DEPOSIT", clientId: client.id, projectId: project.id, proposalId: proposal.id },
    });
    const manager = await makeManagerForService("rg011-auto-mgr", service.id);
    await prisma.projectManagerFee.create({ data: { projectId: project.id, managerId: manager.id, amount: 150 } });

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const commission = await prisma.commission.findFirst({ where: { projectId: project.id, source: "MANAGER_PROJECT_FEE" } });
    assert.equal(commission, null, "AUTO mode never generates a per-task/per-fee commission");
  });
});

describe("RG-006 (rappel LOT 5): ProjectManagerFee.amount is subject to the payout envelope (real code)", () => {
  test("setManagerFee is rejected with 422 PAYOUT_BUDGET_EXCEEDED at the worst-case coefficient", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg006-mgrfee-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg006-mgrfee client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg006-mgrfee project", clientId: client.id, serviceId: service.id, commissionSplitMode: "PER_TASK", payoutBudget: 100 },
    });
    createdProjectIds.push(project.id);
    const manager = await makeManagerForService("rg006-mgrfee-mgr", service.id);

    await assert.rejects(
      () => commissionService.setManagerFee(project.id, manager.id, 150),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PAYOUT_BUDGET_EXCEEDED");
        return true;
      }
    );
  });

  test("setManagerFee is rejected with 422 PAYOUT_BUDGET_NOT_SET when no budget is fixed", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg006-mgrfee-nobudget-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg006-mgrfee-nobudget client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg006-mgrfee-nobudget project", clientId: client.id, serviceId: service.id, commissionSplitMode: "PER_TASK" },
    });
    createdProjectIds.push(project.id);
    const manager = await makeManagerForService("rg006-mgrfee-nobudget-mgr", service.id);

    await assert.rejects(
      () => commissionService.setManagerFee(project.id, manager.id, 50),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PAYOUT_BUDGET_NOT_SET");
        return true;
      }
    );
  });
});

describe("RG-010: commission mode is locked once a Commission exists (real code)", () => {
  test("setSplits is rejected with 409 COMMISSION_MODE_LOCKED once the project has a commission", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg010-setsplits-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg010-setsplits client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg010-setsplits project", clientId: client.id, serviceId: service.id },
    });
    createdProjectIds.push(project.id);
    const partner = await makeManagerForService("rg010-setsplits-mgr", service.id);
    // Simulate a commission already existing on this project (e.g. from a PROJECT_PERCENT payout).
    await prisma.commission.create({ data: { partnerId: partner.id, projectId: project.id, amount: 42 } });

    await assert.rejects(
      () => commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 50 }]),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "COMMISSION_MODE_LOCKED");
        return true;
      }
    );
  });

  test("resetToAutoSplit is rejected with 409 COMMISSION_MODE_LOCKED once the project has a commission", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg010-reset-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg010-reset client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({
      data: { name: "rg010-reset project", clientId: client.id, serviceId: service.id, commissionSplitMode: "MANUAL" },
    });
    createdProjectIds.push(project.id);
    const partner = await makeManagerForService("rg010-reset-mgr", service.id);
    await prisma.commission.create({ data: { partnerId: partner.id, projectId: project.id, amount: 42 } });

    await assert.rejects(
      () => commissionService.resetToAutoSplit(project.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "COMMISSION_MODE_LOCKED");
        return true;
      }
    );
  });

  test("setSplits still works normally when no commission exists yet", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `rg010-ok-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "rg010-ok client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "rg010-ok project", clientId: client.id, serviceId: service.id } });
    createdProjectIds.push(project.id);
    const partner = await makeManagerForService("rg010-ok-mgr", service.id);

    await assert.doesNotReject(() => commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 50 }]));
  });
});

describe("Multi-role: a Manager who is also a Freelancer accumulates TASK_FIXED and MANAGER_PROJECT_FEE (real code)", () => {
  test("getOwedSummaryForPartner sums both sources for the same partner", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const service = await prisma.service.create({ data: { name: `multirole-service-${Date.now()}` } });
    createdServiceIds.push(service.id);
    const client = await prisma.client.create({ data: { name: "multirole client", serviceId: service.id } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "multirole project", clientId: client.id, serviceId: service.id } });
    createdProjectIds.push(project.id);
    const manager = await prisma.user.create({
      data: { email: `multirole-${Date.now()}@example.com`, name: "multirole manager", passwordHash: "x", role: "MANAGER", serviceId: service.id, canExecuteAsFreelancer: true },
    });
    createdUserIds.push(manager.id);

    await prisma.commission.create({ data: { partnerId: manager.id, projectId: project.id, source: "TASK_FIXED", baseAmount: 100, coefficient: 1.0, amount: 100 } });
    await prisma.commission.create({ data: { partnerId: manager.id, projectId: project.id, source: "MANAGER_PROJECT_FEE", amount: 200 } });

    const summary = await commissionService.getOwedSummaryForPartner(manager.id);
    assert.equal(summary.pending, 300, "TASK_FIXED (100) + MANAGER_PROJECT_FEE (200) must sum to 300 in the same partner's pending total");
  });
});
