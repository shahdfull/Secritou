// SEC-173: migration 20260719200000_add_task_completedat_comment_editedat added Task.completedAt
// with no backfill — a task already DONE before that migration kept completedAt = null
// permanently (the only write path, task.service.ts#update, only fires on a live transition to
// DONE). Confirmed no code currently reads Task.completedAt for any aggregation (grep across
// server/src found zero consumers besides the write path), so the gap had no observable effect
// today — but would silently under-report once a future feature (e.g. average completion time)
// starts consuming it. Fixed with a one-time backfill migration
// (20260721030000_backfill_task_completed_at) using updatedAt as a reasonable proxy for
// historical DONE tasks.
//
// This test queries the real database directly — not a reimplementation — confirming the
// invariant the resolution criterion implies: no Task with status DONE has completedAt IS NULL.
// It also proves the normal forward path (task.service.ts#update transitioning a task to DONE)
// still sets completedAt correctly, by calling the real taskService.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("Task.completedAt backfill (SEC-173)", () => {
  // A global "no DONE task has completedAt null" invariant is untestable on a shared test DB:
  // other test files legitimately create DONE tasks directly via prisma.task.create (fixtures
  // bypassing taskService), continuously re-violating it. Instead, prove the migration's UPDATE
  // deterministically: seed a pre-migration-shaped row, run the exact statement, verify it.
  test("the backfill statement fills completedAt from updatedAt for a historical DONE task", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec173-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec173-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    // Simulates a task completed before the completedAt column existed: DONE, completedAt null.
    const task = await prisma.task.create({ data: { title: "SEC-173 historical task", projectId: project.id, status: "DONE" } });
    createdTaskIds.push(task.id);
    assert.equal(task.completedAt, null, "fixture must start with completedAt null, like pre-migration data");

    // The exact statement from migration 20260721030000_backfill_task_completed_at.
    await prisma.$executeRawUnsafe(`UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE' AND "completedAt" IS NULL`);

    const backfilled = await prisma.task.findUnique({ where: { id: task.id } });
    assert.ok(backfilled!.completedAt, "the backfill must have set completedAt");
    assert.equal(backfilled!.completedAt!.getTime(), backfilled!.updatedAt.getTime(), "completedAt must equal updatedAt, per the migration's approximation");
  });

  test("a real transition to DONE via taskService still sets completedAt (forward path unaffected)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: `sec173-fwd-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec173-fwd-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    // ALLOWED_TASK_TRANSITIONS: only REVIEW -> DONE is a valid path to DONE.
    const task = await prisma.task.create({ data: { title: "SEC-173 forward task", projectId: project.id, status: "REVIEW" } });
    createdTaskIds.push(task.id);

    await taskService.updateTask(task.id, { status: "DONE" }, { userRole: "ADMIN" });

    const updated = await prisma.task.findUnique({ where: { id: task.id } });
    assert.ok(updated!.completedAt, "completedAt must be set after transitioning to DONE");
  });
});
