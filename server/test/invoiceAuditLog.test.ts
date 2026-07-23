// SEC-152 (ANOMALIES.yaml): invoice.service.ts and creditNote.service.ts never called
// auditLogService.record(...), unlike project/task/user.service.ts which already do — no
// append-only trail existed for invoice status transitions or credit note issuance/application.
// The fix added `void auditLogService.record(...)` calls to send/cancel/delete/restore/addPayment
// (invoice.service.ts) and create/applyCredit (creditNote.service.ts).
//
// This test imports and calls the real services — not a reimplementation — and rereads the real
// AuditLog table to confirm the entry was actually written, per CLAUDE.md's "verifie: test"
// requirement (a test that doesn't call the real code, or doesn't inspect the real side effect,
// proves nothing). Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let creditNoteService: typeof import("../src/services/creditNote.service.js").creditNoteService;
let dbAvailable = true;
let actorId: string;

const createdClientIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdCreditNoteIds: string[] = [];
const createdAuditLogIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    ({ creditNoteService } = await import("../src/services/creditNote.service.js"));
    await prisma.$queryRaw`SELECT 1`;

    // Payment.recordedById is a real FK to User.id — a made-up string would violate it the
    // moment addPayment tries to record a payment (unlike AuditLog.actorId, which is a free
    // string with no FK, so it wouldn't have caught this).
    const passwordHash = await bcrypt.hash("Sec152TestPass!", 10);
    const actor = await prisma.user.create({
      data: { email: `sec152-actor-${Date.now()}@example.com`, name: "SEC-152 Test Actor", passwordHash, role: "ADMIN" },
    });
    actorId = actor.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditLogIds } } });
  await prisma.creditNote.deleteMany({ where: { id: { in: createdCreditNoteIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  if (actorId) await prisma.user.delete({ where: { id: actorId } }).catch(() => {});
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function findAuditLogFor(entityType: string, entityId: string, action: string) {
  // A short poll: void auditLogService.record(...) is fire-and-forget (never awaited by the
  // caller, by design — a logging failure must not fail the business operation), so the row
  // may land a tick after the service call returns.
  for (let i = 0; i < 20; i++) {
    const row = await prisma.auditLog.findFirst({ where: { entityType, entityId, action }, orderBy: { createdAt: "desc" } });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Invoice and CreditNote mutations write to AuditLog (SEC-152)", () => {
  test("invoiceService.send writes an invoice.send AuditLog entry with actorId and before/after status", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec152 client A" } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-152-SEND-${Date.now()}`, title: "Invoice", amount: 100, currency: "TND", status: "DRAFT", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    await invoiceService.send(invoice.id, undefined, actorId, "ADMIN");

    const entry = await findAuditLogFor("Invoice", invoice.id, "invoice.send");
    assert.ok(entry, "invoiceService.send must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.equal(entry!.actorRole, "ADMIN");
    assert.deepEqual(entry!.before, { status: "DRAFT" });
    assert.deepEqual(entry!.after, { status: "SENT" });
  });

  test("invoiceService.cancel writes an invoice.cancel AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec152 client B" } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-152-CANCEL-${Date.now()}`, title: "Invoice", amount: 100, currency: "TND", status: "SENT", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    await invoiceService.cancel(invoice.id, actorId, "ADMIN");

    const entry = await findAuditLogFor("Invoice", invoice.id, "invoice.cancel");
    assert.ok(entry, "invoiceService.cancel must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.deepEqual(entry!.after, { status: "CANCELLED" });
  });

  test("invoiceService.addPayment writes an invoice.payment.add AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec152 client C" } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-152-PAY-${Date.now()}`, title: "Invoice", amount: 100, currency: "TND", status: "SENT", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    const result = await invoiceService.addPayment(invoice.id, { amount: 100 }, actorId);

    const entry = await findAuditLogFor("Invoice", invoice.id, "invoice.payment.add");
    assert.ok(entry, "invoiceService.addPayment must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.equal((entry!.after as { paymentId?: string })?.paymentId, result.payment.id);
  });

  test("creditNoteService.create writes a creditNote.create AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec152 client D" } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-152-CN-${Date.now()}`, title: "Invoice", amount: 100, amountPaid: 100, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    const creditNote = await creditNoteService.create(invoice.id, { amount: 20, reason: "SEC-152 test" }, actorId, "ADMIN");
    createdCreditNoteIds.push(creditNote.id);

    const entry = await findAuditLogFor("CreditNote", creditNote.id, "creditNote.create");
    assert.ok(entry, "creditNoteService.create must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.equal((entry!.after as { number?: string })?.number, creditNote.number);
  });

  test("creditNoteService.applyCredit writes a creditNote.apply AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec152 client E" } });
    createdClientIds.push(client.id);
    const sourceInvoice = await prisma.invoice.create({
      data: { number: `SEC-152-APPLY-SRC-${Date.now()}`, title: "Source invoice", amount: 100, amountPaid: 100, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    const targetInvoice = await prisma.invoice.create({
      data: { number: `SEC-152-APPLY-TGT-${Date.now()}`, title: "Target invoice", amount: 50, amountPaid: 0, currency: "TND", status: "SENT", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(sourceInvoice.id, targetInvoice.id);

    const creditNote = await creditNoteService.create(sourceInvoice.id, { amount: 20, reason: "SEC-152 apply test" });
    createdCreditNoteIds.push(creditNote.id);

    await creditNoteService.applyCredit(creditNote.id, targetInvoice.id, actorId, "ADMIN");

    const entry = await findAuditLogFor("CreditNote", creditNote.id, "creditNote.apply");
    assert.ok(entry, "creditNoteService.applyCredit must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.equal((entry!.after as { appliedToInvoiceId?: string })?.appliedToInvoiceId, targetInvoice.id);
  });

  // SEC-199: invoiceService.create previously wrote no AuditLog entry at all — the creation of
  // an invoice, a real financial mutation, was untraceable.
  test("invoiceService.create writes an invoice.create AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec199 client A" } });
    createdClientIds.push(client.id);

    const invoice = await invoiceService.create(
      { title: "SEC-199 invoice", amount: 250, currency: "TND", clientId: client.id },
      actorId,
      "ADMIN"
    );
    createdInvoiceIds.push(invoice.id);

    const entry = await findAuditLogFor("Invoice", invoice.id, "invoice.create");
    assert.ok(entry, "invoiceService.create must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.equal(entry!.actorRole, "ADMIN");
  });

  // SEC-199: the CreditNote automatically created by addPayment on an overpayment (via
  // createCreditNoteTx, shared with creditNoteService.create's manual path) previously had no
  // AuditLog entry of its own — only invoice.payment.add mentioned overpaidBy in passing, with
  // no entry whose entityId is the CreditNote itself.
  test("an automatic overpayment CreditNote (created by addPayment) gets its own creditNote.create AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec199 client B" } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-199-OVERPAY-${Date.now()}`, title: "Invoice", amount: 100, currency: "TND", status: "SENT", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    // Overpays by 50 — must trigger the automatic CreditNote path in addPayment.
    const result = await invoiceService.addPayment(invoice.id, { amount: 150 }, actorId);
    assert.ok(result.creditNote, "an overpayment must create a CreditNote");
    createdCreditNoteIds.push(result.creditNote!.id);

    const paymentEntry = await findAuditLogFor("Invoice", invoice.id, "invoice.payment.add");
    assert.ok(paymentEntry);
    createdAuditLogIds.push(paymentEntry!.id);
    assert.equal((paymentEntry!.after as { creditNoteId?: string })?.creditNoteId, result.creditNote!.id, "invoice.payment.add's own entry must also reference the CreditNote it created");

    const creditNoteEntry = await findAuditLogFor("CreditNote", result.creditNote!.id, "creditNote.create");
    assert.ok(creditNoteEntry, "the automatically-created CreditNote must have its own AuditLog entry, not just a mention on the payment's entry");
    createdAuditLogIds.push(creditNoteEntry!.id);
    assert.equal(creditNoteEntry!.actorId, actorId);
    assert.equal((creditNoteEntry!.after as { number?: string })?.number, result.creditNote!.number);
  });
});
