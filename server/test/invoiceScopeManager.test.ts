// SEC-137: invoiceService already enforces MANAGER pole scope via assertInvoiceInScope
// (invoice.service.ts:31-44, applied to getById/update/send/addPayment/etc.), the same way
// documentScopeManager.test.ts (SEC-122) already proves for Document — but no test had ever
// called the real invoiceService with a cross-pole MANAGER scope to confirm it. Not a code
// defect: the guard is already correct and uniform; this closes the test gap identified when
// cross-checking a third-party audit report that asked for "documents OR invoices".
//
// This test imports and calls the real invoiceService.getById against a real database — not a
// reimplementation — proving a pole-A Manager is refused a pole-B invoice attached to a project,
// while a same-pole Manager and an ADMIN (unscoped) can still read it. An invoice with no
// projectId is intentionally left untested here: assertInvoiceInScope treats it as
// service-neutral by design (comment at invoice.service.ts:28-30), not a scope gap.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
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
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeInvoiceInPole(serviceId: string) {
  const client = await prisma.client.create({ data: { name: "sec137-scope client", serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "sec137-scope project", clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const invoice = await prisma.invoice.create({
    data: { number: `SEC137-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "Facture SEC-137", amount: 100, clientId: client.id, projectId: project.id },
  });
  createdInvoiceIds.push(invoice.id);
  return invoice;
}

describe("SEC-137: invoiceService.getById enforces Manager pole scope", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a pole-A Manager cannot read a pole-B invoice attached to a project", async () => {
    const invoice = await makeInvoiceInPole(serviceB);

    await assert.rejects(
      () => invoiceService.getById(invoice.id, { userRole: "MANAGER", userServiceId: serviceA }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test("a same-pole Manager can still read the invoice", async () => {
    const invoice = await makeInvoiceInPole(serviceA);

    const found = await invoiceService.getById(invoice.id, { userRole: "MANAGER", userServiceId: serviceA });
    assert.ok(found);
    assert.equal(found!.id, invoice.id);
  });

  test("an ADMIN (unscoped) can read an invoice from any pole", async () => {
    const invoice = await makeInvoiceInPole(serviceB);

    const found = await invoiceService.getById(invoice.id, { userRole: "ADMIN" });
    assert.ok(found);
    assert.equal(found!.id, invoice.id);
  });
});
