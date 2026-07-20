// SEC-151 (ANOMALIES.yaml): generateCreditNoteNumber (creditNote.service.ts) used to be a bare
// `CN-${Date.now()}` with no protection against two credit notes created within the same
// millisecond — colliding on CreditNote.number's @unique constraint and surfacing as an
// unhandled Prisma P2002 instead of a clear error or a regenerated number. The fix replaced it
// with a module-level counter that is never reset or wrapped, combined with the timestamp.
//
// This test imports and calls the real creditNoteService.create — not a reimplementation —
// firing two strictly concurrent calls (Promise.all, no await between them) on two different
// invoices of the same client, the exact race the original bug required. Requires a real,
// migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

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

describe("creditNoteService.create number generation under real concurrency (SEC-151)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("two strictly concurrent credit note creations never collide on CreditNote.number", async () => {
    const client = await prisma.client.create({ data: { name: "sec151 client" } });
    createdClientIds.push(client.id);

    const [invoiceA, invoiceB] = await Promise.all([
      prisma.invoice.create({
        data: { number: `SEC-151-A-${Date.now()}`, title: "Invoice A", amount: 100, amountPaid: 100, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
      }),
      prisma.invoice.create({
        data: { number: `SEC-151-B-${Date.now()}`, title: "Invoice B", amount: 100, amountPaid: 100, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
      }),
    ]);
    createdInvoiceIds.push(invoiceA.id, invoiceB.id);

    // Strictly concurrent — no await between the two calls, the exact scenario a bare
    // Date.now() suffix could not survive.
    const results = await Promise.all([
      creditNoteService.create(invoiceA.id, { amount: 10, reason: "SEC-151 concurrency A" }),
      creditNoteService.create(invoiceB.id, { amount: 10, reason: "SEC-151 concurrency B" }),
    ]);
    createdCreditNoteIds.push(results[0].id, results[1].id);

    assert.notEqual(results[0].number, results[1].number, "two concurrently-created credit notes must never share the same number");

    // Confirm both rows actually landed in the database with distinct numbers — not just that
    // the two in-memory results differed before either was persisted.
    const rows = await prisma.creditNote.findMany({ where: { id: { in: [results[0].id, results[1].id] } }, select: { number: true } });
    const distinctNumbers = new Set(rows.map((r) => r.number));
    assert.equal(distinctNumbers.size, 2, "both credit notes must be persisted with distinct numbers");
  });

  test("a burst of 20 concurrent credit note creations on 20 different invoices produces 20 distinct numbers", async () => {
    const client = await prisma.client.create({ data: { name: "sec151 burst client" } });
    createdClientIds.push(client.id);

    const invoices = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        prisma.invoice.create({
          data: { number: `SEC-151-BURST-${i}-${Date.now()}`, title: `Burst invoice ${i}`, amount: 50, amountPaid: 50, currency: "TND", status: "PAID", clientId: client.id, invoiceType: "STANDARD" },
        })
      )
    );
    createdInvoiceIds.push(...invoices.map((inv) => inv.id));

    const results = await Promise.all(
      invoices.map((inv) => creditNoteService.create(inv.id, { amount: 5, reason: "SEC-151 burst" }))
    );
    createdCreditNoteIds.push(...results.map((r) => r.id));

    const distinctNumbers = new Set(results.map((r) => r.number));
    assert.equal(distinctNumbers.size, 20, `expected 20 distinct credit note numbers, got ${distinctNumbers.size}`);
  });
});
