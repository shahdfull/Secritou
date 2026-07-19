// Tests for invoice.service business logic : no DB, no imports of service
// Pattern: same as rating.service.test.ts : pure logic stubs, node:test + assert

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Replicated types ────────────────────────────────────────────────────────

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

// ─── Logic extracted from invoice.service.addPayment ─────────────────────────
// Source: src/services/invoice.service.ts lines 118-124

function computeNewStatus(
  invoiceAmount: number,
  previousAmountPaid: number,
  paymentAmount: number,
  currentStatus: InvoiceStatus
): InvoiceStatus {
  const newAmountPaid = previousAmountPaid + paymentAmount;
  if (newAmountPaid >= invoiceAmount) return "PAID";
  if (newAmountPaid > 0) return "PARTIAL";
  return currentStatus;
}

// ─── Stub: $transaction that executes the callback against a fake tx ─────────

type FakeTx = {
  invoice: {
    findUnique: (args: { where: object; select: object }) => Promise<unknown>;
    update: (args: { where: object; data: object }) => Promise<unknown>;
  };
  invoicePayment: {
    create: (args: { data: object }) => Promise<unknown>;
  };
};

async function runAddPayment(
  tx: FakeTx,
  invoiceId: string,
  companyId: string,
  data: { amount: number; method?: string; reference?: string; paidAt?: Date }
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId, companyId },
    select: { id: true, amount: true, amountPaid: true, status: true },
  }) as { id: string; amount: number; amountPaid: number; status: InvoiceStatus } | null;

  if (!invoice) throw new Error("Invoice not found");

  const payment = await tx.invoicePayment.create({
    data: {
      invoiceId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      paidAt: data.paidAt ?? new Date(),
    },
  });

  const newAmountPaid = Number(invoice.amountPaid) + data.amount;
  const newStatus = computeNewStatus(
    Number(invoice.amount),
    Number(invoice.amountPaid),
    data.amount,
    invoice.status
  );

  await tx.invoice.update({
    where: { id: invoiceId, companyId },
    data: {
      amountPaid: newAmountPaid,
      status: newStatus,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
    },
  });

  return payment;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addPayment : status logic", () => {
  const INVOICE_ID = "inv-1";
  const COMPANY_ID = "company-1";

  test("sets status to PAID when payment covers full amount", async () => {
    const calls: object[] = [];

    const tx: FakeTx = {
      invoice: {
        findUnique: async () => ({
          id: INVOICE_ID,
          amount: 1000,
          amountPaid: 0,
          status: "SENT" as InvoiceStatus,
        }),
        update: async (args) => { calls.push(args); return {}; },
      },
      invoicePayment: {
        create: async () => ({ id: "pay-1", amount: 1000 }),
      },
    };

    await runAddPayment(tx, INVOICE_ID, COMPANY_ID, { amount: 1000 });

    const updateCall = calls[0] as { data: { status: InvoiceStatus } };
    assert.equal(updateCall.data.status, "PAID");
  });

  test("sets status to PARTIAL when payment is less than total", async () => {
    const calls: object[] = [];

    const tx: FakeTx = {
      invoice: {
        findUnique: async () => ({
          id: INVOICE_ID,
          amount: 1000,
          amountPaid: 0,
          status: "SENT" as InvoiceStatus,
        }),
        update: async (args) => { calls.push(args); return {}; },
      },
      invoicePayment: {
        create: async () => ({ id: "pay-1", amount: 500 }),
      },
    };

    await runAddPayment(tx, INVOICE_ID, COMPANY_ID, { amount: 500 });

    const updateCall = calls[0] as { data: { status: InvoiceStatus } };
    assert.equal(updateCall.data.status, "PARTIAL");
  });

  test("sets status to PAID when multiple payments cumulate to full amount", async () => {
    const calls: object[] = [];

    const tx: FakeTx = {
      invoice: {
        findUnique: async () => ({
          id: INVOICE_ID,
          amount: 1000,
          amountPaid: 600,
          status: "PARTIAL" as InvoiceStatus,
        }),
        update: async (args) => { calls.push(args); return {}; },
      },
      invoicePayment: {
        create: async () => ({ id: "pay-2", amount: 400 }),
      },
    };

    await runAddPayment(tx, INVOICE_ID, COMPANY_ID, { amount: 400 });

    const updateCall = calls[0] as { data: { status: InvoiceStatus } };
    assert.equal(updateCall.data.status, "PAID");
  });

  test("throws when invoice is not found", async () => {
    const tx: FakeTx = {
      invoice: {
        findUnique: async () => null,
        update: async () => { throw new Error("Should not be called"); },
      },
      invoicePayment: {
        create: async () => { throw new Error("Should not be called"); },
      },
    };

    await assert.rejects(
      () => runAddPayment(tx, "nonexistent", COMPANY_ID, { amount: 100 }),
      (err: Error) => {
        assert.equal(err.message, "Invoice not found");
        return true;
      }
    );
  });

  test("rolls back: invoice.update is not called when invoicePayment.create throws", async () => {
    let updateCalled = false;

    const tx: FakeTx = {
      invoice: {
        findUnique: async () => ({
          id: INVOICE_ID,
          amount: 1000,
          amountPaid: 0,
          status: "SENT" as InvoiceStatus,
        }),
        update: async () => { updateCalled = true; return {}; },
      },
      invoicePayment: {
        create: async () => { throw new Error("DB error"); },
      },
    };

    await assert.rejects(
      () => runAddPayment(tx, INVOICE_ID, COMPANY_ID, { amount: 500 }),
      /DB error/
    );

    assert.equal(updateCalled, false, "invoice.update must not be called when payment creation fails");
  });
});

