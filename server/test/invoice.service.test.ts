// SEC-076: this file used to reimplement invoice.service.ts's addPayment/assertInvoiceDraft
// logic locally (FakeTx, computeNewStatus, assertInvoiceDraft, computeOverpayment,
// buildInvoiceNumber, isDuplicatePayment) instead of importing the real modules — it stayed
// green regardless of what the real code did. The clearest symptom: FakeTx.invoice.findUnique
// filtered on `companyId`, a field that exists nowhere in schema.prisma or the real code (this
// repo is single-tenant — see the ban at the top of CLAUDE.md).
//
// Rewritten to import and call the real invoiceService against a real, migrated database.
// Also fills two coverage gaps found by comparing the mirror against the real code:
// - the real addPayment status guard (HttpError 409 INVOICE_NOT_ACCEPTING_PAYMENTS) when the
//   invoice isn't SENT/PARTIAL/OVERDUE — the mirror had no such check at all.
// - the real idempotencyKey path (invoice.service.ts:219-223), which addPayment prefers over
//   the 10s fallback window — the mirror only ever exercised the fallback.
//
// The overpayment -> credit note guard (assertCreditAmount / INVALID_CREDIT_AMOUNT /
// CREDIT_EXCEEDS_PAID) is intentionally NOT duplicated here: creditNoteCumulativeAmount.test.ts
// (SEC-184) already calls the real creditNoteService.create against a real database for exactly
// that guard, including the cumulative-cap case the old mirror never covered at all. Re-adding a
// second real-code copy here would just be the same proof twice.
//
// Requires a real, migrated database; skipped otherwise.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.payment.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeInvoice(overrides: { amount?: number; amountPaid?: number; status?: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const client = await prisma.client.create({ data: { name: `sec076-client-${suffix}` } });
  createdClientIds.push(client.id);
  const invoice = await prisma.invoice.create({
    data: {
      number: `SEC-076-${suffix}`,
      title: "Invoice",
      amount: overrides.amount ?? 1000,
      amountPaid: overrides.amountPaid ?? 0,
      currency: "TND",
      status: overrides.status ?? "SENT",
      invoiceType: "STANDARD",
      clientId: client.id,
    },
  });
  createdInvoiceIds.push(invoice.id);
  return invoice;
}

describe("invoiceService.addPayment: status transitions (real code)", () => {
  test("sets status to PAID when payment covers full amount", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 0 });
    const { payment } = await invoiceService.addPayment(invoice.id, { amount: 1000 });
    assert.equal(Number(payment.amount), 1000);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(after.status, "PAID");
    assert.ok(after.paidAt, "paidAt must be set once the invoice is fully paid");
  });

  test("sets status to PARTIAL when payment is less than total", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 0 });
    await invoiceService.addPayment(invoice.id, { amount: 500 });
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(after.status, "PARTIAL");
    assert.equal(after.paidAt, null);
  });

  test("sets status to PAID when multiple payments cumulate to full amount", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 600, status: "PARTIAL" });
    await invoiceService.addPayment(invoice.id, { amount: 400 });
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(after.status, "PAID");
  });

  test("throws 404 when the invoice does not exist", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    await assert.rejects(
      () => invoiceService.addPayment(crypto.randomUUID(), { amount: 100 }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });
});

// SEC-076 gap: the mirror had no equivalent of this guard at all.
describe("invoiceService.addPayment: status guard (SEC-076 gap, real code)", () => {
  for (const status of ["DRAFT", "PAID", "CANCELLED"] as const) {
    test(`rejects a payment on a ${status} invoice with 409 INVOICE_NOT_ACCEPTING_PAYMENTS`, async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const invoice = await makeInvoice({ amount: 1000, amountPaid: status === "PAID" ? 1000 : 0, status });
      await assert.rejects(
        () => invoiceService.addPayment(invoice.id, { amount: 100 }),
        (err: unknown) => err instanceof HttpError && err.statusCode === 409 && err.code === "INVOICE_NOT_ACCEPTING_PAYMENTS"
      );
    });
  }

  for (const status of ["SENT", "PARTIAL", "OVERDUE"] as const) {
    test(`accepts a payment on a ${status} invoice`, async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const invoice = await makeInvoice({ amount: 1000, amountPaid: 200, status });
      await assert.doesNotReject(() => invoiceService.addPayment(invoice.id, { amount: 100 }));
    });
  }
});

