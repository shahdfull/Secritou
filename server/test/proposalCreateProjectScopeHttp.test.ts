// SEC-019: proposal.controller.ts#createProposal calls projectService.getProjectById(projectId,
// userId, "MANAGER", scope.userServiceId) with 4 positional arguments, while the real signature
// is (id, userId, userRole, clientId?, serviceId?) — serviceId is the 5th argument, not the 4th.
// The MANAGER pole filter in project.repository.ts#findById (`where.serviceId`) received
// `undefined` instead of the manager's real serviceId, and a Prisma `where` clause with
// `serviceId: undefined` matches ANY pole — a MANAGER could create a proposal tied to a
// projectId from a completely different pole.
//
// This test exercises the real HTTP stack (app.ts → routes → controller → project.service.ts →
// project.repository.ts) via supertest — proving a cross-pole MANAGER is rejected, and a
// same-pole MANAGER still succeeds (the fix must not over-restrict the legitimate case).
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

const TEST_PASSWORD = "TestPass123!SEC019";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function login(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.tokens.accessToken as string;
}

async function makeManager(namePrefix: string, serviceId: string) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const manager = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: namePrefix, passwordHash, role: "MANAGER", serviceId },
  });
  createdUserIds.push(manager.id);
  // requirePermission("proposals", "create") runs before the controller's own scope check — a
  // MANAGER with no ManagerPermission row defaults to every permission false.
  await prisma.managerPermission.create({ data: { userId: manager.id, overrides: { proposals: { create: true } } } });
  return manager;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("POST /proposals — projectId pole scope for MANAGER (SEC-019)", () => {
  test("a cross-pole MANAGER is rejected (project not found in their scope), the proposal is never created", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec019 cross-pole client" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec019 cross-pole project", clientId: client.id, serviceId: serviceB } });
    createdProjectIds.push(project.id);
    const manager = await makeManager("sec019-manager-cross", serviceA);
    const token = await login(manager.email);

    const res = await request(app)
      .post("/api/v1/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "SEC-019 cross-pole proposal", clientId: client.id, projectId: project.id });

    // projectService.getProjectById throws its own 404 ("Project not found") once the pole
    // filter correctly excludes the row — the controller's own `if (!project) throw 403` never
    // gets a chance to run, same not-found-not-forbidden convention used elsewhere in this scope
    // (e.g. assertInvoiceInScope). What matters for this regression is that SOME rejection
    // happens before creation, not the specific status code.
    assert.equal(res.status, 404, JSON.stringify(res.body));

    const created = await prisma.proposal.findFirst({ where: { projectId: project.id } });
    assert.equal(created, null, "no proposal must have been created for the cross-pole project");
  });

  test("a same-pole MANAGER can still create a proposal for a project in their own pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec019 same-pole client" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec019 same-pole project", clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);
    const manager = await makeManager("sec019-manager-same", serviceA);
    const token = await login(manager.email);

    const res = await request(app)
      .post("/api/v1/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "SEC-019 same-pole proposal", clientId: client.id, projectId: project.id });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    createdProposalIds.push(res.body.data.id);
  });
});
