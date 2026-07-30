// SEC-029: the onboarding Payment step's amount/amountPaid/status used to be freely settable by
// the caller (ADMIN/MANAGER), with no link to the project's real DEPOSIT invoice — an ADMIN could
// mark status:"PAID" with an arbitrary amountPaid, shown to the CLIENT as fact
// (ClientOnboardingPage.tsx) with no guarantee the payment actually happened.
//
// This test imports and calls the real clientOnboardingService.createPayment/updatePayment
// against a real database — not a reimplementation — confirming amount/amountPaid/status/
// invoiceId are always derived from the project's real DEPOSIT invoice, never from caller input.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let clientOnboardingService: typeof import("../src/services/clientOnboarding.service.js").clientOnboardingService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdOnboardingIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ clientOnboardingService } = await import("../src/services/clientOnboarding.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.clientOnboarding.deleteMany({ where: { id: { in: createdOnboardingIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeOnboardingWithDepositInvoice(namePrefix: string, invoiceOverrides: { amount: number; amountPaid: number; status: "SENT" | "PARTIAL" | "PAID" }) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id } });
  createdProjectIds.push(project.id);
  const invoice = await prisma.invoice.create({
    data: {
      number: `${namePrefix}-DEP-${Date.now()}`,
      title: "Acompte 30%",
      amount: invoiceOverrides.amount,
      amountPaid: invoiceOverrides.amountPaid,
      status: invoiceOverrides.status,
      currency: "TND",
      invoiceType: "DEPOSIT",
      clientId: client.id,
      projectId: project.id,
    },
  });
  createdInvoiceIds.push(invoice.id);
  const onboarding = await prisma.clientOnboarding.create({
    data: {
      projectId: project.id,
      clientId: client.id,
      steps: { create: [{ stepType: "payment", title: "Paiement", orderIndex: 2 }] },
    },
    include: { steps: true },
  });
  createdOnboardingIds.push(onboarding.id);
  const paymentStep = onboarding.steps.find((s) => s.stepType === "payment")!;
  return { paymentStep, invoice };
}

describe("SEC-029: onboarding Payment step is derived from the real DEPOSIT invoice", () => {
  test("createPayment derives amount/amountPaid/status/invoiceId from the invoice, ignoring any caller input", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep, invoice } = await makeOnboardingWithDepositInvoice("sec029-create", { amount: 300, amountPaid: 0, status: "SENT" });

    const payment = await clientOnboardingService.createPayment(paymentStep.id, {});
    assert.equal(payment.invoiceId, invoice.id);
    assert.equal(Number(payment.amount), 300);
    assert.equal(Number(payment.amountPaid), 0);
    assert.equal(payment.status, "UNPAID");
  });

  test("a PARTIAL invoice maps to PaymentStatus.PARTIAL with the real amountPaid", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep, invoice } = await makeOnboardingWithDepositInvoice("sec029-partial", { amount: 300, amountPaid: 150, status: "PARTIAL" });

    const payment = await clientOnboardingService.createPayment(paymentStep.id, {});
    assert.equal(payment.invoiceId, invoice.id);
    assert.equal(Number(payment.amountPaid), 150);
    assert.equal(payment.status, "PARTIAL");
  });

  test("a PAID invoice maps to PaymentStatus.PAID", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep } = await makeOnboardingWithDepositInvoice("sec029-paid", { amount: 300, amountPaid: 300, status: "PAID" });

    const payment = await clientOnboardingService.createPayment(paymentStep.id, {});
    assert.equal(payment.status, "PAID");
  });

  test("updatePayment re-derives from the invoice's current state rather than trusting stale data", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep, invoice } = await makeOnboardingWithDepositInvoice("sec029-update", { amount: 300, amountPaid: 0, status: "SENT" });
    const payment = await clientOnboardingService.createPayment(paymentStep.id, {});
    assert.equal(payment.status, "UNPAID");

    // The invoice is paid afterwards (out of band, e.g. via invoiceService.addPayment in
    // real usage) — updatePayment must reflect the invoice's CURRENT state, not the value
    // captured at creation time.
    await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: 300, status: "PAID" } });

    const updated = await clientOnboardingService.updatePayment(payment.id, {});
    assert.equal(updated.status, "PAID");
    assert.equal(Number(updated.amountPaid), 300);
  });
});
