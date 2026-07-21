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

describe("Task.completedAt backfill (SEC-173)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("no Task with status DONE has completedAt IS NULL", async () => {
    const stillAffected = await prisma.task.findMany({
      where: { status: "DONE", completedAt: null },
      select: { id: true, title: true },
    });
    assert.deepEqual(stillAffected, [], `DONE tasks still missing completedAt: ${JSON.stringify(stillAffected)}`);
  });

  test("a NEW transition to DONE via the real taskService still sets completedAt (forward path unaffected)", async () => {
    const client = await prisma.client.create({ data: { name: `sec173-client-${Date.now()}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `sec173-project-${Date.now()}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({ data: { title: "SEC-173 task", projectId: project.id, status: "TODO" } });
    createdTaskIds.push(task.id);

    await taskService.updateTask(task.id, { status: "DONE" }, { userRole: "ADMIN" });

    const updated = await prisma.task.findUnique({ where: { id: task.id } });
    assert.ok(updated!.completedAt, "completedAt must be set after transitioning to DONE");
  });
});
