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
});
