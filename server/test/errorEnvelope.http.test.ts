// SEC-145 / SEC-149 (ANOMALIES.yaml): the error envelope produced by error.middleware.ts must be
// uniform — { error: { code, message, ... }, message, ... } — across every branch, including the
// ZodError branch (SEC-145) and the 10 previously hand-written `res.status(4xx).json(...)` sites
// across auth/project/upload/siteContent/freelancerApplication controllers (SEC-149), all now
// replaced with `throw new HttpError(...)`. Exercised through the real HTTP stack (app.ts →
// routes → validators/controllers → error.middleware.ts), not a reimplementation of the
// middleware's branching — per CLAUDE.md, a test that mirrors the target instead of calling it
// proves nothing.
//
// SEC-180: the generic 404 fallback (app.ts, no route matched) used to bypass errorMiddleware
// entirely — `res.status(404).json({ message: "Route not found" })` with no `next()` call — the
// only HTTP exit point in the whole API carrying neither `error.code` nor `requestId`. Fixed by
// routing it through `next(new HttpError(404, ..., "ROUTE_NOT_FOUND"))` like every other error.
//
// Requires a real, migrated database (DATABASE_URL) — skipped automatically if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const TEST_EMAIL = "sec145149-http-test@example.com";
const TEST_PASSWORD = "TestPass123!SEC145";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let env: typeof import("../src/config/env.js").env;
let dbAvailable = true;
let testUserId: string | undefined;

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ env } = await import("../src/config/env.js"));
    await prisma.$queryRaw`SELECT 1`;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "SEC-145/149 HTTP Test User", passwordHash, role: "ADMIN" },
    });
    testUserId = user.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  if (testUserId) await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Uniform error envelope — real HTTP stack (SEC-145, SEC-149)", () => {
  // SEC-145: the ZodError branch of error.middleware.ts.
  test("a Zod validation failure (POST /auth/register with an invalid body) returns 422 with the standard error envelope", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short", name: "" });

    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "VALIDATION_ERROR", "the ZodError branch must set error.code, like every other branch");
    assert.ok(res.body.error?.message, "error.message must be present");
    assert.ok(res.body.error?.details, "error.details must carry the Zod flatten() output");
    assert.ok(res.body.issues, "issues is kept for backward compatibility");
    assert.ok(res.body.message, "top-level message is kept for backward compatibility");
  });

  // SEC-149: auth.controller.ts#refresh — previously `res.status(401).json({ message: ... })`.
  test("POST /auth/refresh with no refresh token returns 401 with error.code REFRESH_TOKEN_REQUIRED", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app).post("/api/v1/auth/refresh").send({});

    assert.equal(res.status, 401, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "REFRESH_TOKEN_REQUIRED");
    assert.ok(res.body.error?.message);
  });

  let accessToken: string;

  test("login as the test ADMIN user", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    accessToken = res.body.data.tokens.accessToken;
    assert.ok(accessToken);
  });

  // SEC-149: upload.controller.ts — previously `res.status(400).json({ error: "..." })` (a bare
  // string, not even the {code,message} shape). NOTE: an invalid `:context` and a missing `key`
  // are actually caught by validate(uploadContextParamSchema)/validate(deleteFileSchema) — Zod
  // middleware sitting in front of the controller (upload.routes.ts) — before the controller's
  // own INVALID_UPLOAD_CONTEXT/MISSING_UPLOAD_KEY branches can run. Running this test against the
  // real HTTP stack is what caught this: those two branches are dead code, reachable only if the
  // route were ever wired without its validate() guard. Asserting the real 422/VALIDATION_ERROR
  // here (not the controller's own codes) is the accurate description of current behavior — see
  // SEC-149's note in ANOMALIES.yaml for the full account.
  test("POST /api/v1/upload/:context with an invalid context returns 422 (caught by validate(uploadContextParamSchema), not the controller's own INVALID_UPLOAD_CONTEXT branch)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/upload/not-a-real-context")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("test"), "test.txt");

    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "VALIDATION_ERROR");
  });

  test("POST /api/v1/upload/document with no file attached returns 400 with error.code NO_FILE_PROVIDED", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .post("/api/v1/upload/document")
      .set("Authorization", `Bearer ${accessToken}`);

    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "NO_FILE_PROVIDED");
  });

  test("DELETE /api/v1/upload with no key in the body returns 422 (caught by validate(deleteFileSchema), not the controller's own MISSING_UPLOAD_KEY branch)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .delete("/api/v1/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "VALIDATION_ERROR");
  });

  test("DELETE /api/v1/upload with a path-traversal key returns 400 with error.code INVALID_UPLOAD_KEY (deleteFileSchema only checks presence/length, not path traversal — this branch IS reachable)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .delete("/api/v1/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ key: "../etc/passwd" });

    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "INVALID_UPLOAD_KEY");
  });

  // SEC-149: siteContent.controller.ts — previously `res.status(400).json({ error: "..." })`.
  // Same dead-code situation as above: validate(upsertSiteContentSchema) already requires
  // key/locale/value, so the controller's own MISSING_SITE_CONTENT_FIELDS branch is unreachable
  // through this route.
  test("PUT /api/v1/admin/site-content with missing fields returns 422 (caught by validate(upsertSiteContentSchema), not the controller's own MISSING_SITE_CONTENT_FIELDS branch)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app)
      .put("/api/v1/admin/site-content")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ key: "hero.title" }); // missing locale and value

    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "VALIDATION_ERROR");
  });

  // SEC-149: project.controller.ts#receiveAiSpecs — n8n webhook callback, previously
  // `res.status(400).json({ error: "..." })`. Gated by verifyN8nWebhook (HMAC), so the request
  // is signed with the same construction notifyN8n/verifyN8nSignature use (see
  // verifyN8nWebhook.test.ts for the same pattern) to actually reach the controller's own
  // validation, not just the middleware's 401.
  test("PATCH /api/v1/projects/:id/ai-specs with a validly-signed but empty payload returns 400 with error.code MISSING_AI_SPECS_PAYLOAD", async (t) => {
    if (!env.N8N_WEBHOOK_SECRET) {
      t.skip("N8N_WEBHOOK_SECRET not configured");
      return;
    }
    const body = { timestamp: Date.now() };
    const rawBody = JSON.stringify(body);
    const signature = createHmac("sha256", env.N8N_WEBHOOK_SECRET).update(rawBody).digest("hex");

    const res = await request(app)
      .patch("/api/v1/projects/00000000-0000-0000-0000-000000000000/ai-specs")
      .set("X-Secritou-Signature", signature)
      .set("Content-Type", "application/json")
      .send(rawBody);

    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "MISSING_AI_SPECS_PAYLOAD");
  });

  // SEC-180: a request to a route that matches no handler at all.
  test("GET /api/v1/this-route-does-not-exist returns 404 with the standard error envelope, not a bare { message }", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const res = await request(app).get("/api/v1/this-route-does-not-exist");

    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.equal(res.body.error?.code, "ROUTE_NOT_FOUND");
    assert.ok(res.body.error?.message, "error.message must be present");
    assert.ok(res.body.requestId, "requestId must be present, like every other error response");
  });
});
