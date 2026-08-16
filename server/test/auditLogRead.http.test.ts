// SEC-114: auditLogService.record() has written to AuditLog since well before this test existed
// (task/project/invoice/gdpr/creditNote/approval/user/managerPermission services, plus a
// cron-driven invoice transition) — but nothing ever read it back. This exercises the real HTTP
// stack (app.ts -> authenticate -> authorize -> GET /audit-log) against a real database, not a
// reimplementation of the RBAC check or of auditLogService itself.
//
// Requires a real, migrated database (DATABASE_URL) — skipped automatically if unreachable.

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

const suffix = Date.now();
const ADMIN_EMAIL = `sec114-admin-${suffix}@example.com`;
const MANAGER_EMAIL = `sec114-manager-${suffix}@example.com`;
const PASSWORD = "TestPass123!SEC114";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: { email: ADMIN_EMAIL, name: "SEC-114 Admin", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const manager = await prisma.user.create({
      data: { email: MANAGER_EMAIL, name: "SEC-114 Manager", passwordHash, role: "MANAGER" },
    });
    createdUserIds.push(manager.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.auditLog.deleteMany({ where: { entityType: "Task", action: "task.delete", actorId: { in: createdUserIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// SEC-073: lets this file also run correctly in isolation (npx tsx --test auditLogRead.http.test.ts)
// — no-ops when run through run-all.test.ts, whose own after() already owns this cleanup.
after(closeJobQueueConnections);

describe("GET /audit-log is ADMIN-only (SEC-114)", () => {
  test("no token is rejected with 401", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app).get("/api/v1/audit-log");
    assert.equal(res.status, 401);
  });

  test("a MANAGER token is rejected with 403", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const login = await request(app).post("/api/v1/auth/login").send({ email: MANAGER_EMAIL, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const res = await request(app)
      .get("/api/v1/audit-log")
      .set("Authorization", `Bearer ${login.body.data.tokens.accessToken}`);
    assert.equal(res.status, 403);
  });

  test("an ADMIN token is granted access", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const login = await request(app).post("/api/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const res = await request(app)
      .get("/api/v1/audit-log")
      .set("Authorization", `Bearer ${login.body.data.tokens.accessToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.data));
  });
});

describe("End-to-end: a real write (task.delete) is retrievable via GET /audit-log (SEC-114)", () => {
  test("creating then deleting a task writes an entry findable via the new read endpoint", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const login = await request(app).post("/api/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.data.tokens.accessToken as string;

    const client = await prisma.client.create({ data: { name: `SEC-114 client ${suffix}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `SEC-114 project ${suffix}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({
      data: { title: `SEC-114 task ${suffix}`, projectId: project.id, status: "TODO" },
    });
    createdTaskIds.push(task.id);

    // task.service.ts#delete calls auditLogService.record({ action: "task.delete", ... }) — the
    // real write path this whole anomaly is about, exercised here via the real HTTP DELETE, not
    // by calling the service directly (which would prove nothing about the route being wired).
    const deleteRes = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(deleteRes.status, 204, JSON.stringify(deleteRes.body));
    createdTaskIds.splice(createdTaskIds.indexOf(task.id), 1); // already gone, don't try to delete it again in after()

    // task.service.ts#deleteTask calls auditLogService.record via `void` (fire-and-forget, same
    // pattern as approvalAuditLog.test.ts#findAuditLogFor) — the write can still be in flight
    // when the 204 response returns, so poll the read endpoint rather than assume it's already
    // landed.
    type AuditEntry = { action: string; entityType: string; entityId: string; actorName: string | null };
    let found: AuditEntry | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      const auditRes = await request(app)
        .get("/api/v1/audit-log")
        .query({ entityType: "Task", entityId: task.id })
        .set("Authorization", `Bearer ${token}`);
      assert.equal(auditRes.status, 200, JSON.stringify(auditRes.body));
      const entries = auditRes.body.data.data as AuditEntry[];
      found = entries.find((e) => e.action === "task.delete" && e.entityId === task.id);
      if (!found) await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.ok(found, `expected a task.delete entry for ${task.id} to become visible via GET /audit-log`);
    assert.equal(found.entityType, "Task");
    assert.equal(found.actorName, "SEC-114 Admin");
  });
});
