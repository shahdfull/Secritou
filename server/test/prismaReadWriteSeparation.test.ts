// Qualité de code, signalée par le porteur du projet (casquette ingénieur full-stack, session du
// 2026-07-18) : project.repository.ts and projectMeeting.repository.ts used prismaRead for
// reads, but task.repository.ts used prisma (primary) for findAll/findById/findByIdAdmin — a
// real inconsistency, wasted load on the primary on a high-traffic module (Kanban, lists).
// projectProgress.ts did the same (raw query on prisma instead of prismaRead), despite being
// called on every project list.
//
// Investigation found something more serious than reported: project.repository.ts imported
// prismaRead but ALIASED it `as prisma` and used that alias for EVERYTHING — including
// create/update/delete. If DATABASE_READ_URL is ever pointed at a real read-only replica, every
// write on Project would fail outright. Currently invisible because without DATABASE_READ_URL
// configured, prismaRead === prisma (same underlying client) — no observable symptom in this
// environment, which is exactly why this kind of bug hides until the day a replica is actually
// wired up.
//
// Fixed: project.repository.ts now imports both prisma and prismaRead properly, using prisma
// only for writes and for pre-write reads (findByIdAdmin, read immediately before write in the
// same caller) ; task.repository.ts's pure reads (findAll/findById/existsInCompany) moved to
// prismaRead, findByIdAdmin kept on prisma for the same pre-write reason ; projectProgress.ts's
// raw aggregate query moved to prismaRead.
//
// Since DATABASE_READ_URL is not configured in this environment, prismaRead and prisma are
// literally the same client — a behavioral test can't distinguish them here. This test instead
// verifies the fix structurally: every write method in project.repository.ts and
// task.repository.ts calls `prisma.<model>.<mutatingMethod>`, never `prismaRead.<model>
// .<mutatingMethod>`, by scanning the real source files — not a description of intent, a direct
// check of what the code actually calls.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MUTATING_METHODS = ["create", "update", "updateMany", "delete", "deleteMany", "upsert"];

function findPrismaReadMutations(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const offenders: string[] = [];
  for (const method of MUTATING_METHODS) {
    const re = new RegExp(`prismaRead\\.\\w+\\.${method}\\(`, "g");
    const matches = content.match(re);
    if (matches) offenders.push(...matches);
  }
  return offenders;
}

describe("prismaRead is never used for a write (project.repository.ts, task.repository.ts)", () => {
  test("project.repository.ts: no mutating call goes through prismaRead", () => {
    const offenders = findPrismaReadMutations(join(process.cwd(), "src/repositories/project.repository.ts"));
    assert.deepEqual(offenders, [], `found write(s) routed through prismaRead: ${offenders.join(", ")}`);
  });

  test("task.repository.ts: no mutating call goes through prismaRead", () => {
    const offenders = findPrismaReadMutations(join(process.cwd(), "src/repositories/task.repository.ts"));
    assert.deepEqual(offenders, [], `found write(s) routed through prismaRead: ${offenders.join(", ")}`);
  });

  test("project.repository.ts no longer aliases prismaRead as prisma (the root cause of the original bug)", () => {
    const content = readFileSync(join(process.cwd(), "src/repositories/project.repository.ts"), "utf-8");
    assert.ok(!/prismaRead as prisma/.test(content), "prismaRead must never be aliased as `prisma` — that alias previously routed every write through the read replica");
  });
});
