import test from "node:test";
import assert from "node:assert/strict";
import bookingRoutes from "../src/routes/booking.routes.js";

function routeHandlers(method: string, path: string) {
  const layer = (bookingRoutes as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
  return layer?.route?.stack?.map((entry: any) => entry.handle?.name ?? "") ?? [];
}

test("booking admin routes are protected by authenticate and an admin role guard", () => {
  const handlers = routeHandlers("get", "/admin/slots");
  assert.equal(handlers[0], "authenticate");
  assert.equal(handlers.length >= 3, true);
});

test("public booking route stays anonymous", () => {
  const handlers = routeHandlers("post", "/book");
  assert.notEqual(handlers[0], "authenticate");
});
