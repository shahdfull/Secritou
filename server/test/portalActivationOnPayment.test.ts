// SEC-002 (ANOMALIES.yaml) / RG-018: the client portal account (email + temp password) used
// to be created immediately at proposal acceptance (proposal.service.ts#acceptWithCascade),
// before any payment — Cadrage §6 requires it to open only once the first-tranche deposit is
// actually paid. This test imports and calls the real acceptWithCascade and addPayment
// against a real, migrated database — not a reimplementation of either function — to prove:
// (1) accepting a proposal creates NO User account for the client, and
// (2) paying the resulting DEPOSIT invoice in full DOES create one, exactly once.
//
// server/test/proposalAcceptCascade.test.ts exercises the same cascade against a local mock
// world, not the real service — it would not have caught this regression, which is why this
// file calls the real functions instead. Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];

async function makeAcceptableProposal(clientEmail: string) {
  const client = await prisma.client.create({
    data: { name: "SEC-002 test client", email: clientEmail, serviceId },
  });
  createdClientIds.push(client.id);

  const proposal = await prisma.proposal.create({
    data: {
      title: "SEC-002 test proposal",
      amount: 1000,
      currency: "TND",
      status: "SENT",
      clientId: client.id,
      clientName: "SEC-002 Test Client",
      email: clientEmail,
    },
  });
  createdProposalIds.push(proposal.id);
  return { client, proposal };
}

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
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
  const clients = await prisma.client.findMany({ where: { id: { in: createdClientIds } }, select: { id: true } });
  const clientIds = clients.map((c) => c.id);
  await prisma.user.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.payment.deleteMany({ where: { invoice: { clientId: { in: clientIds } } } });
  await prisma.invoice.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.project.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });

  // This file is the first in the suite to exercise invoiceService.addPayment for real
  // (invalidateFinanceCaches → cacheService → cache/redis.ts's `redis` package client) —
  // every other file either mocks the repository layer or never triggers cache invalidation.
  // That client is separate from the ioredis/BullMQ connection run-all.test.ts already
  // closes, and left open, it keeps the process alive well past the last test finishing
  // (observed: individual tests pass in ~3.5s, but the process hangs ~40s until node --test's
  // own timeout kills it and misreports the run as failed).
  const { closeRedisClient } = await import("../src/cache/redis.js");
  await closeRedisClient();
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Portal account creation moves from acceptance to deposit payment (SEC-002 / RG-018)", () => {
  test("accepting a proposal creates the deposit invoice but NO client User account", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec002-${Date.now()}-a@example.com`;
    const { client, proposal } = await makeAcceptableProposal(email);

    const result = await proposalService.acceptWithCascade(proposal.id);

    assert.equal(result.clientInvited, false, "acceptWithCascade must never invite the client anymore");
    assert.ok(result.invoiceId, "a deposit invoice must still be created at acceptance");

    const users = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(users.length, 0, "no User account should exist for this client right after acceptance — that's exactly the bug SEC-002 describes");

    const clientRow = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(clientRow?.portalActivatedAt, null, "portalActivatedAt must still be null — no payment has happened yet");
  });

  test("fully paying the deposit invoice creates the client's User account and activates the portal", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec002-${Date.now()}-b@example.com`;
    const { client, proposal } = await makeAcceptableProposal(email);
    const result = await proposalService.acceptWithCascade(proposal.id);
    assert.ok(result.invoiceId);

    const invoiceBefore = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
    assert.equal(invoiceBefore?.invoiceType, "DEPOSIT");
    assert.equal(invoiceBefore?.status, "DRAFT", "createDepositInvoiceTx always creates DRAFT — addPayment only accepts SENT/PARTIAL/OVERDUE");

    await invoiceService.send(result.invoiceId!);
    await invoiceService.addPayment(result.invoiceId!, { amount: Number(invoiceBefore!.amount) });

    const users = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(users.length, 1, "paying the deposit in full must create exactly one User account for the client");
    assert.equal(users[0]!.role, "CLIENT");
    assert.equal(users[0]!.email, email);
    assert.equal(users[0]!.mustChangePassword, true, "the invited client must be forced to change their temporary password");

    const clientRow = await prisma.client.findUnique({ where: { id: client.id } });
    assert.ok(clientRow?.portalActivatedAt, "portalActivatedAt must be set once the deposit is fully paid");
  });

  test("a second, unrelated payment on an already-activated client does not create a duplicate account", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec002-${Date.now()}-c@example.com`;
    const { client, proposal } = await makeAcceptableProposal(email);
    const result = await proposalService.acceptWithCascade(proposal.id);
    const invoice = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
    await invoiceService.send(result.invoiceId!);
    await invoiceService.addPayment(result.invoiceId!, { amount: Number(invoice!.amount) });

    // A second invoice for the same client, also paid — must not attempt a second invite.
    const secondInvoice = await prisma.invoice.create({
      data: { number: `SEC-002-TEST-${Date.now()}`, title: "Second invoice", amount: 200, currency: "TND", status: "SENT", clientId: client.id, invoiceType: "STANDARD" },
    });
    await invoiceService.addPayment(secondInvoice.id, { amount: 200 });

    const users = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(users.length, 1, "a second payment must not create a second account — inviteClientUser's own 409 guard, or justActivatedPortal being false, must prevent it");
  });
});
