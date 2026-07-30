// SEC-034: generateBriefSchema/generateTasksSchema used to accept context: z.record(z.any())
// with no size bound, letting a single call inflate the prompt forwarded to Ollama with only
// aiRateLimit (call frequency, not payload size) as protection.
//
// This test calls the real generateBriefSchema/generateTasksSchema (not a reimplementation).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { generateBriefSchema, generateTasksSchema } from "../src/validators/ai.validator.js";

describe("generateBriefSchema/generateTasksSchema context size bound (SEC-034)", () => {
  test("accepts a small context", () => {
    const result = generateBriefSchema.safeParse({ body: { context: { projectName: "Site vitrine" } } });
    assert.equal(result.success, true);
  });

  test("rejects an oversized context on generateBriefSchema", () => {
    const oversized = { blob: "x".repeat(21000) };
    const result = generateBriefSchema.safeParse({ body: { context: oversized } });
    assert.equal(result.success, false);
  });

  test("rejects an oversized context on generateTasksSchema", () => {
    const oversized = { blob: "x".repeat(21000) };
    const result = generateTasksSchema.safeParse({ body: { context: oversized } });
    assert.equal(result.success, false);
  });
});
