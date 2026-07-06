// Tests for document access-level enforcement : pure logic, no DB.
// Mirrors visibleAccessLevels in document.repository.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { visibleAccessLevels } from "../src/repositories/document.repository.js";

describe("document access levels by role", () => {
  test("ADMIN sees every access level (incl. ADMIN_ONLY)", () => {
    const levels = visibleAccessLevels("ADMIN");
    assert.ok(levels.includes("ADMIN_ONLY"));
    assert.ok(levels.includes("ALL"));
  });

  test("MANAGER is treated as agency staff (sees ADMIN_ONLY)", () => {
    assert.ok(visibleAccessLevels("MANAGER").includes("ADMIN_ONLY"));
  });

  test("FREELANCER never sees ADMIN_ONLY or CLIENT_ADMIN", () => {
    const levels = visibleAccessLevels("FREELANCER");
    assert.ok(!levels.includes("ADMIN_ONLY"));
    assert.ok(!levels.includes("CLIENT_ADMIN"));
    assert.deepEqual(levels.sort(), ["ADMIN_FREELANCER", "ALL"]);
  });

  test("CLIENT never sees ADMIN_ONLY or ADMIN_FREELANCER", () => {
    const levels = visibleAccessLevels("CLIENT");
    assert.ok(!levels.includes("ADMIN_ONLY"));
    assert.ok(!levels.includes("ADMIN_FREELANCER"));
    assert.deepEqual(levels.sort(), ["ALL", "CLIENT_ADMIN"]);
  });
});
