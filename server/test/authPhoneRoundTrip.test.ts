// SEC-050 (session 2026-07-19) : the three auth paths used three different user selects, so `phone`
// was present on some auth responses (GET /auth/me → findUserById, full record) and absent on
// others (login/register/refresh → userPublicSelect, which omitted phone) — while toAuthUser and
// the client AuthUser type both promise it, and ClientProfilePage prefills its form from it.
// Resolution (porteur, AskUserQuestion) : make phone consistent = present everywhere → phone added
// to auth.repository.ts#userPublicSelect.
//
// This test imports and calls the real authService.login against a real database — not a mock —
// creating a user with a stored phone and asserting the login response carries it (and never the
// passwordHash). Proves the select actually fetches phone end to end.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

let prisma: typeof import("../src/config/prisma.js").prisma;
let authService: InstanceType<typeof import("../src/services/auth.service.js").AuthService>;
let dbAvailable = true;

const createdUserIds: string[] = [];
const email = `sec050-${Date.now()}@test.local`;
const phone = "+21620123456";

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    const { AuthService } = await import("../src/services/auth.service.js");
    authService = new AuthService();
    await prisma.$queryRaw`SELECT 1`;
    const user = await prisma.user.create({
      data: { email, name: "SEC-050", phone, passwordHash: bcrypt.hashSync("correct-password", 10), role: "CLIENT" },
    });
    createdUserIds.push(user.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("auth-user carries the stored phone — SEC-050", () => {
  test("login() returns the phone stored on the user (and never the passwordHash)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const result = await authService.login({ email, password: "correct-password" });
    assert.equal(result.user.phone, phone);
    assert.ok(!("passwordHash" in result.user), "passwordHash must not be exposed");
  });

  test("me() returns the same phone (the path that already worked, now consistent with login)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const user = await authService.me(createdUserIds[0]!);
    assert.equal(user.phone, phone);
  });
});
