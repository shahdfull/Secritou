// Tests for freelancer/marketplace access control — pure logic, no DB.
// Mirrors the role gates in mission.service (create/update/delete + getMissionsForUser).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Role = "ADMIN" | "MANAGER" | "FREELANCER" | "CLIENT";

// Mirrors the write gate: only ADMIN/MANAGER may create/update/delete missions.
function canManageMissions(role: Role) {
  return ["ADMIN", "MANAGER"].includes(role);
}

// Mirrors getMissionsForUser routing.
function missionListMode(role: Role, hasCompany: boolean): "open" | "company" | "forbidden" {
  if (role === "FREELANCER") return "open";
  if ((role === "ADMIN" || role === "MANAGER") && hasCompany) return "company";
  return "forbidden";
}

describe("mission management gate (marketplace is internal)", () => {
  test("ADMIN and MANAGER may manage missions", () => {
    assert.equal(canManageMissions("ADMIN"), true);
    assert.equal(canManageMissions("MANAGER"), true);
  });

  test("CLIENT may NOT manage missions", () => {
    assert.equal(canManageMissions("CLIENT"), false);
  });

  test("FREELANCER may NOT manage missions", () => {
    assert.equal(canManageMissions("FREELANCER"), false);
  });
});

describe("mission listing by role", () => {
  test("FREELANCER lists open missions", () => {
    assert.equal(missionListMode("FREELANCER", false), "open");
  });

  test("ADMIN/MANAGER list company missions", () => {
    assert.equal(missionListMode("ADMIN", true), "company");
    assert.equal(missionListMode("MANAGER", true), "company");
  });

  test("CLIENT is forbidden from listing missions (no marketplace access)", () => {
    assert.equal(missionListMode("CLIENT", true), "forbidden");
  });
});