// ─── Additional payment guard tests ──────────────────────────────────────────

describe("addPayment : guard logic", () => {
  test("rejects negative payment amount before any DB call", async () => {
    const { addPaymentSchema } = await import("../src/validators/invoice.validator.js");
    const result = addPaymentSchema.safeParse({ params: { id: crypto.randomUUID() }, body: { amount: -100 } });
    assert.equal(result.success, false, "addPaymentSchema must reject a negative amount");
  });

  test("rejects zero payment amount before any DB call", async () => {
    const { addPaymentSchema } = await import("../src/validators/invoice.validator.js");
    const result = addPaymentSchema.safeParse({ params: { id: crypto.randomUUID() }, body: { amount: 0 } });
    assert.equal(result.success, false, "addPaymentSchema must reject a zero amount");
  });

  test("overpayment on PAID invoice stays PAID via computeNewStatus", () => {
    // When amountPaid (1000) + new payment (100) >= amount (1000), status = PAID
    const result = computeNewStatus(1000, 1000, 100, "PAID");
    assert.equal(result, "PAID", "Additional payment on a PAID invoice must keep status PAID");
  });
});

// ─── Unit tests for computeNewStatus ────────────────────────────────────────

describe("computeNewStatus : pure logic", () => {
  test("returns PAID when newAmountPaid equals invoiceAmount", () => {
    assert.equal(computeNewStatus(1000, 0, 1000, "SENT"), "PAID");
  });

  test("returns PAID when newAmountPaid exceeds invoiceAmount", () => {
    assert.equal(computeNewStatus(1000, 0, 1200, "SENT"), "PAID");
  });

  test("returns PARTIAL when newAmountPaid is between 0 and total", () => {
    assert.equal(computeNewStatus(1000, 0, 500, "SENT"), "PARTIAL");
  });

  test("preserves current status when payment amount is 0 and nothing paid yet", () => {
    assert.equal(computeNewStatus(1000, 0, 0, "SENT"), "SENT");
  });

  test("returns PARTIAL on second partial payment still under total", () => {
    assert.equal(computeNewStatus(1000, 300, 200, "PARTIAL"), "PARTIAL");
  });
});

// ─── Line-item edit guard (P0 #2) : mirrors assertInvoiceDraft ───────────────

function assertInvoiceDraft(status: InvoiceStatus) {
  if (status !== "DRAFT") {
    throw Object.assign(new Error("Cannot modify items on a non-draft invoice"), {
      code: "INVOICE_NOT_DRAFT",
      statusCode: 409,
    });
  }
}

