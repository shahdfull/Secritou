// SEC-172: migration 20260711204823_client_portal_activated_at added Client.portalActivatedAt
// with no backfill — the only write path (invoice.service.ts#addPayment) only fires on a NEW
// payment event, so a client whose DEPOSIT invoice was already PAID before that migration never
// got portalActivatedAt set, and requireActivatedPortal (rbac.middleware.ts) locks such a client
// out of their own portal permanently.
//
// Fixed two ways: (1) a one-time backfill migration
// (20260721000000_backfill_client_portal_activated_at) deriving portalActivatedAt from the
// earliest PAID DEPOSIT invoice's paidAt/updatedAt, applied directly against the dev database
// (npx prisma migrate resolve --applied, since a second, unrelated pending migration from a
// concurrent process must not be touched by this session) — and (2), because the backfill alone
// only fixes rows that existed at the moment it ran (confirmed live: a pre-existing test fixture,
// projectClientApproveBalanceInvoice.test.ts, creates a DEPOSIT/PAID invoice directly via
// prisma.invoice.create, bypassing addPayment entirely, reproducing the exact same gap for any
// FUTURE write path too) — clientRepository.getPortalActivatedAt now falls back to a live check
// for a PAID DEPOSIT invoice whenever the cached column is null, and self-heals the column so the
// gate can never desync from the actual paid-deposit fact again, regardless of how that fact was
// written.
//
// This test calls the real clientRepository.getPortalActivatedAt (not a reimplementation) — the
// actual function requireActivatedPortal depends on — proving the self-heal fires for a client
// whose deposit was paid by direct DB write, and that the normal forward path (a NEW payment via
// the real invoiceService) still activates the portal too.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let clientRepository: typeof import("../src/repositories/client.repository.js").clientRepository;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    ({ clientRepository } = await import("../src/repositories/client.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Client.portalActivatedAt backfill (SEC-172)", () => {
  test("a client whose deposit was paid by direct DB write (bypassing addPayment) still gets activated, and the column self-heals", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({ data: { name: `SEC172 direct-write client ${uniq}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `SEC172 direct-write project ${uniq}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const invoice = await prisma.invoice.create({
      data: {
        number: `SEC172-direct-${uniq}`,
        title: "Deposit",
        amount: 300,
        amountHT: 300,
        clientId: client.id,
        projectId: project.id,
        invoiceType: "DEPOSIT",
        status: "PAID",
      },
    });
    createdInvoiceIds.push(invoice.id);

    assert.equal((await prisma.client.findUnique({ where: { id: client.id } }))!.portalActivatedAt, null, "portalActivatedAt must not have been set by the direct write itself");

    const activatedAt = await clientRepository.getPortalActivatedAt(client.id);
    assert.ok(activatedAt, "getPortalActivatedAt must find the paid deposit via its live fallback and return a timestamp, not null");

    const selfHealed = await prisma.client.findUnique({ where: { id: client.id } });
    assert.ok(selfHealed!.portalActivatedAt, "the cached column must have been self-healed by the fallback");
  });

  test("a NEW deposit payment on a fresh client still activates the portal (forward path unaffected)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({ data: { name: `SEC172 client ${uniq}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `SEC172 project ${uniq}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const invoice = await prisma.invoice.create({
      data: {
        number: `SEC172-${uniq}`,
        title: "Deposit",
        amount: 500,
        clientId: client.id,
        projectId: project.id,
        invoiceType: "DEPOSIT",
        status: "SENT",
      },
    });
    createdInvoiceIds.push(invoice.id);

    assert.equal((await prisma.client.findUnique({ where: { id: client.id } }))!.portalActivatedAt, null);

    await invoiceService.addPayment(invoice.id, { amount: 500, method: "BANK_TRANSFER" });

    const activated = await prisma.client.findUnique({ where: { id: client.id } });
    assert.ok(activated!.portalActivatedAt, "portalActivatedAt must be set after the deposit is paid");
  });
});
