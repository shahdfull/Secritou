// SEC-187: leadService.createLead relied on a pre-check (tx.lead.findFirst then tx.lead.create)
// followed by a P2002 catch presented in a comment as "the DB-level unique constraint is the
// real guard" — but Lead.email only ever carried a plain @@index, never a unique constraint, so
// the P2002 branch was dead code. Two genuinely concurrent createLead calls for the same email
// could both read "no duplicate yet" before either commits, producing two active leads for the
// same prospect despite SEC-155's sequential-only test coverage.
//
// Fixed by applying migration 20260720000000_lead_email_unique_active — a real partial unique
// index, `UNIQUE (LOWER(email)) WHERE email IS NOT NULL AND archivedAt IS NULL` — making the
// existing P2002 catch in createLead a real, load-bearing guard instead of dead code. That
// migration file predates this test (written by a concurrent process earlier in this session,
// confirmed via ANOMALIES.yaml's own attribution notes) but had never been applied; applying it
// and proving it here is this session's own work.
//
// This test imports and calls the real leadService.createLead against a real database — not a
// reimplementation — firing two strictly concurrent calls with the same email
// (Promise.allSettled, the same model already validated for acceptWithCascade in
// proposalAcceptCascadeConcurrency.test.ts / SEC-134), and confirms only one active Lead exists
// afterward.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadService: typeof import("../src/services/lead.service.js").leadService;
let dbAvailable = true;

const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadService } = await import("../src/services/lead.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("leadService.createLead under real concurrency (SEC-187)", () => {
  test("two strictly concurrent creates with the same email never both produce an active Lead", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const email = `sec187-${Date.now()}@example.com`;

    const results = await Promise.allSettled([
      leadService.createLead({ name: "SEC-187 lead A", email }),
      leadService.createLead({ name: "SEC-187 lead B", email }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof leadService.createLead>>>[];
    for (const r of fulfilled) createdLeadIds.push(r.value.id);

    assert.equal(fulfilled.length, 1, `expected exactly 1 of the 2 concurrent creates to succeed, got ${fulfilled.length}`);

    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0]!.reason as { code?: string }).code, "LEAD_EMAIL_ALREADY_EXISTS");

    const activeCount = await prisma.lead.count({ where: { email, archivedAt: null } });
    assert.equal(activeCount, 1, `expected exactly 1 active Lead with this email in the database, found ${activeCount}`);
  });
});
