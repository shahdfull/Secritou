// SEC-001: creditNoteService.listByInvoice (called from GET /invoices/:id/credit-notes) never
// checked a ServiceScope — the only :id-scoped invoice read in invoice.controller.ts that skipped
// assertInvoiceInScope (already applied everywhere else: getById/update/send/addPayment/addReminder/
// addItem/updateItem/deleteItem/addItemsFromTimeEntries — see invoiceScopeManager.test.ts for
// getById's own coverage). A MANAGER could list the credit notes of an invoice attached to a
// project outside their pôle. Fixed by loading the invoice and calling assertInvoiceInScope before
// querying CreditNote rows.
//
// This test imports and calls the real creditNoteService.listByInvoice against a real, migrated
// database — not a reimplementation of the scope check.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let creditNoteService: typeof import("../src/services/creditNote.service.js").creditNoteService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdCreditNoteIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ creditNoteService } = await import("../src/services/creditNote.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.creditNote.deleteMany({ where: { id: { in: createdCreditNoteIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makePaidInvoiceWithCreditNoteInPole(serviceId: string) {
  const client = await prisma.client.create({ data: { name: `sec001-cn-client-${Date.now()}` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "sec001-cn-project", clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const invoice = await prisma.invoice.create({
    data: { number: `SEC001-CN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "Facture SEC-001", amount: 100, amountPaid: 100, status: "PAID", clientId: client.id, projectId: project.id, invoiceType: "STANDARD" },
  });
  createdInvoiceIds.push(invoice.id);
  const creditNote = await prisma.creditNote.create({
    data: { number: `SEC001-CN-NOTE-${Date.now()}`, amount: 10, reason: "test", invoiceId: invoice.id, clientId: client.id },
  });
  createdCreditNoteIds.push(creditNote.id);
  return invoice;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("creditNoteService.listByInvoice enforces Manager pole scope (SEC-001)", () => {
  test("a pole-A Manager cannot list credit notes of a pole-B invoice", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makePaidInvoiceWithCreditNoteInPole(serviceB);

    await assert.rejects(
      () => creditNoteService.listByInvoice(invoice.id, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test("a same-pole Manager can list the invoice's credit notes", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makePaidInvoiceWithCreditNoteInPole(serviceA);

    const notes = await creditNoteService.listByInvoice(invoice.id, { userRole: "MANAGER", userServiceId: serviceA });
    assert.equal(notes.length, 1);
  });

  test("an ADMIN (unscoped) can list credit notes from any pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const invoice = await makePaidInvoiceWithCreditNoteInPole(serviceB);

    const notes = await creditNoteService.listByInvoice(invoice.id, { userRole: "ADMIN" });
    assert.equal(notes.length, 1);
  });
});
