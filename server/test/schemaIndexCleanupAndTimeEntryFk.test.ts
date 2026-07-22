// SEC-111/112/113/166/167: schema.prisma index cleanup batch.
// - SEC-111: ServiceRequest.priority/type had no index despite being used as WHERE filters
//   (serviceRequest.repository.ts).
// - SEC-112: Document had no composite (projectId, type) index despite
//   findLatestByProjectAndType filtering on exactly that pair.
// - SEC-113: ManagerPermission.profileId had no index despite
//   findUserIdsByProfileId filtering on it on every PermissionProfile update/delete.
// - SEC-166: TimeEntry.billedInvoiceId was a bare String with no FK/index — no referential
//   integrity, no index for a future "time billed on this invoice" lookup. Now a real relation
//   (onDelete: SetNull, invoices are never hard-deleted in practice).
// - SEC-167: User.email, FreelancerApplication.email, Payment.idempotencyKey each had a
//   redundant @@index on top of their own @unique/@@unique constraint (which already creates a
//   B-tree index) — pure write-cost/space duplication, dropped.
// All applied via migration 20260721020000_index_cleanup_and_time_entry_invoice_fk.
//
// This test queries the real database's pg_indexes/information_schema catalogs — not a
// description of intent — confirming the indexes exist (or were dropped) and the FK constraint
// is enforced by calling the real Prisma client.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdUserIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdTimeEntryIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.timeEntry.deleteMany({ where: { id: { in: createdTimeEntryIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function indexExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
    name
  );
  return rows.length > 0;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("schema index cleanup batch (SEC-111/112/113/166/167)", () => {
  test("SEC-111: ServiceRequest_priority_idx and ServiceRequest_type_idx exist", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    assert.ok(await indexExists("ServiceRequest_priority_idx"));
    assert.ok(await indexExists("ServiceRequest_type_idx"));
  });

  test("SEC-112: Document_projectId_type_idx exists", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    assert.ok(await indexExists("Document_projectId_type_idx"));
  });

  test("SEC-113: ManagerPermission_profileId_idx exists", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    assert.ok(await indexExists("ManagerPermission_profileId_idx"));
  });

  test("SEC-166: TimeEntry_billedInvoiceId_idx exists and the FK is enforced", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    assert.ok(await indexExists("TimeEntry_billedInvoiceId_idx"));

    const client = await prisma.client.create({ data: { name: `sec166-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec166-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const user = await prisma.user.create({ data: { email: `sec166-${Date.now()}@example.com`, name: "SEC-166 user", passwordHash: "x", role: "MANAGER" } });
    createdUserIds.push(user.id);
    const invoice = await prisma.invoice.create({ data: { number: `SEC-166-${Date.now()}`, title: "Invoice", amount: 100, currency: "TND", clientId: client.id } });
    createdInvoiceIds.push(invoice.id);

    const entry = await prisma.timeEntry.create({
      data: { projectId: project.id, userId: user.id, minutes: 30, date: new Date(), billed: true, billedInvoiceId: invoice.id },
    });
    createdTimeEntryIds.push(entry.id);

    const withRelation = await prisma.timeEntry.findUnique({ where: { id: entry.id }, include: { billedInvoice: true } });
    assert.equal(withRelation!.billedInvoice!.id, invoice.id, "billedInvoice relation must resolve to the real Invoice");

    await assert.rejects(
      () => prisma.timeEntry.create({ data: { projectId: project.id, userId: user.id, minutes: 10, date: new Date(), billedInvoiceId: "00000000-0000-0000-0000-000000000000" } }),
      /Foreign key constraint/,
      "a non-existent billedInvoiceId must be rejected by the real FK constraint"
    );
  });

  test("SEC-167: the redundant @@index on User.email/FreelancerApplication.email/Payment.idempotencyKey was dropped, the @unique index remains", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    assert.equal(await indexExists("User_email_idx"), false, "the redundant index must be dropped");
    assert.ok(await indexExists("User_email_key"), "the @@unique index must still exist");

    assert.equal(await indexExists("FreelancerApplication_email_idx"), false);
    assert.ok(await indexExists("FreelancerApplication_email_key"));

    assert.equal(await indexExists("Payment_idempotencyKey_idx"), false);
    assert.ok(await indexExists("Payment_idempotencyKey_key"));
  });
});
