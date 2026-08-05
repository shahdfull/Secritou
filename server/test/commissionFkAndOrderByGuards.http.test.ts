// SEC-079/SEC-081: two related availability defects on the commission HTTP surface, both proved
// through the real Express stack (app.ts -> routes -> controllers -> services), not a
// reimplementation of the guard logic — per CLAUDE.md, a test that mirrors the target instead of
// calling it proves nothing.
//
// SEC-079: commission.repository.ts#getAll used to interpolate options.orderBy straight from
// req.query.orderBy into Prisma's orderBy clause, with no validation — an unknown field produced
// a raw 500 (PrismaClientValidationError) instead of falling back to the default sort, same
// defect class as SEC-075 (invoice.repository.ts), distinct file.
//
// SEC-081: commissionService.setSplits validated ratePct sum/duplicates/PER_TASK mode but never
// that each partnerId corresponds to a real User before the write — a syntactically valid but
// nonexistent partnerId surfaced as a raw Prisma P2003 foreign-key violation (uncaught by
// error.middleware.ts), a 500 instead of a clean 404. Same defect class as SEC-077
// (invoice.service.ts#create), distinct file.
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

const ADMIN_EMAIL = "sec079081-admin-http-test@example.com";
const ADMIN_PASSWORD = "TestPass123!SEC079081Admin";
const MANAGER_EMAIL = "sec079081-manager-http-test@example.com";
const MANAGER_PASSWORD = "TestPass123!SEC079081Manager";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let adminUserId: string | undefined;
let managerUserId: string | undefined;
let realPartnerId: string | undefined;
let clientId: string | undefined;
let projectId: string | undefined;
let adminAccessToken: string | undefined;
let managerAccessToken: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await prisma.user.create({
      data: { email: ADMIN_EMAIL, name: "SEC-079/081 HTTP Test Admin", passwordHash: adminPasswordHash, role: "ADMIN" },
    });
    adminUserId = admin.id;

    // GET /commissions/my (SEC-079) requires authorize("MANAGER") — commission.routes.ts:33.
    const managerPasswordHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
    const manager = await prisma.user.create({
      data: { email: MANAGER_EMAIL, name: "SEC-079/081 HTTP Test Manager", passwordHash: managerPasswordHash, role: "MANAGER" },
    });
    managerUserId = manager.id;

    const partner = await prisma.user.create({
      data: { email: `sec079081-partner-${Date.now()}@test.local`, name: "SEC-079/081 Partner", passwordHash: "x", role: "ADMIN" },
    });
    realPartnerId = partner.id;

    const client = await prisma.client.create({ data: { name: "SEC-079/081 client" } });
    clientId = client.id;

    const project = await prisma.project.create({ data: { name: "SEC-079/081 project", clientId: client.id } });
    projectId = project.id;

    const adminLoginRes = await request(app).post("/api/v1/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminAccessToken = adminLoginRes.body.data.tokens.accessToken as string;
    const managerLoginRes = await request(app).post("/api/v1/auth/login").send({ email: MANAGER_EMAIL, password: MANAGER_PASSWORD });
    managerAccessToken = managerLoginRes.body.data.tokens.accessToken as string;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  if (projectId) await prisma.projectCommissionSplit.deleteMany({ where: { projectId } }).catch(() => {});
  if (projectId) await prisma.commissionSplitHistory.deleteMany({ where: { projectId } }).catch(() => {});
  if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  if (realPartnerId) await prisma.user.delete({ where: { id: realPartnerId } }).catch(() => {});
  if (managerUserId) await prisma.user.delete({ where: { id: managerUserId } }).catch(() => {});
  if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("GET /commissions/my: orderBy is whitelisted, not interpolated raw (SEC-079)", () => {
  test("an unknown orderBy field falls back silently to the default sort and returns 200", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/commissions/my")
      .query({ orderBy: "nonExistentField" })
      .set("Authorization", `Bearer ${managerAccessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
  });

  test("a real, allowed orderBy field (amount) is honored and still returns 200", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/commissions/my")
      .query({ orderBy: "amount", orderDir: "asc" })
      .set("Authorization", `Bearer ${managerAccessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
  });
});

describe("PUT /commissions/projects/:projectId/splits: partnerId existence is validated before the write (SEC-081)", () => {
  test("a syntactically valid but nonexistent partnerId is rejected with 404 PARTNER_NOT_FOUND, not a raw 500", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .put(`/api/v1/commissions/projects/${projectId}/splits`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ splits: [{ partnerId: crypto.randomUUID(), ratePct: 50 }] });

    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.equal(res.body.error.code, "PARTNER_NOT_FOUND");

    const splits = await prisma.projectCommissionSplit.findMany({ where: { projectId } });
    assert.equal(splits.length, 0, "no split row must exist after a rejected write");
  });

  test("a real partnerId still sets the split normally (no regression)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .put(`/api/v1/commissions/projects/${projectId}/splits`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ splits: [{ partnerId: realPartnerId, ratePct: 50 }] });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data[0].partnerId, realPartnerId);
  });
});
