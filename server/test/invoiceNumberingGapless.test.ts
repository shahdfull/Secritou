// RG-012 (REFERENTIEL.md §5) : "Les factures sont numérotées séquentiellement par mois, sans
// trou (INV-YYYYMM-NNNN), le compteur étant incrémenté dans la même transaction que la création
// de la facture." Only verified by schema_seul so far (InvoiceCounter's existence in
// schema.prisma) — invoice.service.ts's numbering logic itself had only been grep'd around
// addPayment, never read for the numbering path, and the "sans trou" (gapless) claim is a
// negative/exclusivity assertion that CLAUDE.md requires verifie: test for, not schema_seul.
//
// Direct reading of invoice.service.ts (nextInvoiceNumber, createInvoiceWithGeneratedNumber)
// confirmed the sequence is atomic (Prisma upsert with increment, inside the same $transaction
// as the Invoice row creation — a failure anywhere in that transaction rolls back the counter
// too, so no gap is possible from a failed creation) BUT found a real gap in the guarantee:
// invoiceService.create accepted an optional `number` from the caller (createInvoiceSchema),
// which bypassed InvoiceCounter entirely — an ADMIN could create an invoice with an arbitrary
// number, breaking the auto-generated sequence's continuity or colliding with a future
// auto-generated number. Fixed (SEC-031): `number` removed from createInvoiceSchema and from
// invoiceService.create's parameter type — every invoice created through this path now always
// goes through nextInvoiceNumber, no exceptions.
//
// This test imports and calls the real invoiceService.create against a real database — not a
// reimplementation — and confirms: (1) consecutive invoices get strictly consecutive numbers
// under the current month's prefix, no gap ; (2) a `number` field passed in the input object is
// silently ignored (TypeScript no longer even allows it, and at the validator layer Zod strips
// it), the real generated number is used instead.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let createInvoiceSchema: typeof import("../src/validators/invoice.validator.js").createInvoiceSchema;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    ({ createInvoiceSchema } = await import("../src/validators/invoice.validator.js"));
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
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("invoiceService.create — sequential gapless numbering (RG-012)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("consecutive invoices under the same month prefix get strictly consecutive numbers", async () => {
    const client = await prisma.client.create({ data: { name: "RG-012 client", serviceId } });
    createdClientIds.push(client.id);

    const inv1 = await invoiceService.create({ title: "Invoice 1", amount: 100, clientId: client.id });
    createdInvoiceIds.push(inv1.id);
    const inv2 = await invoiceService.create({ title: "Invoice 2", amount: 100, clientId: client.id });
    createdInvoiceIds.push(inv2.id);

    const prefix = inv1.number.slice(0, inv1.number.lastIndexOf("-"));
    const seq1 = Number(inv1.number.slice(inv1.number.lastIndexOf("-") + 1));
    const seq2 = Number(inv2.number.slice(inv2.number.lastIndexOf("-") + 1));

    assert.equal(inv2.number.slice(0, inv2.number.lastIndexOf("-")), prefix, "both invoices must share the same month prefix");
    assert.equal(seq2, seq1 + 1, "the second invoice's sequence must be exactly one more than the first — no gap");
  });

  test("a caller-supplied `number` is never used — createInvoiceSchema no longer accepts it, invoiceService.create always generates its own", async () => {
    const client = await prisma.client.create({ data: { name: "RG-012 no-bypass client", serviceId } });
    createdClientIds.push(client.id);

    // Confirms SEC-031's fix at the validator layer: an attacker-supplied `number` in the raw
    // body is stripped by Zod before it ever reaches the controller/service.
    const parsed = createInvoiceSchema.parse({
      body: { number: "INV-FAKE-0001", title: "Attempted bypass", amount: 100, clientId: client.id },
      params: {},
      query: {},
    });
    assert.ok(!("number" in parsed.body), "number must be stripped by the validator, never passed through");

    const invoice = await invoiceService.create({ title: "Attempted bypass", amount: 100, clientId: client.id });
    createdInvoiceIds.push(invoice.id);
    assert.notEqual(invoice.number, "INV-FAKE-0001", "the real generated number must be used, never a caller-supplied one");
    assert.match(invoice.number, /^INV-\d{6}-\d{4}$/, "the number must follow the INV-YYYYMM-NNNN format from nextInvoiceNumber");
  });
});
