// SEC-006 (ANOMALIES.yaml): integration test for the Client-portal phone field, exercised
// through the real HTTP stack (app.ts → routes → validators → controllers → services →
// repositories → the real database), not a mocked repository. This anomaly was previously
// declared resolved twice on a criterion that only checked "no more error", not "the feature
// actually works end to end" — the repository-boundary-mocked test in user.service.test.ts
// proves the service layer, but not that userPublicFields/toAuthUser/the validator/the route
// actually wire phone through, which is exactly where the original defects lived.
//
// Requires a real, migrated database (DATABASE_URL) — skipped automatically if unreachable,
// so it never blocks the rest of the suite in an environment without one configured.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const TEST_EMAIL = "sec006-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC006";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let testClientId: string | undefined;
let testUserId: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const client = await prisma.client.create({ data: { name: "SEC-006 HTTP test client" } });
    testClientId = client.id;
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-006 HTTP Test User", passwordHash, role: "CLIENT", clientId: client.id },
    });
    testUserId = user.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  if (testUserId) await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  if (testClientId) await prisma.client.delete({ where: { id: testClientId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Client portal phone field — real HTTP stack (SEC-006)", () => {
  let accessToken: string;

  test("login as the CLIENT test user", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.user.phone, null, "freshly created user should start with no phone");
    accessToken = res.body.data.tokens.accessToken;
    assert.ok(accessToken, "login must return an access token");
  });

  test("(1) write: PATCH /users/me with a phone number persists it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "SEC-006 HTTP Test User", phone: "+21612345678" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.phone, "+21612345678");
  });

  test("(2) reread: a fresh GET /users/me shows the same value (relu ET pré-rempli, per the criterion)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.phone, "+21612345678", "a fresh request must see the persisted value, not stale client state");
  });

  test("a name-only update does not clear the previously written phone", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "SEC-006 Renamed" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.phone, "+21612345678", "phone must survive an update that never mentions it");
  });

  test("(3) clear: PATCH /users/me with phone: null actually removes it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "SEC-006 Renamed", phone: null });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.phone, null, "clearing must actually null the field in the response");

    const reread = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(reread.status, 200);
    assert.equal(reread.body.data.phone, null, "a fresh GET after clearing must also show null, not the stale value");
  });
});
