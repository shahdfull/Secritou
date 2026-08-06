// SEC-086: looksLikePlainText (upload.service.ts) — the only check applied to declared types
// with no reliable magic-byte signature (NO_MAGIC_BYTES_MIME, text/plain) — only screened out
// binary bytes (null, control chars). Any printable HTML/JS content declared text/plain passed
// trivially: reproduced against a real server, an HTML file with a <script> tag declared
// Content-Type: text/plain was accepted (201), stored and re-served as-is by MinIO. Severity was
// already limited by 2 mitigations (re-served with the real text/plain Content-Type, not
// text/html; the frontend forces a.download/target=_blank rather than inline rendering) — this
// closes the gap itself rather than relying only on those downstream mitigations.
//
// Exercised through the real HTTP stack (app.ts -> routes -> upload.controller.ts ->
// upload.service.ts), not a reimplementation of looksLikeHtmlOrScript's pattern — per CLAUDE.md,
// a test that mirrors the target instead of calling it proves nothing.
//
// Requires a real, migrated database and a reachable S3-compatible endpoint (MinIO); skipped if
// unreachable.

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

const TEST_EMAIL = "sec086-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC086";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let testUserId: string | undefined;
let accessToken: string | undefined;
const uploadedKeys: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-086 HTTP Test User", passwordHash, role: "ADMIN" },
    });
    testUserId = user.id;

    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessToken = loginRes.body.data.tokens.accessToken as string;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  for (const key of uploadedKeys) {
    await request(app).delete("/api/v1/upload").set("Authorization", `Bearer ${accessToken}`).send({ key }).catch(() => {});
  }
  if (testUserId) await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("POST /upload/document: text/plain content is screened for HTML/script, not just binary bytes (SEC-086)", () => {
  test("an HTML file with a <script> tag declared text/plain is rejected 415, not stored", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/upload/document")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("<html><body><script>alert('stored XSS via upload')</script></body></html>"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 415, JSON.stringify(res.body));
  });

  test("an inline event handler (onerror=) declared text/plain is rejected 415, not stored", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/upload/document")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("<img src=x onerror=alert(document.cookie)>"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 415, JSON.stringify(res.body));
  });

  test("genuine plain text content declared text/plain is still accepted (no regression)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/upload/document")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("Meeting notes: discussed the Q3 roadmap and next steps."), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    if (res.body.data?.key) uploadedKeys.push(res.body.data.key);
  });
});
