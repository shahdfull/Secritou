import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { Role } from "@prisma/client";
import type { HttpError } from "../src/utils/httpError.js";
import type { JwtPayload } from "../src/types/auth.js";
import { authorize } from "../src/middlewares/rbac.middleware.js";

function makeUser(role: Role): JwtPayload {
  return { id: "test-user", sub: "test-user", tokenType: "access", email: "test@example.com", role, clientId: null, mustChangePassword: false };
}

function runMiddleware(middleware: ReturnType<typeof authorize>, req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    middleware(req as Request, {} as Response, (err?: unknown) => resolve(err));
  });
}

// SEC-044: /ai/chat (the endpoint this file originally covered) was removed as dead code — no
// client/src code ever called it. The only real AI endpoints left are /ai/conversations/*
// (aiConversation.routes.ts), which use the exact same authorize("ADMIN", "MANAGER") gate this
// test still exercises.
test.describe("AI Endpoints (/ai/conversations/*)", () => {
  test("authorize allows ADMIN and MANAGER for AI endpoints", async () => {
    const middleware = authorize("ADMIN", "MANAGER");

    let err = await runMiddleware(middleware, { user: makeUser("ADMIN") });
    assert.equal(err, undefined);

    err = await runMiddleware(middleware, { user: makeUser("MANAGER") });
    assert.equal(err, undefined);

    err = await runMiddleware(middleware, { user: makeUser("CLIENT") });
    assert.ok(err);
    assert.equal((err as HttpError).statusCode, 403);

    err = await runMiddleware(middleware, { user: makeUser("FREELANCER") });
    assert.ok(err);
    assert.equal((err as HttpError).statusCode, 403);
  });
});
