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

test("authorize allows matching role", async () => {
  const middleware = authorize("ADMIN", "MANAGER");
  const req = { user: makeUser("ADMIN") };
  const err = await runMiddleware(middleware, req);
  assert.equal(err, undefined);
});

test("authorize blocks disallowed role", async () => {
  const middleware = authorize("ADMIN");
  const req = { user: makeUser("CLIENT") };
  const err = await runMiddleware(middleware, req);
  assert.equal((err as HttpError | undefined)?.statusCode, 403);
});
