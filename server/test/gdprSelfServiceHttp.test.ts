// SEC-224: /gdpr/me/* is the only pair of GDPR routes without authorize("ADMIN") — the
// authorization boundary here is entirely "identity comes from req.user.sub, never a URL
// param" (gdpr.controller.ts#exportMe/eraseMe). A service-level test can't prove that: it would
// call gdprService.exportUser/eraseUser directly and never exercise the routing/controller layer
// that is the actual thing being trusted here. This test exercises the real HTTP stack
// (app.ts -> gdpr.routes.ts -> gdpr.controller.ts) via supertest, proving:
//   1. A non-ADMIN (FREELANCER) can reach /gdpr/me/export and /gdpr/me/erase for their own data.
//   2. The same non-ADMIN is still rejected 403 on the ADMIN-only /gdpr/users/:id/export route
//      (self-service does not accidentally widen the existing ADMIN-only routes).
//
// Requires a real, migrated database; skipped if unreachable.

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

const TEST_PASSWORD = "TestPass123!SEC224";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function login(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.tokens.accessToken as string;
}

// SEC-195: check dbAvailable inside each test body, not via describe/test `skip` option — see
// gdprErasure.test.ts for the full rationale.
describe("GET/POST /gdpr/me — self-service, real HTTP stack (SEC-224)", () => {
  test("a FREELANCER can export their own data without being ADMIN", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const uniq = Date.now();
    const email = `sec224-export-${uniq}@example.com`;
    const freelancer = await prisma.user.create({
      data: { email, name: "SEC-224 freelancer", passwordHash, role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);
    const token = await login(email);

    const res = await request(app).get("/api/v1/gdpr/me/export").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.user.id, freelancer.id);
  });

  test("a FREELANCER can erase their own data (hard-deleted, no financial history) without being ADMIN", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const uniq = Date.now() + 1;
    const email = `sec224-erase-${uniq}@example.com`;
    const freelancer = await prisma.user.create({
      data: { email, name: "SEC-224 freelancer erase", passwordHash, role: "FREELANCER" },
    });
    const token = await login(email);

    const res = await request(app).post("/api/v1/gdpr/me/erase").set("Authorization", `Bearer ${token}`).send({});

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.mode, "deleted");

    const gone = await prisma.user.findUnique({ where: { id: freelancer.id } });
    assert.equal(gone, null);
  });

  test("self-service does not widen the ADMIN-only routes — a FREELANCER is still rejected 403 on /gdpr/users/:id/export", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const uniq = Date.now() + 2;
    const email = `sec224-guard-${uniq}@example.com`;
    const freelancer = await prisma.user.create({
      data: { email, name: "SEC-224 freelancer guard", passwordHash, role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);
    const token = await login(email);

    const res = await request(app)
      .get(`/api/v1/gdpr/users/${freelancer.id}/export`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 403, JSON.stringify(res.body));
  });
});
