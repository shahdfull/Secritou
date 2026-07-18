// SEC-047 (rapport backend/sécurité B3, décision produit rendue le 2026-07-19) : Task.priority
// était stocké et affiché mais n'entrait dans aucune logique serveur. TasksListView.tsx rendait
// pourtant déjà un en-tête de tri "priority" cliquable (non-freelancer) — mais le serveur ne
// listait pas "priority" dans SORTABLE_FIELDS, si bien qu'un clic retombait silencieusement sur
// createdAt. Décision (AskUserQuestion) : rendre "priority" triable (portée minimale, réparer
// l'interaction morte), sans changer le tri par défaut.
//
// This test imports and calls the real taskService.getAllTasks against a real database — not a
// reimplementation — and proves that orderBy=priority is now honoured: the Priority enum is
// declared LOW→NORMAL→HIGH→URGENT, so orderDir "desc" returns URGENT before LOW.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
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
  await prisma.task.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("task list sortable by priority — SEC-047", () => {
  test("orderBy=priority&orderDir=desc returns URGENT before LOW (enum order LOW→URGENT)", { skip: !dbAvailable }, async () => {
    const client = await prisma.client.create({ data: { name: "prio-sort client", serviceId: serviceA } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "prio-sort project", clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);
    await prisma.task.create({ data: { title: "low task", projectId: project.id, priority: "LOW" } });
    await prisma.task.create({ data: { title: "urgent task", projectId: project.id, priority: "URGENT" } });

    const result = await taskService.getAllTasks(project.id, "admin-id", "ADMIN", {
      page: 1,
      pageSize: 50,
      orderBy: "priority",
      orderDir: "desc",
    });

    const ourTasks = result.data.filter((t) => t.projectId === project.id);
    const urgentIndex = ourTasks.findIndex((t) => t.priority === "URGENT");
    const lowIndex = ourTasks.findIndex((t) => t.priority === "LOW");
    assert.ok(urgentIndex !== -1 && lowIndex !== -1, "both tasks should be returned");
    assert.ok(urgentIndex < lowIndex, "URGENT must sort before LOW under orderDir desc");
  });
});
