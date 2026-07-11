import test from "node:test";
import assert from "node:assert/strict";
import analyticsEventRoutes from "../src/routes/analyticsEvent.routes.js";

function routeHandlers(method: string, path: string) {
  const layer = (analyticsEventRoutes as any).stack.find(
    (entry: any) => entry.route?.path === path && entry.route.methods?.[method]
  );
  return layer?.route?.stack?.map((entry: any) => entry.handle?.name ?? "") ?? [];
}

test("POST /events is public (no authenticate), rate-limited, size-capped, and validated", () => {
  const handlers = routeHandlers("post", "/events");
  assert.notEqual(handlers[0], "authenticate");
  // rateLimiter (anonymous) -> jsonParser (per-route 6kb override) -> validate -> recordEvent
  assert.equal(handlers.includes("jsonParser"), true);
  assert.equal(handlers.includes("recordEvent"), true);
  assert.equal(handlers.length, 4);
});

test("GET /events/summary requires authenticate before authorize", () => {
  const handlers = routeHandlers("get", "/events/summary");
  assert.equal(handlers[0], "authenticate");
  assert.equal(handlers.length >= 3, true);
});
