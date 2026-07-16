// Tests for userService.updateUser session-revocation trigger (RG-019).
// Pattern: same as invoice.service.test.ts — pure logic extracted from the
// real source, no DB, no service imports (userRepository/authRepository are
// module-level singletons in user.service.ts, not constructor-injectable).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Logic extracted verbatim from userService.updateUser ────────────────────
// Source: src/services/user.service.ts:163 —
//   if (role && role !== user.role) { await authRepository.revokeAllSessionsForUser(id); ... }

function shouldRevokeSessions(previousRole: string, newRole: string | undefined): boolean {
  return Boolean(newRole && newRole !== previousRole);
}

describe("userService.updateUser session revocation (RG-019)", () => {
  test("role change triggers revocation", () => {
    assert.equal(shouldRevokeSessions("MANAGER", "ADMIN"), true);
  });

  test("no role provided (e.g. name-only update) does not trigger revocation", () => {
    assert.equal(shouldRevokeSessions("MANAGER", undefined), false);
  });

  test("role provided but unchanged does not trigger revocation", () => {
    assert.equal(shouldRevokeSessions("MANAGER", "MANAGER"), false);
  });
});
