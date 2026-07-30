// SEC-037: gdprService.eraseClient used to run its anonymize-mode writes (Client, related
// Leads, portal Users) as separate sequential Prisma calls, not a single transaction — a
// mid-sequence failure left the Client anonymized while its portal Users kept their real PII.
// Fixed by grouping every write for a given mode inside prisma.$transaction.
//
// This test calls the real gdprService.eraseClient (not a reimplementation) against a real
// database, forcing a rollback mid-transaction (a portal User update that violates a real
// constraint) and asserting that the Client itself was NOT anonymized either — proving the
// transaction actually rolled back as a unit, not just that the later step failed.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let gdprService: typeof import("../src/services/gdpr.service.js").gdprService;
let anonymizedEmail: typeof import("../src/services/gdpr.service.js").anonymizedEmail;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ gdprService, anonymizedEmail } = await import("../src/services/gdpr.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("gdprService.eraseClient anonymize mode is atomic (SEC-037)", () => {
  test("a failure while anonymizing a portal User rolls back the Client's own anonymization too", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({
      data: { name: `SEC037 client ${uniq}`, email: `sec037-${uniq}@test.local`, phone: "+21600000001" },
    });
    createdClientIds.push(client.id);
    // Forces anonymize mode (not hard-delete) via a real Invoice, same guard eraseClient uses.
    const invoice = await prisma.invoice.create({
      data: { number: `SEC037-${uniq}`, title: "Test invoice", amount: 100, amountHT: 100, clientId: client.id },
    });
    createdInvoiceIds.push(invoice.id);
    const portalUser1 = await prisma.user.create({
      data: { name: `SEC037 portal user A ${uniq}`, email: `sec037-usera-${uniq}@test.local`, passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(portalUser1.id);
    // A second portal user pre-anonymized to portalUser1's own future target email (using the
    // real anonymizedEmail() derivation, not a reimplementation) forces a genuine
    // @@unique([email]) violation when eraseClient's transaction reaches tx.user.update for
    // portalUser1 partway through its loop.
    const portalUser2 = await prisma.user.create({
      data: { name: `SEC037 portal user B ${uniq}`, email: anonymizedEmail(portalUser1.id), passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(portalUser2.id);

    await assert.rejects(() => gdprService.eraseClient(client.id, { id: "actor-admin", role: "ADMIN" }));

    const clientAfter = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(clientAfter?.name, `SEC037 client ${uniq}`, "the Client must NOT be anonymized — the transaction must have rolled back as a unit");
    assert.equal(clientAfter?.email, `sec037-${uniq}@test.local`);

    const user1After = await prisma.user.findUnique({ where: { id: portalUser1.id } });
    assert.equal(user1After?.email, `sec037-usera-${uniq}@test.local`, "portalUser1 must NOT be anonymized either — same rolled-back transaction");
  });
});
