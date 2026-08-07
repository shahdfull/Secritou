// SEC-067: logout() used to call authDenylist.revokeAccessToken({ sub: stored.userId }) with no
// jti — this wrote only userKey(sub), banning EVERY access token for that account (not just the
// one logging out) for the full JWT_ACCESS_EXPIRES_IN window (15 min by default). A user who
// logged out and immediately logged back in received a brand-new, never-individually-revoked
// access token that was still rejected 401 by authenticate(), because isAccessTokenRevoked checks
// userKey before any jti. Fixed: logout now revokes only the jti of the token that is logging out
// (authDenylist.revokeAccessTokenByJti), leaving userKey() untouched — a fresh login is unaffected.
//
// The other 6 call sites of revokeAccessToken({ sub }) (resetPassword, changePassword, gdpr erase
// x2, role change, delete) are unchanged and must still block every token for the account — this
// file proves both: the fix (logout) and the non-regression (role change still blocks everything).
//
// This test exercises the real HTTP stack (app.ts -> routes -> controllers -> services) via
// supertest against a real database and real Redis — not mocks. Requires both reachable; skipped
// otherwise.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { closeJobQueueConnections } from "./testCleanup.js";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const TEST_PASSWORD = "TestPass123!SEC067";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAndRedisAvailable = true;

const createdUserIds: string[] = [];
const createdServiceIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
    const { authDenylist } = await import("../src/cache/authDenylist.js");
    const probeJti = `sec067-probe-${Date.now()}`;
    await authDenylist.revokeAccessTokenByJti({ jti: probeJti, exp: Math.floor(Date.now() / 1000) + 60 });
    const seen = await authDenylist.isAccessTokenRevoked({ sub: "irrelevant", jti: probeJti });
    if (!seen) throw new Error("redis not reachable or CACHE_ENABLED=false");
  } catch {
    dbAndRedisAvailable = false;
  }
});

after(async () => {
  if (!dbAndRedisAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
});

// SEC-073: closes the BullMQ/ioredis connection auth.service.ts opens transitively (via
// jobs/queues.ts) at import time — without this, node --test never exits when this file runs
// alone (npx tsx --test logoutRevokesTokenNotAccount.test.ts), even though run-all.test.ts's own
// global after() already covers this file when it's imported through the aggregator.
after(closeJobQueueConnections);

function extractCookie(setCookieHeader: string[] | undefined, name: string): string | undefined {
  const header = setCookieHeader?.find((c) => c.startsWith(`${name}=`));
  return header?.split(";")[0];
}

describe("SEC-067: logout revokes only the logging-out token, not the whole account", () => {
  test("a fresh login immediately after logout succeeds (no 15-minute lockout)", async (t) => {
    if (!dbAndRedisAvailable) { t.skip("database or Redis unreachable"); return; }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: `sec067-fix-${Date.now()}@example.com`, name: "SEC-067 Fix", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    const login1 = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    assert.equal(login1.status, 200);
    const accessToken1 = login1.body.data.tokens.accessToken;
    const refreshCookie1 = extractCookie(login1.headers["set-cookie"] as unknown as string[] | undefined, "secritou_refresh");

    const me1 = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken1}`);
    assert.equal(me1.status, 200, "token must work before logout");

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshCookie1 ?? "")
      .set("Authorization", `Bearer ${accessToken1}`)
      .send({});
    assert.equal(logout.status, 204);

    // The OLD token must now be rejected (it was the one that logged out).
    const meOldToken = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken1}`);
    assert.equal(meOldToken.status, 401, "the token that logged out must itself be rejected");

    // A BRAND-NEW login right after must succeed — this is the SEC-067 fix.
    const login2 = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    assert.equal(login2.status, 200, "login immediately after logout must succeed");
    const accessToken2 = login2.body.data.tokens.accessToken;
    assert.notEqual(accessToken1, accessToken2);

    const me2 = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken2}`);
    assert.equal(me2.status, 200, "a freshly issued token after logout must be usable, not blocked for 15 minutes");
  });

  test("logging out one session does not affect a second, still-active session of the same user", async (t) => {
    if (!dbAndRedisAvailable) { t.skip("database or Redis unreachable"); return; }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: `sec067-twosessions-${Date.now()}@example.com`, name: "SEC-067 Two Sessions", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    const loginA = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    const loginB = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    const tokenA = loginA.body.data.tokens.accessToken;
    const tokenB = loginB.body.data.tokens.accessToken;
    const cookieA = extractCookie(loginA.headers["set-cookie"] as unknown as string[] | undefined, "secritou_refresh");

    const logoutA = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieA ?? "")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});
    assert.equal(logoutA.status, 204);

    const meA = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${tokenA}`);
    assert.equal(meA.status, 401, "the logged-out session's token must be rejected");

    const meB = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${tokenB}`);
    assert.equal(meB.status, 200, "a different, still-active session of the same user must be unaffected");
  });
});

describe("SEC-067 non-regression: the other revokeAccessToken({ sub }) call sites still block every token", () => {
  test("changing a user's role still revokes ALL of that user's existing tokens", async (t) => {
    if (!dbAndRedisAvailable) { t.skip("database or Redis unreachable"); return; }

    const service = await prisma.service.create({ data: { name: `SEC-067 non-regression service ${Date.now()}` } });
    createdServiceIds.push(service.id);

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const target = await prisma.user.create({
      data: { email: `sec067-rolechange-${Date.now()}@example.com`, name: "SEC-067 Role Change", passwordHash, role: "FREELANCER" },
    });
    createdUserIds.push(target.id);
    const admin = await prisma.user.create({
      data: { email: `sec067-admin-${Date.now()}@example.com`, name: "SEC-067 Admin", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(admin.id);

    const targetLogin = await request(app).post("/api/v1/auth/login").send({ email: target.email, password: TEST_PASSWORD });
    const targetToken = targetLogin.body.data.tokens.accessToken;

    const meBefore = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${targetToken}`);
    assert.equal(meBefore.status, 200, "token must work before the role change");

    const adminLogin = await request(app).post("/api/v1/auth/login").send({ email: admin.email, password: TEST_PASSWORD });
    const adminToken = adminLogin.body.data.tokens.accessToken;

    const roleChange = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "MANAGER", serviceId: service.id });
    assert.equal(roleChange.status, 200, JSON.stringify(roleChange.body));

    // Unlike logout, a role change must still block the token entirely — non-regression.
    const meAfter = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${targetToken}`);
    assert.equal(meAfter.status, 401, "a role change must still revoke every existing token for that account");
  });

  test("deleting a user still revokes ALL of that user's existing tokens", async (t) => {
    if (!dbAndRedisAvailable) { t.skip("database or Redis unreachable"); return; }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const target = await prisma.user.create({
      data: { email: `sec067-delete-${Date.now()}@example.com`, name: "SEC-067 Delete Target", passwordHash, role: "FREELANCER" },
    });
    const admin = await prisma.user.create({
      data: { email: `sec067-admin2-${Date.now()}@example.com`, name: "SEC-067 Admin 2", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(admin.id);

    const targetLogin = await request(app).post("/api/v1/auth/login").send({ email: target.email, password: TEST_PASSWORD });
    const targetToken = targetLogin.body.data.tokens.accessToken;

    const adminLogin = await request(app).post("/api/v1/auth/login").send({ email: admin.email, password: TEST_PASSWORD });
    const adminToken = adminLogin.body.data.tokens.accessToken;

    const del = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(del.status, 204, JSON.stringify(del.body));

    const meAfter = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${targetToken}`);
    assert.equal(meAfter.status, 401, "deleting a user must still revoke every existing token for that account");
  });
});
