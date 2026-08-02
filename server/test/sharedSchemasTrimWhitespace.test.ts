// SEC-089: at least 14 free-text fields across shared/src/schemas/*.ts validated via
// z.string().min(1) without .trim() — a string made only of whitespace passed length
// validation. Imports the real shared schemas (not a copy) so this fails if the fix ever
// regresses.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { clientBaseSchema, leadBaseSchema, projectBaseSchema, userBaseSchema } from "@secritou/shared";

describe("shared schemas reject whitespace-only free-text fields (SEC-089)", () => {
  test("clientBaseSchema.name rejects a whitespace-only string", () => {
    const result = clientBaseSchema.safeParse({ name: "   " });
    assert.equal(result.success, false, "whitespace-only name must be rejected");
  });

  test("clientBaseSchema.name still accepts a real name with surrounding whitespace, trimmed", () => {
    const result = clientBaseSchema.safeParse({ name: "  Acme Corp  " });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.name, "Acme Corp");
  });

  test("leadBaseSchema.name rejects a whitespace-only string", () => {
    const result = leadBaseSchema.safeParse({ name: "\t\n  " });
    assert.equal(result.success, false, "whitespace-only name must be rejected");
  });

  test("projectBaseSchema.name rejects a whitespace-only string", () => {
    const result = projectBaseSchema.safeParse({ name: "    " });
    assert.equal(result.success, false, "whitespace-only name must be rejected");
  });

  test("userBaseSchema.name rejects a whitespace-only string", () => {
    const result = userBaseSchema.safeParse({
      name: "   ",
      email: "user@example.com",
      role: "ADMIN",
    });
    assert.equal(result.success, false, "whitespace-only name must be rejected");
  });
});
