// SEC-176: PUT /tasks/:id was mechanically given sensitiveWriteRateLimit (10/min) along with 19
// other route files, without accounting for the fact that this same route also serves the
// Kanban drag-and-drop status change (client/src/features/tasks/TasksKanban.tsx — one PUT per
// card moved, not batched). A real user actively reorganizing a busy board can plausibly exceed
// 10 drags/minute, which would 429 a legitimate action, not abuse. Fixed by moving this one
// route to a dedicated frequentInteractionRateLimit (60/min) — every other write route on this
// file keeps the original 10/min.
//
// This test hits the real HTTP stack (app.ts -> routes -> rate-limit middleware) and reads the
// real RateLimit-Limit response header — not a reimplementation of express-rate-limit's config.
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

const TEST_EMAIL = "sec176-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC176";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let adminUserId: string | undefined;
let clientId: string | undefined;
let projectId: string | undefined;
let taskId: string | undefined;
let accessToken: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-176 HTTP Test User", passwordHash, role: "ADMIN" },
    });
    adminUserId = user.id;

    const client = await prisma.client.create({ data: { name: "SEC-176 client" } });
    clientId = client.id;
    const project = await prisma.project.create({ data: { name: "SEC-176 project", clientId: client.id } });
    projectId = project.id;
    const task = await prisma.task.create({ data: { title: "SEC-176 task", projectId: project.id } });
    taskId = task.id;

    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessToken = loginRes.body.data.tokens.accessToken as string;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  if (taskId) await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
  if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("PUT /tasks/:id rate limit accommodates Kanban drag-and-drop (SEC-176)", () => {
  test("PUT /tasks/:id advertises a 60/min limit, not the 10/min sensitiveWriteRateLimit", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .put(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "SEC-176 task (updated)" });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.headers["ratelimit-limit"], "60", "PUT /tasks/:id must use frequentInteractionRateLimit (60/min), not sensitiveWriteRateLimit (10/min)");
  });

  test("POST /tasks/:id/comments (an unrelated write on the same file) still advertises the original 10/min limit", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "SEC-176 comment" });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.headers["ratelimit-limit"], "10", "other write routes on task.routes.ts must keep the original sensitiveWriteRateLimit (10/min) — only PUT /:id changed");
  });
});
