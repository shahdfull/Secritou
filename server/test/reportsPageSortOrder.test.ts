// SEC-156 (ANOMALIES.yaml): ReportsPage.tsx requests pageSize:500 + orderBy:createdAt +
// orderDir:desc for leads/projects/invoices so its default "last 30 days" filter and PDF/Excel
// export compute stats on the most RECENT records. The concern was that parseListQuery's default
// orderDir ("asc") and 50-row cap (SEC-118) meant a company with >50 records in any of these
// three entities would see the report built on the 50 OLDEST rows instead of the requested ones.
//
// This test exercises the real HTTP stack (app.ts → routes → controllers → repositories) — not a
// reimplementation of parseListQuery/buildOrderBy — creating 60 records of each entity (more
// than the default 50-row cap) with staggered createdAt timestamps, then requesting the exact
// params ReportsPage.tsx sends (page:1, pageSize:500, orderBy:createdAt, orderDir:desc) and
// asserting the response actually contains the 60 most recent rows, not the 50 oldest.
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

const RECORD_COUNT = 60; // more than parseListQuery's default 50-row cap (SEC-118)
const TEST_EMAIL = `sec156-http-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPass123!SEC156";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let adminUserId: string;
let clientId: string;
const leadIds: string[] = [];
const projectIds: string[] = [];
const invoiceIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const admin = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-156 HTTP Test Admin", passwordHash, role: "ADMIN" },
    });
    adminUserId = admin.id;

    const client = await prisma.client.create({ data: { name: "SEC-156 test client" } });
    clientId = client.id;

    // Staggered createdAt timestamps (1 minute apart), oldest first — so "the 60 most recent"
    // is an unambiguous, verifiable set distinct from "the 50 oldest".
    const base = new Date("2020-01-01T00:00:00Z").getTime();
    for (let i = 0; i < RECORD_COUNT; i++) {
      const createdAt = new Date(base + i * 60_000);

      const lead = await prisma.lead.create({ data: { name: `SEC-156 lead ${i}`, createdAt } });
      leadIds.push(lead.id);

      const project = await prisma.project.create({ data: { name: `SEC-156 project ${i}`, clientId, createdAt } });
      projectIds.push(project.id);

      const invoice = await prisma.invoice.create({
        data: { number: `SEC-156-INV-${i}-${Date.now()}`, title: `SEC-156 invoice ${i}`, amount: 100, currency: "TND", status: "DRAFT", clientId, invoiceType: "STANDARD", createdAt },
      });
      invoiceIds.push(invoice.id);
    }
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Reports page sees the most recent records, not the oldest, past the default page-size cap (SEC-156)", () => {
  let accessToken: string;

  test("login as the test ADMIN", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app).post("/api/v1/auth/login").send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    accessToken = res.body.data.tokens.accessToken;
    assert.ok(accessToken);
  });

  const reportsParams = { page: 1, pageSize: 500, orderBy: "createdAt", orderDir: "desc" };

  test("GET /leads with ReportsPage's exact params returns all records with the newest first", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/leads")
      .query(reportsParams)
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const ours = res.body.data.filter((l: { id: string }) => leadIds.includes(l.id));
    assert.equal(ours.length, RECORD_COUNT, `expected all ${RECORD_COUNT} test leads returned (pageSize:500 must not be capped at 50)`);
    assert.equal(ours[0].name, `SEC-156 lead ${RECORD_COUNT - 1}`, "the most recently created lead must come first (orderDir:desc honored)");
    assert.equal(ours[ours.length - 1].name, "SEC-156 lead 0", "the oldest test lead must come last");
  });

  test("GET /projects with ReportsPage's exact params returns all records with the newest first", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/projects")
      .query(reportsParams)
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const ours = res.body.data.filter((p: { id: string }) => projectIds.includes(p.id));
    assert.equal(ours.length, RECORD_COUNT, `expected all ${RECORD_COUNT} test projects returned (pageSize:500 must not be capped at 50)`);
    assert.equal(ours[0].name, `SEC-156 project ${RECORD_COUNT - 1}`, "the most recently created project must come first (orderDir:desc honored)");
    assert.equal(ours[ours.length - 1].name, "SEC-156 project 0", "the oldest test project must come last");
  });

  test("GET /invoices with ReportsPage's exact params returns all records with the newest first", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/invoices")
      .query(reportsParams)
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const ours = res.body.data.filter((i: { id: string }) => invoiceIds.includes(i.id));
    assert.equal(ours.length, RECORD_COUNT, `expected all ${RECORD_COUNT} test invoices returned (pageSize:500 must not be capped at 50)`);
    assert.equal(ours[0].title, `SEC-156 invoice ${RECORD_COUNT - 1}`, "the most recently created invoice must come first (orderDir:desc honored)");
    assert.equal(ours[ours.length - 1].title, "SEC-156 invoice 0", "the oldest test invoice must come last");
  });
});
