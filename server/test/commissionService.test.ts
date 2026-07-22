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

let prisma: typeof import("../src/config/prisma.js").prisma;
let commissionService: typeof import("../src/services/commission.service.js").commissionService;
let dbAvailable = true;

let serviceId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commissionService } = await import("../src/services/commission.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.commission.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectCommissionSplit.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
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

describe("commissionService.setSplits (real code, not a reimplementation)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("accepts splits summing to exactly 100%, persisted for real", async () => {
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

  test("accepts splits summing to less than 100% (not every project needs to allocate the full share)", async () => {
    const project = await makeProject("split-partial");
    const partner = await makePartner("split-partial-a");

    await assert.doesNotReject(() => commissionService.setSplits(project.id, [{ partnerId: partner.id, ratePct: 50 }]));
  });

  test("rejects splits summing to more than 100% with 422 COMMISSION_RATES_EXCEED_100", async () => {
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

  test("rejects a non-positive rate with 422 INVALID_COMMISSION_RATE", async () => {
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

  test("rejects a duplicate partner in the same call with 422 DUPLICATE_COMMISSION_PARTNER", async () => {
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

  test("rejects splits for a non-existent project with 404", async () => {
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

describe("commissionService.markPaid (real code, not a reimplementation)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  async function makePendingCommission(namePrefix: string) {
    const project = await makeProject(namePrefix);
    const partner = await makePartner(`${namePrefix}-partner`);
    const invoice = await prisma.invoice.create({
      data: { number: `${namePrefix}-INV-${Date.now()}`, title: "Test", amount: 1000, currency: "TND", projectId: project.id, clientId: project.clientId },
    });
    const payment = await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 400 } });
    const commission = await prisma.commission.create({
      data: { partnerId: partner.id, projectId: project.id, invoiceId: invoice.id, paymentId: payment.id, basis: 400, ratePct: 50, amount: 200 },
    });
    return commission;
  }

  test("marks a PENDING commission as PAID, stamping paidAt", async () => {
    const commission = await makePendingCommission("markpaid-ok");

    const updated = await commissionService.markPaid(commission.id);

    assert.equal(updated.status, "PAID");
    assert.ok(updated.paidAt, "paidAt must be stamped");

    const persisted = await prisma.commission.findUnique({ where: { id: commission.id } });
    assert.equal(persisted!.status, "PAID", "the status change must actually be persisted, not just returned");
  });

  test("rejects marking an already-PAID commission again with 409 COMMISSION_ALREADY_PAID", async () => {
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

  test("rejects marking a non-existent commission with 404", async () => {
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
