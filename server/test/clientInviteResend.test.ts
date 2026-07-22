// SEC-154 (ANOMALIES.yaml): clientService.inviteClientUser used to 409 unconditionally once a
// User row existed for the client, with no way for an ADMIN to resend a lost invitation email
// (e.g. SMTP was down at invite time) — the client was stuck forever unless they guessed to try
// forgot-password themselves. The fix distinguishes a never-logged-in account (lastLoginAt: null)
// from an active one: the former gets a fresh temp password reissued to the SAME account; the
// latter still 409s exactly as before.
//
// This test imports and calls the real clientService.inviteClientUser — not a reimplementation —
// against a real, migrated database. Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let clientService: typeof import("../src/services/client.service.js").clientService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ clientService } = await import("../src/services/client.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("clientService.inviteClientUser resend behavior (SEC-154)", () => {
  test("first invite creates a new User account (resent: false)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec154 client A" } });
    createdClientIds.push(client.id);
    const email = `sec154-a-${Date.now()}@example.com`;

    const result = await clientService.inviteClientUser(client.id, email, "SEC-154 Test Client");
    createdUserIds.push(result.user.id);

    assert.equal(result.resent, false);
    assert.equal(result.user.email, email);

    const usersForClient = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(usersForClient.length, 1, "exactly one User must exist after the first invite");
  });

  test("a second invite on a never-logged-in account resends to the SAME account instead of 409ing or creating a second User", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec154 client B" } });
    createdClientIds.push(client.id);
    const email = `sec154-b-${Date.now()}@example.com`;

    const first = await clientService.inviteClientUser(client.id, email, "SEC-154 Test Client B");
    createdUserIds.push(first.user.id);
    const firstPasswordHash = (await prisma.user.findUnique({ where: { id: first.user.id }, select: { passwordHash: true } }))!.passwordHash;

    // lastLoginAt is still null — the invitation was never consumed. This must NOT 409.
    const second = await clientService.inviteClientUser(client.id, email, "SEC-154 Test Client B");

    assert.equal(second.resent, true, "a resend on a never-logged-in account must report resent: true");
    assert.equal(second.user.id, first.user.id, "the resend must reuse the SAME account, not create a new one");

    const usersForClient = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(usersForClient.length, 1, "a resend must never result in a second User row for the same client");

    const secondPasswordHash = (await prisma.user.findUnique({ where: { id: first.user.id }, select: { passwordHash: true } }))!.passwordHash;
    assert.notEqual(secondPasswordHash, firstPasswordHash, "the resend must issue a fresh temp password, invalidating the old unread one");
  });

  test("a third invite attempt after the client has actually logged in (lastLoginAt set) still returns 409", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec154 client C" } });
    createdClientIds.push(client.id);
    const email = `sec154-c-${Date.now()}@example.com`;

    const first = await clientService.inviteClientUser(client.id, email, "SEC-154 Test Client C");
    createdUserIds.push(first.user.id);

    // Simulate the client having actually logged in at least once.
    await prisma.user.update({ where: { id: first.user.id }, data: { lastLoginAt: new Date() } });

    await assert.rejects(
      () => clientService.inviteClientUser(client.id, email, "SEC-154 Test Client C"),
      (err: unknown) => {
        const httpErr = err as { statusCode?: number };
        return httpErr.statusCode === 409;
      },
      "an already-active account (has logged in) must still 409, unchanged from before this fix"
    );

    const usersForClient = await prisma.user.findMany({ where: { clientId: client.id } });
    assert.equal(usersForClient.length, 1, "a rejected re-invite must never create a second User row");
  });
});
