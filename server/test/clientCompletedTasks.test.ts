// SEC-061 (rapport Product Owner, §7 constat P3, session 2026-07-19) : le CLIENT ne voyait son
// projet qu'à travers la timeline synthétique en 7 étapes et le brief — jamais le détail des
// tâches. Décision du porteur : vue simplifiée listant les tâches DONE uniquement (titre + date).
//
// This test imports and calls the real projectService.getCompletedTasksForClient against a real
// database — not a reimplementation — proving:
// 1. Only DONE tasks are returned, ordered most-recently-completed first.
// 2. The critical security property: a CLIENT cannot read another client's project — 404, not an
//    empty list (which would leak the project's existence).
// 3. (SEC-070) completedAt is set by taskService.updateTask exactly on the DONE transition, and a
//    later unrelated edit to the same DONE task never changes it — unlike the previous behavior
//    (derived from updatedAt), which would have silently moved the client-visible date forward.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

// SEC-131: Task.updatedAt is a Prisma @updatedAt column — it can't be forced to an explicit
// value via a normal create/update call, so the only way to guarantee the NEXT write lands on a
// strictly later timestamp is to actually wait until the wall clock has moved past `after` before
// issuing it — not guess a fixed delay long enough to outrun clock/timestamp resolution on a
// loaded CI runner. Bounded so a genuinely stalled clock still fails loudly instead of hanging.
async function waitUntilClockPasses(after: Date, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= after.getTime()) {
    if (Date.now() > deadline) throw new Error(`Wall clock never advanced past ${after.toISOString()} within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
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

describe("projectService.getCompletedTasksForClient — SEC-061", () => {
  test("returns only DONE tasks, ordered most-recently-completed first", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const client = await prisma.client.create({ data: { name: "sec061 client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec061 project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);

    const older = await prisma.task.create({ data: { title: "Ancienne tâche terminée", projectId: project.id, status: "DONE" } });
    // Ensure a distinct, later updatedAt for ordering — wait for the clock, not a guessed delay.
    await waitUntilClockPasses(older.updatedAt);
    const newer = await prisma.task.create({ data: { title: "Tâche récemment terminée", projectId: project.id, status: "DONE" } });
    const inProgress = await prisma.task.create({ data: { title: "En cours", projectId: project.id, status: "IN_PROGRESS" } });
    createdTaskIds.push(older.id, newer.id, inProgress.id);

    const result = await projectService.getCompletedTasksForClient(project.id, client.id);

    const ids = result.map((t) => t.id);
    assert.ok(ids.includes(older.id));
    assert.ok(ids.includes(newer.id));
    assert.ok(!ids.includes(inProgress.id), "an IN_PROGRESS task must never appear in the completed list");
    assert.ok(result[0]?.completedAt, "each returned task must carry a completion date");
  });

  test("SEC-070: completedAt is set on the DONE transition and survives a later unrelated edit", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const client = await prisma.client.create({ data: { name: "sec070 client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec070 project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({ data: { title: "À terminer", projectId: project.id, status: "REVIEW" } });
    createdTaskIds.push(task.id);

    const doneTask = await taskService.updateTask(task.id, { status: "DONE" }, { userRole: "ADMIN" });
    const afterCompletion = await projectService.getCompletedTasksForClient(project.id, client.id);
    const completedAtAfterDone = afterCompletion.find((x) => x.id === task.id)?.completedAt;
    assert.ok(completedAtAfterDone, "completedAt must be set once the task reaches DONE");

    // Ensure the unrelated edit below lands on a strictly later updatedAt — wait for the clock, not a guessed delay.
    await waitUntilClockPasses(doneTask.updatedAt);
    await taskService.updateTask(task.id, { title: "Titre corrigé après coup" }, { userRole: "ADMIN" });
    const afterUnrelatedEdit = await projectService.getCompletedTasksForClient(project.id, client.id);
    const completedAtAfterEdit = afterUnrelatedEdit.find((x) => x.id === task.id)?.completedAt;

    assert.equal(
      completedAtAfterEdit,
      completedAtAfterDone,
      "editing an unrelated field on an already-DONE task must never move the client-visible completion date"
    );
  });

  test("a CLIENT cannot read another client's project — 404, not an empty list (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const ownerClient = await prisma.client.create({ data: { name: "sec061 owner client", serviceId } });
    const otherClient = await prisma.client.create({ data: { name: "sec061 other client", serviceId } });
    createdClientIds.push(ownerClient.id, otherClient.id);
    const project = await prisma.project.create({ data: { name: "sec061 owned project", clientId: ownerClient.id, serviceId } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({ data: { title: "Confidentiel", projectId: project.id, status: "DONE" } });
    createdTaskIds.push(task.id);

    await assert.rejects(
      () => projectService.getCompletedTasksForClient(project.id, otherClient.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});
