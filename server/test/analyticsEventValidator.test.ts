import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { analyticsEventSchema, MAX_PROPERTIES_BYTES } from "../src/validators/analyticsEvent.validator.js";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "cta_clicked",
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    ...overrides,
  };
}

describe("analyticsEventSchema", () => {
  test("accepts a minimal valid event", () => {
    const result = analyticsEventSchema.parse({ body: validBody() });
    assert.equal(result.body.name, "cta_clicked");
  });

  test("accepts optional properties, pagePath, pageUrl, referrer", () => {
    const result = analyticsEventSchema.parse({
      body: validBody({
        properties: { label: "hero", value: 1, active: true, note: null },
        pagePath: "/services",
        pageUrl: "https://secritou.tn/services",
        referrer: "https://google.com",
      }),
    });
    assert.deepEqual(result.body.properties, { label: "hero", value: 1, active: true, note: null });
  });

  test("rejects an event name with spaces or symbols", () => {
    assert.throws(() => analyticsEventSchema.parse({ body: validBody({ name: "cta clicked!" }) }));
  });

  test("rejects an event name over 100 characters", () => {
    assert.throws(() => analyticsEventSchema.parse({ body: validBody({ name: "a".repeat(101) }) }));
  });

  test("rejects an empty event name", () => {
    assert.throws(() => analyticsEventSchema.parse({ body: validBody({ name: "" }) }));
  });

  test("rejects a non-uuid sessionId", () => {
    assert.throws(() => analyticsEventSchema.parse({ body: validBody({ sessionId: "not-a-uuid" }) }));
  });

  test("rejects a missing sessionId", () => {
    const { sessionId, ...rest } = validBody();
    assert.throws(() => analyticsEventSchema.parse({ body: rest }));
  });

  test("rejects properties values that aren't string/number/boolean/null", () => {
    assert.throws(() =>
      analyticsEventSchema.parse({ body: validBody({ properties: { nested: { a: 1 } } }) })
    );
  });

  test("MAX_PROPERTIES_BYTES is 5KB, matching the spec's payload cap", () => {
    assert.equal(MAX_PROPERTIES_BYTES, 5 * 1024);
  });
});
