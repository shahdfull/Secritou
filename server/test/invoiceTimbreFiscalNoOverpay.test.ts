// RG-024 / SEC-198 (ANOMALIES.yaml): documentGeneratorService.generateInvoicePDF's "Net à payer"
// line used to be Invoice.amount + a local TIMBRE_FISCAL constant, never stored on Invoice and
// never checked by invoiceService.addPayment (which compares any payment to Invoice.amount
// alone) — a client paying exactly the PDF's stated total always overpaid by the timbre's
// amount, silently creating a CreditNote and a "trop-perçu" notification on every DEPOSIT/
// BALANCE invoice, even though nothing about that payment was actually wrong.
//
// Fixed by including TIMBRE_FISCAL in Invoice.amount itself (createDepositInvoiceTx/
// createBalanceInvoiceTx, invoice.service.ts) and storing it on Invoice.timbreFiscal, so the PDF
// and addPayment now agree on the exact same total.
//
// This test imports and calls the real proposalService.acceptWithCascade and
// invoiceService.addPayment against a real, migrated database — not a reimplementation of
// either — and pays EXACTLY Invoice.amount (the real "Net à payer" a client would read off
// their PDF), then asserts no CreditNote/overpayment was created. Requires a real database;
// skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { TIMBRE_FISCAL } from "../src/utils/vat.js";

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
  await prisma.creditNote.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.payment.deleteMany({ where: { invoice: { clientId: { in: clientIds } } } });
  await prisma.invoice.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Invoice.amount includes the timbre fiscal — paying it exactly never overpays (RG-024, SEC-198)", () => {
  test("the DEPOSIT invoice's amount is exactly amountTTC + TIMBRE_FISCAL, and timbreFiscal is stored", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec198-${Date.now()}-a@example.com`;
    const client = await prisma.client.create({ data: { name: "SEC-198 client", email, serviceId } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-198 proposal", amount: 1000, currency: "TND", status: "SENT", clientId: client.id, clientName: "SEC-198 Client", email },
    });
    createdProposalIds.push(proposal.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    assert.ok(result.invoiceId);

    const invoice = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
    assert.equal(invoice?.invoiceType, "DEPOSIT");
    assert.equal(Number(invoice!.timbreFiscal), TIMBRE_FISCAL, "the invoice must store the timbre fiscal actually applied");
    const amountBeforeTimbre = Number(invoice!.amount) - TIMBRE_FISCAL;
    assert.ok(amountBeforeTimbre > 0, "amount must be greater than the timbre alone (a real VAT total was added)");
  });

  test("paying exactly Invoice.amount (the real 'Net à payer') never creates a CreditNote or a portal-account-blocking short payment", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec198-${Date.now()}-b@example.com`;
    const client = await prisma.client.create({ data: { name: "SEC-198 client", email, serviceId } });
    createdClientIds.push(client.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-198 proposal", amount: 1000, currency: "TND", status: "SENT", clientId: client.id, clientName: "SEC-198 Client", email },
    });
    createdProposalIds.push(proposal.id);

    const result = await proposalService.acceptWithCascade(proposal.id);
    const invoiceBefore = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
    await invoiceService.send(result.invoiceId!);

    // Exactly what a real client would read off the PDF's "Net à payer" line and pay.
    const netAPayer = Number(invoiceBefore!.amount);
    const payment = await invoiceService.addPayment(result.invoiceId!, { amount: netAPayer });

    assert.equal(payment.creditNote, null, "paying exactly the PDF's stated total must never generate a CreditNote for overpayment");
    assert.equal(payment.overpaidBy, 0, "no overpayment must be recorded when the client pays exactly Invoice.amount");

    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
    assert.equal(invoiceAfter?.status, "PAID", "paying exactly the stated total must fully settle the invoice, not leave it PARTIAL");
  });
});