describe("invoice.service item guard (assertInvoiceDraft)", () => {
  test("allows item changes on a DRAFT invoice", () => {
    assert.doesNotThrow(() => assertInvoiceDraft("DRAFT"));
  });

  for (const status of ["SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const) {
    test(`blocks item changes on a ${status} invoice with INVOICE_NOT_DRAFT`, () => {
      assert.throws(
        () => assertInvoiceDraft(status),
        (err: Error & { code?: string; statusCode?: number }) => err.code === "INVOICE_NOT_DRAFT" && err.statusCode === 409
      );
    });
  }
});

// ─── Overpayment → credit note (P0 #3) ───────────────────────────────────────

// Mirrors the overpayment computation in addPayment.
function computeOverpayment(invoiceAmount: number, previousPaid: number, paymentAmount: number) {
  const rawAmountPaid = previousPaid + paymentAmount;
  const newAmountPaid = Math.min(rawAmountPaid, invoiceAmount);
  return { newAmountPaid, overpaidBy: rawAmountPaid - invoiceAmount };
}

// Mirrors the credit-note amount validation in creditNoteService.create.
function assertCreditAmount(amount: number, amountPaid: number) {
  if (amount <= 0) throw Object.assign(new Error("invalid"), { code: "INVALID_CREDIT_AMOUNT" });
  if (amount > amountPaid) throw Object.assign(new Error("exceeds"), { code: "CREDIT_EXCEEDS_PAID" });
}

describe("invoice.service overpayment → credit note (P0 #3)", () => {
  test("caps amountPaid at the invoice total and reports the overpaid delta", () => {
    const { newAmountPaid, overpaidBy } = computeOverpayment(1000, 800, 400);
    assert.equal(newAmountPaid, 1000);
    assert.equal(overpaidBy, 200);
  });

  test("no overpayment when payment exactly settles the invoice", () => {
    const { newAmountPaid, overpaidBy } = computeOverpayment(1000, 0, 1000);
    assert.equal(newAmountPaid, 1000);
    assert.equal(overpaidBy, 0);
  });

  test("no overpayment on a partial payment (delta is not positive)", () => {
    const { newAmountPaid, overpaidBy } = computeOverpayment(1000, 0, 400);
    assert.equal(newAmountPaid, 400);
    assert.ok(overpaidBy <= 0, "partial payment must not produce a positive overpaid delta");
  });
});

describe("creditNoteService.create : amount validation", () => {
  test("accepts a credit within the amount paid", () => {
    assert.doesNotThrow(() => assertCreditAmount(200, 1000));
  });

  test("rejects a non-positive amount", () => {
    assert.throws(() => assertCreditAmount(0, 1000), (e: Error & { code?: string }) => e.code === "INVALID_CREDIT_AMOUNT");
  });

  test("rejects a credit exceeding the amount paid", () => {
    assert.throws(() => assertCreditAmount(1200, 1000), (e: Error & { code?: string }) => e.code === "CREDIT_EXCEEDS_PAID");
  });
});

// ─── Invoice number generation (P1 #4) ───────────────────────────────────────

// Mirrors the number format produced by createInvoiceWithGeneratedNumber.
function buildInvoiceNumber(year: number, month1to12: number, sequence: number) {
  const prefix = `INV-${year}${String(month1to12).padStart(2, "0")}`;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

describe("invoice number generation (P1 #4)", () => {
  test("formats as INV-YYYYMM-NNNN with zero-padding", () => {
    assert.equal(buildInvoiceNumber(2026, 6, 1), "INV-202606-0001");
  });

  test("pads the month and keeps a 4-digit sequence", () => {
    assert.equal(buildInvoiceNumber(2026, 12, 42), "INV-202612-0042");
  });

  test("next number increments the sequence within the same month", () => {
    const count = 7; // 7 existing invoices this month
    assert.equal(buildInvoiceNumber(2026, 6, count + 1), "INV-202606-0008");
  });
});

// ─── Payment idempotency (P1 #5) ─────────────────────────────────────────────

// Mirrors the duplicate detection in addPayment: same invoice/amount/recorder within 10s.
function isDuplicatePayment(
  existing: { invoiceId: string; amount: number; recordedById: string | null; createdAt: number },
  incoming: { invoiceId: string; amount: number; recordedById: string | null },
  now: number
) {
  return (
    existing.invoiceId === incoming.invoiceId &&
    existing.amount === incoming.amount &&
    existing.recordedById === incoming.recordedById &&
    now - existing.createdAt <= 10_000
  );
}

describe("payment idempotency guard (P1 #5)", () => {
  const now = 1_000_000;
  const incoming = { invoiceId: "inv-1", amount: 500, recordedById: "user-1" };

  test("treats an identical payment within 10s as a duplicate", () => {
    const existing = { ...incoming, createdAt: now - 3_000 };
    assert.equal(isDuplicatePayment(existing, incoming, now), true);
  });

  test("an identical payment older than 10s is not a duplicate", () => {
    const existing = { ...incoming, createdAt: now - 11_000 };
    assert.equal(isDuplicatePayment(existing, incoming, now), false);
  });

  test("a different amount is not a duplicate", () => {
    const existing = { ...incoming, amount: 600, createdAt: now };
    assert.equal(isDuplicatePayment(existing, incoming, now), false);
  });

  test("a different recorder is not a duplicate", () => {
    const existing = { ...incoming, recordedById: "user-2", createdAt: now };
    assert.equal(isDuplicatePayment(existing, incoming, now), false);
  });
});
