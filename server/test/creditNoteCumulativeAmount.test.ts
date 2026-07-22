// SEC-184: creditNoteService.create only ever compared the new credit note's amount against
// invoice.amountPaid — never against the sum of credit notes already issued on that same
// invoice. CreditNote has no status/cancellation field (every row counts, confirmed by reading
// the full model in schema.prisma), so two credit notes could cumulatively exceed what the
// client actually paid: a 1000 TND fully-paid invoice could take an 800 TND credit note (passes,
// 800<=1000) followed by a 700 TND one (also passes under the old check, since it only compared
// 700 against 1000 in isolation) — 1500 TND credited on an invoice that only brought in 1000,
// inflating client.creditBalance beyond money actually received. Fixed by summing existing
// CreditNote rows on the invoice inside the same transaction and comparing against
// amountPaid - alreadyCredited.
//
// This test imports and calls the real creditNoteService.create — not a reimplementation —
// against a real, migrated database, reproducing the exact scenario from the resolution
// criterion. Skipped if the database is unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let creditNoteService: typeof import("../src/services/creditNote.service.js").creditNoteService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdCreditNoteIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ creditNoteService } = await import("../src/services/creditNote.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.creditNote.deleteMany({ where: { id: { in: createdCreditNoteIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("creditNoteService.create enforces a cumulative cap across multiple credit notes on the same invoice (SEC-184)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a second credit note that would push the total past amountPaid is refused with 409 CREDIT_EXCEEDS_PAID", async () => {
    const client = await prisma.client.create({ data: { name: `sec184-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-184-${Date.now()}`, title: "Invoice", amount: 1000, amountPaid: 1000, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    const first = await creditNoteService.create(invoice.id, { amount: 800, reason: "Partial refund" });
    createdCreditNoteIds.push(first.id);

    await assert.rejects(
      () => creditNoteService.create(invoice.id, { amount: 700, reason: "Second refund attempt" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "CREDIT_EXCEEDS_PAID");
        return true;
      }
    );

    const clientAfter = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(Number(clientAfter!.creditBalance), 800, "creditBalance must reflect only the first, accepted credit note");
  });

  test("a second credit note that stays within the remaining creditable amount still succeeds", async () => {
    const client = await prisma.client.create({ data: { name: `sec184-ok-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-184-OK-${Date.now()}`, title: "Invoice", amount: 1000, amountPaid: 1000, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    const first = await creditNoteService.create(invoice.id, { amount: 400, reason: "First refund" });
    createdCreditNoteIds.push(first.id);
    const second = await creditNoteService.create(invoice.id, { amount: 600, reason: "Second refund, exactly the remainder" });
    createdCreditNoteIds.push(second.id);

    const clientAfter = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(Number(clientAfter!.creditBalance), 1000);
  });
});

// The only prior coverage of creditNoteService.create's amount<=0/amount>amountPaid guard
// (creditNote.service.ts:49, INVALID_CREDIT_AMOUNT) was a "mirror" — invoice.service.test.ts
// defines its own local assertCreditAmount() and tests that instead of the real service, which
// CLAUDE.md's verifie:test rule treats as no proof at all (it would stay green even if the real
// guard regressed). This calls the real creditNoteService.create against a real database.
describe("creditNoteService.create rejects a non-positive amount before any DB write (real code, not the invoice.service.test.ts mirror)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a zero amount is rejected with 400 INVALID_CREDIT_AMOUNT, no CreditNote row created", async () => {
    const client = await prisma.client.create({ data: { name: `sec184-zero-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-184-ZERO-${Date.now()}`, title: "Invoice", amount: 1000, amountPaid: 1000, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    await assert.rejects(
      () => creditNoteService.create(invoice.id, { amount: 0, reason: "Zero amount" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_CREDIT_AMOUNT");
        return true;
      }
    );

    const count = await prisma.creditNote.count({ where: { invoiceId: invoice.id } });
    assert.equal(count, 0, "no CreditNote row must exist after a rejected creation");
  });

  test("a negative amount is rejected with 400 INVALID_CREDIT_AMOUNT", async () => {
    const client = await prisma.client.create({ data: { name: `sec184-neg-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-184-NEG-${Date.now()}`, title: "Invoice", amount: 1000, amountPaid: 1000, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    await assert.rejects(
      () => creditNoteService.create(invoice.id, { amount: -50, reason: "Negative amount" }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_CREDIT_AMOUNT");
        return true;
      }
    );
  });
});
