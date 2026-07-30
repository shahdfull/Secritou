// SEC-033: getPersona used to silently fall back to Object.values(personas)[0] for an unknown
// id instead of signaling the failure — a future caller passing a user-controlled id would
// silently run the wrong persona rather than reject it. Now returns undefined, and the only
// caller (agentOrchestrator.service.ts) is expected to reject with a 404.
//
// This test calls the real getPersona (not a reimplementation).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getPersona, personas } from "../src/agents/personas.js";

describe("getPersona (SEC-033)", () => {
  test("returns undefined for an unknown persona id instead of falling back to the first persona", () => {
    const result = getPersona("not-a-real-persona-id");
    assert.equal(result, undefined);
  });

  test("returns the matching persona for a known id", () => {
    const result = getPersona("brief-generator");
    assert.equal(result, personas["brief-generator"]);
  });
});
