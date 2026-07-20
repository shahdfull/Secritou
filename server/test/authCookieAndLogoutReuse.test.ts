// SEC-129: authCookies.ts sets httpOnly/secure/sameSite correctly in code (verified by reading
// the file), but no HTTP test ever inspected a real Set-Cookie header, and no test exercised the
// full login -> logout -> reuse-the-old-refresh-cookie flow end-to-end — auth.service.test.ts
// only proves the service rejects an already-consumed token via a direct mock DB write, never a
// real cookie round-tripped through the controller.
//
// This test exercises the real HTTP stack (app.ts → routes → controller → authCookies.ts) via
// supertest — proving the Set-Cookie attributes on login, and that the refresh cookie issued at
// login is rejected after logout.
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

const TEST_PASSWORD = "TestPass123!SEC129";

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

function extractCookie(setCookieHeader: string[] | undefined, name: string): string | undefined {
  return setCookieHeader?.find((c) => c.startsWith(`${name}=`));
}

describe("Auth cookie attributes + logout/reuse — real HTTP stack (SEC-129)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("login sets the refresh cookie as HttpOnly and SameSite=Strict", async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: `sec129-cookie-${Date.now()}@example.com`, name: "SEC-129 cookie", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    const res = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    const refreshCookie = extractCookie(setCookie, "secritou_refresh");
    assert.ok(refreshCookie, "login must set the refresh cookie");
    assert.match(refreshCookie!, /HttpOnly/i, "the refresh cookie must be HttpOnly");
    assert.match(refreshCookie!, /SameSite=Strict/i, "the refresh cookie must be SameSite=Strict");
  });

  test("the refresh cookie issued at login is rejected after logout", async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: `sec129-reuse-${Date.now()}@example.com`, name: "SEC-129 reuse", passwordHash, role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    assert.equal(loginRes.status, 200, JSON.stringify(loginRes.body));
    const setCookie = loginRes.headers["set-cookie"] as unknown as string[] | undefined;
    const refreshCookieHeader = extractCookie(setCookie, "secritou_refresh");
    assert.ok(refreshCookieHeader);
    // supertest's agent-less `request(app)` doesn't auto-persist cookies across calls — extract
    // the raw name=value pair to resend manually on the follow-up requests below.
    const refreshCookiePair = refreshCookieHeader!.split(";")[0]!;
    const accessToken = loginRes.body.data.tokens.accessToken as string;

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookiePair)
      .send({});
    assert.equal(logoutRes.status, 204, JSON.stringify(logoutRes.body));

    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookiePair)
      .send({});
    assert.equal(reuseRes.status, 401, "reusing the refresh cookie after logout must be rejected");
  });
});
