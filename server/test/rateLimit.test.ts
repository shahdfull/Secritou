import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { rateLimitKeyGenerator } from "../src/middlewares/rateLimit.middleware.js";

test("rate limit key combines ip and user", () => {
  const key = rateLimitKeyGenerator({
    ip: "10.0.0.1",
    user: { sub: "user-123" },
  } as Partial<Request> as Request);

  assert.equal(key, "10.0.0.1:user-123");
});

test("rate limit key falls back to anonymous", () => {
  const key = rateLimitKeyGenerator({ ip: undefined, user: undefined } as Partial<Request> as Request);
  assert.equal(key, "unknown:anonymous");
});
