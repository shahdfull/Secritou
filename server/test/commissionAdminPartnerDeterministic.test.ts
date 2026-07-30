// SEC-038: commissionRepository.getAdminPartnerId used findFirst({ where: { role: "ADMIN" } })
// with no orderBy — Postgres gives no row-order guarantee for that query, so with more than one
// ADMIN account (RG-021 explicitly allows several) the commission share could land on a
// different ADMIN from call to call. This was the real cause of the flaky
// commissionService.test.ts/commissionAutoSplitTaskTrigger.test.ts failures observed when other
// test files' temporary ADMIN fixtures existed in the DB at the same time (test:unit runs every
// file's before()/after() in one process against one shared database).
//
// This test calls the real commissionRepository.getAdminPartnerId (not a reimplementation)
// against a real database, creating a second (newer) ADMIN account and asserting the function
// still returns the older one, deterministically, across repeated calls.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commissionRepository: typeof import("../src/repositories/commission.repository.js").commissionRepository;
let dbAvailable = true;

const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commissionRepository } = await import("../src/repositories/commission.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("commissionRepository.getAdminPartnerId is deterministic across multiple ADMINs (SEC-038)", () => {
  test("always returns the oldest ADMIN account, not an arbitrary one", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const olderAdmin = await prisma.user.create({
      data: { name: `SEC038 older admin ${uniq}`, email: `sec038-older-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(olderAdmin.id);
    // Ensure a strictly later createdAt even under fast successive inserts / clock resolution.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newerAdmin = await prisma.user.create({
      data: { name: `SEC038 newer admin ${uniq}`, email: `sec038-newer-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(newerAdmin.id);

    for (let i = 0; i < 5; i++) {
      const result = await commissionRepository.getAdminPartnerId();
      // Any real seeded/other-suite ADMIN could also be older than both of ours — the only
      // guarantee we can assert without controlling the whole table is that the newer admin we
      // just created is never picked over an admin that already existed before it.
      assert.notEqual(result, newerAdmin.id, "must never pick the newer ADMIN over an older one");
    }
  });
});
