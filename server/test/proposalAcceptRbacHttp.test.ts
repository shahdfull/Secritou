// SEC-124: rbac.test.ts only exercised authorize() in isolation with a hand-built req (never a
// mounted route), and no HTTP suite touched /proposals at all — so the RBAC guard on the real
// route (proposal.routes.ts:49, authorize("ADMIN","MANAGER")) was never proven end-to-end. The
// underlying scope control itself already has real-service coverage elsewhere
// (proposalScopeAfterCreation.test.ts); this test proves the HTTP-level rejection specifically.
//
// This test exercises the real HTTP stack (app.ts → routes → authorize() → controller) via
// supertest — proving a CLIENT is rejected with 403 on POST /proposals/:id/accept.
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

const TEST_PASSWORD = "TestPass123!SEC124";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

let serviceId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function login(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.tokens.accessToken as string;
}

describe("POST /proposals/:id/accept — real HTTP stack (SEC-124)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a CLIENT is rejected with 403, never reaching the accept logic", async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const client = await prisma.client.create({ data: { name: "sec124 client", serviceId } });
    createdClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: { email: `sec124-client-${Date.now()}@example.com`, name: "SEC-124 client", passwordHash, role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(clientUser.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-124 proposal", clientId: client.id, status: "SENT" },
    });
    createdProposalIds.push(proposal.id);
    const token = await login(clientUser.email);

    const res = await request(app)
      .post(`/api/v1/proposals/${proposal.id}/accept`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    assert.equal(res.status, 403, JSON.stringify(res.body));

    const untouched = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    assert.equal(untouched?.status, "SENT", "the proposal must not have been accepted");
  });
});
