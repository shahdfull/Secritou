// SEC-188: invoiceService.addPayment commits the payment (Payment row created, Invoice status ->
// PAID, portalActivatedAt set) INSIDE prisma.$transaction, then — post-commit — invites the
// client to the portal. The invite's try/catch only swallowed 409 (already invited); any other
// error (a real SMTP outage, a template failure) used to propagate and fail the whole HTTP
// request, making the caller believe the payment itself hadn't been recorded when it actually
// had. Fixed by catching any non-409 invite failure, logging it, and returning
// `portalInviteFailed: true` instead of throwing — the payment is reported as a success, and
// POST /clients/:id/invite (SEC-154) already supports a manual resend.
//
// This test imports and calls the real invoiceService.addPayment against a real database — not a
// reimplementation — mocking only clientService.inviteClientUser (the external side effect,
// module-level mock.method, not the target under test) to simulate a non-409 failure, and
// confirms the call still resolves successfully with the payment persisted and
// portalInviteFailed: true.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let clientService: typeof import("../src/services/client.service.js").clientService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
    ({ clientService } = await import("../src/services/client.service.js"));
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
describe("invoiceService.addPayment survives a non-409 portal invite failure (SEC-188)", () => {
  test("a real SMTP-style invite failure does not fail the payment — reports portalInviteFailed: true, payment is persisted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec188-client-${Date.now()}`, email: `sec188-${Date.now()}@example.com` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec188-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-188-${Date.now()}`, title: "Deposit", amount: 300, currency: "TND", status: "SENT", invoiceType: "DEPOSIT", clientId: client.id, projectId: project.id },
    });
    createdInvoiceIds.push(invoice.id);

    let inviteCallCount = 0;
    const originalInvite = clientService.inviteClientUser;
    clientService.inviteClientUser = async () => {
      inviteCallCount++;
      throw new Error("SMTP connection timed out");
    };

    let result: Awaited<ReturnType<typeof invoiceService.addPayment>>;
    try {
      result = await invoiceService.addPayment(invoice.id, { amount: 300, method: "BANK_TRANSFER" });
    } finally {
      clientService.inviteClientUser = originalInvite;
    }

    assert.equal(inviteCallCount, 1, "the invite must actually have been attempted");
    assert.equal(result.portalInviteFailed, true, "a non-409 invite failure must be reported, not thrown");
    assert.ok(result.payment, "the payment must still be returned as successful");

    const persistedPayment = await prisma.payment.findUnique({ where: { id: result.payment.id } });
    assert.ok(persistedPayment, "the payment must be persisted in the database despite the invite failure");

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(updatedInvoice!.status, "PAID", "the invoice must still be marked PAID");
  });

  test("a 409 (already invited) is still swallowed silently, no portalInviteFailed flag", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec188-409-client-${Date.now()}`, email: `sec188-409-${Date.now()}@example.com` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec188-409-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-188-409-${Date.now()}`, title: "Deposit", amount: 300, currency: "TND", status: "SENT", invoiceType: "DEPOSIT", clientId: client.id, projectId: project.id },
    });
    createdInvoiceIds.push(invoice.id);

    const { HttpError } = await import("../src/utils/httpError.js");
    const originalInvite = clientService.inviteClientUser;
    clientService.inviteClientUser = async () => {
      throw new HttpError(409, "Client user already exists");
    };

    let result: Awaited<ReturnType<typeof invoiceService.addPayment>>;
    try {
      result = await invoiceService.addPayment(invoice.id, { amount: 300, method: "BANK_TRANSFER" });
    } finally {
      clientService.inviteClientUser = originalInvite;
    }

    assert.equal(result.portalInviteFailed, false);
    assert.ok(result.payment);
  });
});
