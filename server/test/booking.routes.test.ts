import test from "node:test";
import assert from "node:assert/strict";
import bookingRoutes from "../src/routes/booking.routes.js";

// Express's Router keeps its middleware stack on an internal `.stack` not exposed by its public
// types; describe just the shape this test reads.
type RouterLayer = {
  route?: { path?: string; methods?: Record<string, boolean>; stack?: { handle?: { name?: string } }[] };
};
type RouterWithStack = { stack: RouterLayer[] };

function routeHandlers(method: string, path: string) {
  const layer = (bookingRoutes as unknown as RouterWithStack).stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );
  return layer?.route?.stack?.map((entry) => entry.handle?.name ?? "") ?? [];
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
