import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { contactRequestSchema } from "../src/validators/contact.validator.js";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    serviceType: "Other",
    company: "Acme",
    message: "This is a long enough message for validation purposes.",
    ...overrides,
  };
}

describe("contactRequestSchema budget field (regression, previously blocked submission)", () => {
  test("an empty string budget (client <select> placeholder) is normalized to undefined", () => {
    const result = contactRequestSchema.parse({ body: validBody({ budget: "" }) });
    assert.equal(result.body.budget, undefined);
  });

  test("an omitted budget stays undefined", () => {
    const result = contactRequestSchema.parse({ body: validBody() });
    assert.equal(result.body.budget, undefined);
  });

  test("a real budget option is preserved as-is", () => {
    const result = contactRequestSchema.parse({ body: validBody({ budget: "< 1 000 DT" }) });
    assert.equal(result.body.budget, "< 1 000 DT");
  });

  test("an invalid budget string is still rejected", () => {
    assert.throws(() => contactRequestSchema.parse({ body: validBody({ budget: "not-a-real-option" }) }));
  });
});
