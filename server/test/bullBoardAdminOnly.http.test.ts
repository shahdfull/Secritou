// SEC-032: @bull-board/api and @bull-board/express were declared in package.json but never
// mounted anywhere. Decision of the project owner (AskUserQuestion, 2026-07-30): mount a real
// dashboard rather than remove the dependency, gated ADMIN-only through the same auth stack
// (authenticate + authorize) as every other authenticated route.
//
// This test exercises the real HTTP stack (app.ts -> authenticate -> authorize -> bullBoardRouter)
// against a real database, not a reimplementation of the auth check.
//
// Requires a real, migrated database (DATABASE_URL) — skipped automatically if unreachable.

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

const ADMIN_EMAIL = "sec032-admin@example.com";
const MANAGER_EMAIL = "sec032-manager@example.com";
const PASSWORD = "TestPass123!SEC032";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: { email: ADMIN_EMAIL, name: "SEC-032 Admin", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(admin.id);
    const manager = await prisma.user.create({
      data: { email: MANAGER_EMAIL, name: "SEC-032 Manager", passwordHash, role: "MANAGER" },
    });
    createdUserIds.push(manager.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("BullBoard dashboard is ADMIN-only (SEC-032)", () => {
  test("no token is rejected with 401", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app).get("/api/v1/admin/queues/");
    assert.equal(res.status, 401);
  });

  test("a MANAGER token is rejected with 403", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const login = await request(app).post("/api/v1/auth/login").send({ email: MANAGER_EMAIL, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const res = await request(app)
      .get("/api/v1/admin/queues/")
      .set("Authorization", `Bearer ${login.body.data.tokens.accessToken}`);
    assert.equal(res.status, 403);
  });

  test("an ADMIN token is granted access", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const login = await request(app).post("/api/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const res = await request(app)
      .get("/api/v1/admin/queues/")
      .set("Authorization", `Bearer ${login.body.data.tokens.accessToken}`);
    assert.equal(res.status, 200);
  });
});
