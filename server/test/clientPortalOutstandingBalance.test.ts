// SEC-036: clientPortalRepository.getOutstandingBalance used to compute
// Math.max(Number(amount) - Number(amountPaid), 0) in raw floating-point, unlike the identical
// calculation in creditNote.service.ts#167 which wraps it in roundMoney(). A partial payment
// leaving a fractional millime residue (Decimal(14,3) arithmetic re-expressed as JS numbers) could
// surface a value like 1200.0000000000002 to the CLIENT-facing portal summary instead of 1200.
//
// This test calls the real clientPortalRepository.getOutstandingBalance (not a reimplementation)
// against invoice rows crafted to trigger float residue in Number(amount) - Number(amountPaid).
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let clientPortalRepository: typeof import("../src/repositories/clientPortal.repository.js").clientPortalRepository;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ clientPortalRepository } = await import("../src/repositories/clientPortal.repository.js"));
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

describe("clientPortalRepository.getOutstandingBalance (SEC-036)", () => {
  test("returns a value rounded to 3 decimals (millimes), no float residue", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({ data: { name: `SEC036 client ${uniq}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `SEC036 project ${uniq}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    // 1000.1 - 800.2 = 199.90000000000003 in raw IEEE-754 float subtraction.
    const invoice = await prisma.invoice.create({
      data: {
        number: `SEC036-${uniq}`,
        title: "Balance",
        amount: 1000.1,
        amountPaid: 800.2,
        clientId: client.id,
        projectId: project.id,
        invoiceType: "BALANCE",
        status: "PARTIAL",
      },
    });
    createdInvoiceIds.push(invoice.id);

    const balance = await clientPortalRepository.getOutstandingBalance(client.id);
    assert.equal(balance, 199.9, "outstanding balance must be rounded to 3 decimals, not carry float residue");
  });
});
