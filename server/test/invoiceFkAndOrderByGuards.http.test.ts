// SEC-075/SEC-077: two related availability defects on the invoice HTTP surface, both proved
// through the real Express stack (app.ts -> routes -> controllers -> services), not a
// reimplementation of the guard logic — per CLAUDE.md, a test that mirrors the target instead of
// calling it proves nothing.
//
// SEC-075: invoice.repository.ts (findAll/findAllByServiceId/findDeleted) used to interpolate
// options.orderBy straight from req.query.orderBy into Prisma's orderBy clause, with no
// validation — an unknown field produced a raw 500 (PrismaClientValidationError) instead of
// falling back to the default sort, unlike 8 other repositories already using buildOrderBy.
//
// SEC-077: invoiceService.create had no existence check on clientId before the Prisma write — a
// syntactically valid but nonexistent clientId surfaced as a raw Prisma P2003 foreign-key
// violation (uncaught by error.middleware.ts, which only maps P2002), a 500 instead of a clean
// 404.
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

const TEST_EMAIL = "sec075077-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC075077";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let adminUserId: string | undefined;
let clientId: string | undefined;
let invoiceId: string | undefined;
let accessToken: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-075/077 HTTP Test User", passwordHash, role: "ADMIN" },
    });
    adminUserId = user.id;

    const client = await prisma.client.create({ data: { name: "SEC-075/077 client" } });
    clientId = client.id;

    const invoice = await prisma.invoice.create({
      data: {
        number: `SEC-075-077-TEST-${Date.now()}`,
        title: "SEC-075/077 invoice",
        amount: 500,
        currency: "TND",
        clientId: client.id,
        status: "DRAFT",
        invoiceType: "STANDARD",
      },
    });
    invoiceId = invoice.id;

    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessToken = loginRes.body.data.tokens.accessToken as string;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  if (invoiceId) await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
  if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before the
// async before() above has any chance to set the real value. Checking dbAvailable inside each test
// body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("GET /invoices: orderBy is whitelisted, not interpolated raw (SEC-075)", () => {
  test("an unknown orderBy field falls back silently to the default sort and returns 200", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/invoices")
      .query({ orderBy: "nonExistentField" })
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
  });

  test("a real, allowed orderBy field (amount) is honored and still returns 200", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/invoices")
      .query({ orderBy: "amount", orderDir: "asc" })
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
  });

  test("GET /invoices/trash: an unknown orderBy field falls back silently and returns 200", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/invoices/trash")
      .query({ orderBy: "client" })
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
  });
});

describe("POST /invoices: clientId existence is validated before the write (SEC-077)", () => {
  test("a syntactically valid but nonexistent clientId is rejected with 404 CLIENT_NOT_FOUND, not a raw 500", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Should not be created", amount: 100, clientId: crypto.randomUUID() });

    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.equal(res.body.error.code, "CLIENT_NOT_FOUND");
  });

  test("a real clientId still creates the invoice normally (no regression)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "SEC-075/077 regression check", amount: 250, clientId });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.clientId, clientId);
    await prisma.invoice.delete({ where: { id: res.body.data.id } }).catch(() => {});
  });
});
