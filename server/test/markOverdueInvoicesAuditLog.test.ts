// SEC-186: markOverdueInvoices (daily cron, maintenance.processor.ts) flips SENT/PARTIAL
// invoices past their due date to OVERDUE via a bare updateMany, with no AuditLog entry — the
// only one of the 4 invoice status transitions the porteur cited (issued/paid/overdue/cancelled)
// missing from the audit trail, unlike send/addPayment/cancel in invoice.service.ts which are all
// journaled. Fixed by calling auditLogService.record (actorId/actorRole null — system-triggered,
// AuditLog already supports nullable actor fields) for each invoice it marks OVERDUE.
//
// This test imports and calls the real markOverdueInvoices against a real database — not a
// reimplementation — and confirms an AuditLog row exists for the transition afterward.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let markOverdueInvoices: typeof import("../src/jobs/processors/maintenance.processor.js").markOverdueInvoices;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ markOverdueInvoices } = await import("../src/jobs/processors/maintenance.processor.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdInvoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("markOverdueInvoices records an AuditLog entry for the OVERDUE transition (SEC-186)", () => {
  test("an invoice past its due date gets an AuditLog row with action invoice.markOverdue", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec186-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const invoice = await prisma.invoice.create({
      data: { number: `SEC-186-${Date.now()}`, title: "Overdue test", amount: 100, currency: "TND", status: "SENT", clientId: client.id, dueDate: pastDue },
    });
    createdInvoiceIds.push(invoice.id);

    await markOverdueInvoices();

    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(updated!.status, "OVERDUE");

    const log = await prisma.auditLog.findFirst({ where: { entityId: invoice.id, action: "invoice.markOverdue" } });
    assert.ok(log, "an AuditLog row must exist for the OVERDUE transition");
    assert.equal(log!.actorId, null, "actorId must be null — system-triggered, not a user action");
    assert.equal(log!.entityType, "Invoice");
  });
});