// SEC-076 gap: the mirror only ever exercised the 10s fallback window (isDuplicatePayment),
// never the idempotencyKey path that addPayment actually prefers.
describe("invoiceService.addPayment: idempotencyKey path (SEC-076 gap, real code)", () => {
  test("a second call with the same idempotencyKey returns the original payment without a second write", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 0 });
    const key = `sec076-${crypto.randomUUID()}`;

    const first = await invoiceService.addPayment(invoice.id, { amount: 400, idempotencyKey: key });
    const second = await invoiceService.addPayment(invoice.id, { amount: 400, idempotencyKey: key });

    assert.equal(second.payment.id, first.payment.id, "the same idempotencyKey must return the original payment, not create a new one");
    assert.equal(second.deduplicated, true);

    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    assert.equal(paymentCount, 1, "only one Payment row must exist for a repeated idempotencyKey");

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(after.status, "PARTIAL", "the invoice must only reflect the first, deduplicated payment");
  });

  test("a different idempotencyKey on the same invoice creates a second, independent payment", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 0 });

    await invoiceService.addPayment(invoice.id, { amount: 400, idempotencyKey: `sec076-a-${crypto.randomUUID()}` });
    await invoiceService.addPayment(invoice.id, { amount: 400, idempotencyKey: `sec076-b-${crypto.randomUUID()}` });

    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    assert.equal(paymentCount, 2);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(Number(after.amountPaid), 800);
  });
});

describe("invoiceService.addPayment: 10-second duplicate fallback (real code, no idempotencyKey)", () => {
  test("an identical payment (same amount, no recorder) within 10s is deduplicated", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 1000, amountPaid: 0 });

    const first = await invoiceService.addPayment(invoice.id, { amount: 500 });
    const second = await invoiceService.addPayment(invoice.id, { amount: 500 });

    assert.equal(second.deduplicated, true);
    assert.equal(second.payment.id, first.payment.id);
    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    assert.equal(paymentCount, 1);
  });
});

// SEC-076 gap check: assertInvoiceDraft is not directly exported (it's private to
// invoice.service.ts), so it's exercised the same way production code does — through addItem,
// which is the real call site the old mirror's standalone assertInvoiceDraft() copy never proved
// anything about.
describe("invoiceService.addItem: draft guard (real code, replaces the standalone assertInvoiceDraft mirror)", () => {
  test("allows adding an item on a DRAFT invoice", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makeInvoice({ amount: 0, amountPaid: 0, status: "DRAFT" });
    const item = await invoiceService.addItem(invoice.id, { description: "Design work", quantity: 2, unitPrice: 150 });
    assert.equal(Number(item.total), 300);
  });

  for (const status of ["SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const) {
    test(`blocks adding an item on a ${status} invoice with 409 INVOICE_NOT_DRAFT`, async (t) => {
      if (!dbAvailable) { t.skip("no reachable database"); return; }
      const invoice = await makeInvoice({ amount: 1000, amountPaid: status === "PAID" ? 1000 : 0, status });
      await assert.rejects(
        () => invoiceService.addItem(invoice.id, { description: "Extra", quantity: 1, unitPrice: 50 }),
        (err: unknown) => err instanceof HttpError && err.statusCode === 409 && err.code === "INVOICE_NOT_DRAFT"
      );
    });
  }
});

describe("invoiceService.create: real invoice number generation (real code, replaces the buildInvoiceNumber mirror)", () => {
  test("generates a number matching INV-YYYYMM-NNNN and increments across successive invoices", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const client = await prisma.client.create({ data: { name: `sec076-numgen-client-${suffix}` } });
    createdClientIds.push(client.id);

    const first = await invoiceService.create({ title: "Invoice 1", amount: 100, clientId: client.id });
    createdInvoiceIds.push(first.id);
    const second = await invoiceService.create({ title: "Invoice 2", amount: 200, clientId: client.id });
    createdInvoiceIds.push(second.id);

    assert.match(first.number, /^INV-\d{6}-\d{4}$/);
    assert.match(second.number, /^INV-\d{6}-\d{4}$/);
    assert.notEqual(first.number, second.number, "each invoice must get a distinct, incrementing number");
  });
});

// Request-shape validation guards below any DB call — kept from the original file, this part
// already called the real shared validator, not a mirror.
describe("addPaymentSchema: request guard (real code)", () => {
  test("rejects negative payment amount before any DB call", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { addPaymentSchema } = await import("../src/validators/invoice.validator.js");
    const result = addPaymentSchema.safeParse({ params: { id: crypto.randomUUID() }, body: { amount: -100 } });
    assert.equal(result.success, false, "addPaymentSchema must reject a negative amount");
  });

  test("rejects zero payment amount before any DB call", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { addPaymentSchema } = await import("../src/validators/invoice.validator.js");
    const result = addPaymentSchema.safeParse({ params: { id: crypto.randomUUID() }, body: { amount: 0 } });
    assert.equal(result.success, false, "addPaymentSchema must reject a zero amount");
  });
});
