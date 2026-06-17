import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitKeyGenerator } from "../src/middlewares/rateLimit.middleware.js";

test("rate limit key combines ip and user", () => {
  const key = rateLimitKeyGenerator({
    ip: "10.0.0.1",
    user: { sub: "user-123" },
  } as any);

  assert.equal(key, "10.0.0.1:user-123");
});

test("rate limit key falls back to anonymous", () => {
  const key = rateLimitKeyGenerator({ ip: undefined, user: undefined } as any);
  assert.equal(key, "unknown:anonymous");
});
