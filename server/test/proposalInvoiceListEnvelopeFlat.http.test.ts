// SEC-200/SEC-201 (ANOMALIES.yaml): the client's proposalsApi.getProposals / invoicesApi.getInvoices
// / invoicesApi.getTrash read `response.data` directly as the { data, total, page, pageSize }
// envelope — never `response.data.data`. Any regression in the controller that wraps this envelope
// a second time (`res.json({ data: result })` instead of `res.json(result)`) would silently break
// every list page again (Propositions, Factures, Corbeille factures never render a row), with no
// client-side signal, since a nested object still satisfies most TypeScript shapes loosely typed as
// `PaginatedResponse<T>`. This locks the real, flat shape at the HTTP boundary these client
// functions actually depend on.
//
// Exercised through the real HTTP stack (app.ts -> routes -> controllers), not a reimplementation
// of the client's unwrapping logic — per CLAUDE.md, a test that mirrors the target instead of
// calling it proves nothing. Requires a real, migrated database; skipped if unreachable.

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

const TEST_EMAIL = "sec200201-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC200";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let adminUserId: string | undefined;
let clientId: string | undefined;
let proposalId: string | undefined;
let invoiceId: string | undefined;
let accessToken: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-200/201 HTTP Test User", passwordHash, role: "ADMIN" },
    });
    adminUserId = user.id;

    const client = await prisma.client.create({ data: { name: "SEC-200/201 client" } });
    clientId = client.id;

    const proposal = await prisma.proposal.create({
      data: { title: "SEC-200/201 proposal", amount: 1000, currency: "TND", clientId: client.id, status: "DRAFT" },
    });
    proposalId = proposal.id;

    const invoice = await prisma.invoice.create({
      data: {
        number: "SEC-200-201-TEST-0001",
        title: "SEC-200/201 invoice",
        amount: 1000,
        amountHT: 840.336,
        tvaRate: 0.19,
        tvaAmount: 159.664,
        currency: "TND",
        clientId: client.id,
        status: "DRAFT",
        invoiceType: "DEPOSIT",
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
  if (proposalId) await prisma.proposal.delete({ where: { id: proposalId } }).catch(() => {});
  if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before the
// async before() above has any chance to set the real value. Checking dbAvailable inside each test
// body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("List endpoints return a FLAT pagination envelope, not double-wrapped (SEC-200, SEC-201)", () => {
  test("GET /proposals returns { data, total, page, pageSize } directly, not { data: { data, total, ... } }", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/proposals")
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data), "res.body.data must be the array directly — proposalsApi.getProposals reads response.data as this exact shape");
    assert.equal(typeof res.body.total, "number", "total must be a sibling of data, not nested under a second data");
    assert.equal(typeof res.body.page, "number");
    assert.equal(typeof res.body.pageSize, "number");
    assert.ok(res.body.data.some((p: { id: string }) => p.id === proposalId), "the freshly created proposal must actually appear in the flat data array");
  });

  test("GET /invoices returns { data, total, page, pageSize } directly, not { data: { data, total, ... } }", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    // search=SEC-200-201-TEST scopes to this test's own invoice — the default 10/page + createdAt
    // ordering would otherwise miss it whenever other tests in the same run have already created
    // enough invoices to push it past page 1.
    const res = await request(app)
      .get("/api/v1/invoices")
      .query({ search: "SEC-200-201-TEST" })
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data), "res.body.data must be the array directly — invoicesApi.getInvoices reads response.data as this exact shape");
    assert.equal(typeof res.body.total, "number");
    assert.equal(typeof res.body.page, "number");
    assert.equal(typeof res.body.pageSize, "number");
    assert.ok(res.body.data.some((i: { id: string }) => i.id === invoiceId), "the freshly created invoice must actually appear in the flat data array");
  });

  test("GET /invoices/trash returns { data, total, page, pageSize } directly, not { data: { data, total, ... } }", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .get("/api/v1/invoices/trash")
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data), "res.body.data must be the array directly — invoicesApi.getTrash reads response.data as this exact shape");
    assert.equal(typeof res.body.total, "number");
    assert.equal(typeof res.body.page, "number");
    assert.equal(typeof res.body.pageSize, "number");
  });
});
