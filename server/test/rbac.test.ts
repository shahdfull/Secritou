import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/middlewares/rbac.middleware.js";

function runMiddleware(middleware: ReturnType<typeof authorize>, req: any) {
  return new Promise<unknown>((resolve) => {
    middleware(req, {} as any, (err?: unknown) => resolve(err));
  });
}

test("authorize allows matching role", async () => {
  const middleware = authorize("ADMIN", "MANAGER");
  const req = { user: { role: "ADMIN" } };
  const err = await runMiddleware(middleware, req);
  assert.equal(err, undefined);
});

test("authorize blocks disallowed role", async () => {
  const middleware = authorize("ADMIN");
  const req = { user: { role: "CLIENT" } };
  const err = await runMiddleware(middleware, req);
  assert.equal((err as any)?.statusCode, 403);
});
