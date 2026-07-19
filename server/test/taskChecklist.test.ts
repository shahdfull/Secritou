// SEC-060 (sous-tâches, item 4 du constat P1 rapport Product Owner) : aucune sous-tâche/checklist
// n'existait sur une tâche — confirmé par lecture directe du schéma (model Task n'avait ni
// parentId ni relation vers des Task[] enfants). Décision du porteur (session 2026-07-19) : une
// checklist plate (titre + fait/pas fait), un seul niveau, aucun assignee/statut/échéance propre,
// aucune règle de complétion automatique du parent.
//
// This test imports and calls the real taskChecklistService against a real database — not a
// reimplementation — proving:
// 1. Items are created appended at the end (position derived server-side from the current count,
//    never trusted from the client).
// 2. An item can be toggled done/undone and its title edited.
// 3. Deleting an item removes only that item, leaving the others untouched.
// 4. Updating/deleting an item that doesn't belong to the given taskId 404s — the same
//    cross-task isolation already established for comments (SEC-059) and meetings (SEC-055/F6).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskChecklistService: typeof import("../src/services/taskChecklist.service.js").taskChecklistService;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdItemIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskChecklistService } = await import("../src/services/taskChecklist.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 1 });
    if (services.length < 1) throw new Error("need at least 1 seeded Service row");
    serviceA = services[0]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.taskChecklistItem.deleteMany({ where: { id: { in: createdItemIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeTask() {
  const client = await prisma.client.create({ data: { name: "checklist client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "checklist project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: "checklist task", projectId: project.id } });
  createdTaskIds.push(task.id);
  return task;
}

describe("taskChecklistService — SEC-060", () => {
  test("items are created appended at the end, position derived server-side", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();

    const first = await taskChecklistService.createItem(task.id, "Première étape");
    const second = await taskChecklistService.createItem(task.id, "Deuxième étape");
    createdItemIds.push(first.id, second.id);

    assert.equal(first.position, 0);
    assert.equal(second.position, 1);
    assert.equal(first.done, false);
  });

  test("an item can be toggled done and have its title edited", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const item = await taskChecklistService.createItem(task.id, "À corriger");
    createdItemIds.push(item.id);

    const marked = await taskChecklistService.updateItem(task.id, item.id, { done: true });
    assert.equal(marked.done, true);

    const renamed = await taskChecklistService.updateItem(task.id, item.id, { title: "Corrigé" });
    assert.equal(renamed.title, "Corrigé");
    assert.equal(renamed.done, true, "editing the title must not silently reset done");
  });

  test("deleting an item removes only that item, leaving the others untouched", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const itemA = await taskChecklistService.createItem(task.id, "Garder");
    const itemB = await taskChecklistService.createItem(task.id, "Supprimer");
    createdItemIds.push(itemA.id, itemB.id);

    await taskChecklistService.deleteItem(task.id, itemB.id);

    const remaining = await taskChecklistService.getByTaskId(task.id);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.id, itemA.id);
  });

  test("updating/deleting an item that doesn't belong to the given taskId 404s (cross-task isolation)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const otherTask = await makeTask();
    const item = await taskChecklistService.createItem(task.id, "Isolée");
    createdItemIds.push(item.id);

    await assert.rejects(
      () => taskChecklistService.updateItem(otherTask.id, item.id, { done: true }),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    await assert.rejects(
      () => taskChecklistService.deleteItem(otherTask.id, item.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    const stillThere = await prisma.taskChecklistItem.findUnique({ where: { id: item.id } });
    assert.ok(stillThere, "the item must not have been affected by the cross-task calls");
  });

  test("SEC-074: several strictly concurrent creates on the same task never collide on position", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();

    const created = await Promise.all(
      Array.from({ length: 5 }, (_, i) => taskChecklistService.createItem(task.id, `Item ${i}`))
    );
    created.forEach((item) => createdItemIds.push(item.id));

    const positions = created.map((item) => item.position).sort((a, b) => a - b);
    assert.deepEqual(
      positions,
      [0, 1, 2, 3, 4],
      "five concurrent creates must land on five distinct, contiguous positions — never a collision"
    );
  });

  test("SEC-075: creating beyond the per-task cap is rejected 422 CHECKLIST_LIMIT_REACHED", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();

    // Seed directly at the cap rather than looping 100 real creates (slow, and not the point of
    // this test — it verifies the cap check, not that 100 individual creates succeed).
    await prisma.taskChecklistItem.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({ taskId: task.id, title: `Seed ${i}`, position: i })),
    });
    const seeded = await prisma.taskChecklistItem.findMany({ where: { taskId: task.id }, select: { id: true } });
    createdItemIds.push(...seeded.map((s) => s.id));

    await assert.rejects(
      () => taskChecklistService.createItem(task.id, "Item 101"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "CHECKLIST_LIMIT_REACHED");
        return true;
      }
    );

    const finalCount = await prisma.taskChecklistItem.count({ where: { taskId: task.id } });
    assert.equal(finalCount, 100, "the rejected create must not have been inserted");
  });

  test("SEC-077: several strictly concurrent creates near the cap never push the total past it", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();

    // Seed at 97 — 5 concurrent creates racing for the last 3 available slots. Before SEC-077, the
    // cap check (a separate count before the transaction) could let several of these through at
    // once, since each read the same pre-transaction count. After SEC-077, the cap check runs
    // inside the very same transaction that computes the insert position.
    await prisma.taskChecklistItem.createMany({
      data: Array.from({ length: 97 }, (_, i) => ({ taskId: task.id, title: `Seed ${i}`, position: i })),
    });
    const seeded = await prisma.taskChecklistItem.findMany({ where: { taskId: task.id }, select: { id: true } });
    createdItemIds.push(...seeded.map((s) => s.id));

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => taskChecklistService.createItem(task.id, `Racer ${i}`))
    );
    results.forEach((r) => {
      if (r.status === "fulfilled") createdItemIds.push(r.value.id);
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 3, "exactly the 3 remaining slots (97→100) must succeed");
    assert.equal(rejected.length, 2, "the other 2 concurrent creates must be rejected, not silently exceed the cap");
    rejected.forEach((r) => {
      assert.ok(
        r.status === "rejected" && r.reason instanceof HttpError && r.reason.code === "CHECKLIST_LIMIT_REACHED",
        "a losing create must be rejected specifically for the cap, not an unrelated error"
      );
    });

    const finalCount = await prisma.taskChecklistItem.count({ where: { taskId: task.id } });
    assert.equal(finalCount, 100, "the cap must never be exceeded even under concurrent creates near the limit");
  });
});
