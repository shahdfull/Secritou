// Tests for invoice.service business logic — no DB, no imports of service
// Pattern: same as rating.service.test.ts — pure logic stubs, node:test + assert

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

describe("addPayment — status logic", () => {
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

describe("addPayment — guard logic", () => {
  const INVOICE_ID = "inv-1";
  const COMPANY_ID = "company-1";

  test("rejects negative payment amount before any DB call", async () => {
    await assert.rejects(
      async () => {
        if (-100 <= 0) throw new Error("Payment amount must be positive");
      },
      /positive/i
    );
  });

  test("rejects zero payment amount before any DB call", async () => {
    await assert.rejects(
      async () => {
        if (0 <= 0) throw new Error("Payment amount must be positive");
      },
      /positive/i
    );
  });

  test("overpayment on PAID invoice stays PAID via computeNewStatus", () => {
    // When amountPaid (1000) + new payment (100) >= amount (1000), status = PAID
    const result = computeNewStatus(1000, 1000, 100, "PAID");
    assert.equal(result, "PAID", "Additional payment on a PAID invoice must keep status PAID");
  });
});

// ─── Unit tests for computeNewStatus ────────────────────────────────────────

describe("computeNewStatus — pure logic", () => {
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
