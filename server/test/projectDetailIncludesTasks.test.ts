// Bug fonctionnel majeur, signalé par le porteur du projet (session du 2026-07-18) : le détail
// d'un projet n'affichait jamais ses tâches.
//
// projectListSelect (project.repository.ts) — partagé par findAll et findById — ne sélectionnait
// jamais la relation `tasks`. GET /projects/:id (projectService.getProjectById →
// projectRepository.findById) ne renvoyait donc jamais project.tasks, alors que le type client
// (Project['tasks']) et ProjectDetailPage.tsx (const tasks = project.tasks ?? []) partaient tous
// deux du principe que ce champ existait. Conséquences concrètes côté UI : l'onglet "Tâches" du
// détail projet était toujours vide, le compteur par statut et le lien "Voir toutes les tâches
// (n)" ne s'affichaient jamais, et le bandeau "Partir du template" s'affichait à tort en
// permanence (tasks.length === 0 toujours vrai) — alors que le % de progression, calculé
// indépendamment via une requête SQL séparée (getProgressForProject), restait correct, rendant
// l'incohérence visible (barre à 60%, liste de tâches vide).
//
// Root cause note: `tasks` n'a été ajouté qu'au `baseSelect` de `findById` (projet unique), PAS à
// `projectListSelect` lui-même (partagé avec `findAll`, la liste paginée de projets) — y ajouter
// tasks aurait tiré toutes les tâches de tous les projets listés, une vraie régression de
// performance sur un endpoint de liste.
//
// This test imports and calls the real projectService.getProjectById against a real database —
// not a reimplementation — and confirms the returned project actually includes its tasks.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let dbAvailable = true;

let serviceId: string;
let adminId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) throw new Error("no Admin seeded");
    adminId = admin.id;
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
describe("projectService.getProjectById includes the project's tasks", () => {
  test("a project with 3 tasks returns all 3 in .tasks, with id/title/status populated", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "tasks-in-detail client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "tasks-in-detail project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);

    const task1 = await prisma.task.create({ data: { title: "Task A", status: "TODO", projectId: project.id } });
    const task2 = await prisma.task.create({ data: { title: "Task B", status: "IN_PROGRESS", projectId: project.id } });
    const task3 = await prisma.task.create({ data: { title: "Task C", status: "DONE", projectId: project.id } });
    createdTaskIds.push(task1.id, task2.id, task3.id);

    const result = await projectService.getProjectById(project.id, adminId, "ADMIN");

    assert.ok(Array.isArray(result.tasks), "the returned project must include a tasks array");
    assert.equal(result.tasks!.length, 3, "all 3 tasks must be returned, not an empty array");
    const titles = result.tasks!.map((t) => t.title).sort();
    assert.deepEqual(titles, ["Task A", "Task B", "Task C"]);
    const statuses = result.tasks!.map((t) => t.status).sort();
    assert.deepEqual(statuses, ["DONE", "IN_PROGRESS", "TODO"]);
  });

  test("a project with no tasks returns an empty tasks array, not undefined", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "no-tasks client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "no-tasks project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);

    const result = await projectService.getProjectById(project.id, adminId, "ADMIN");

    assert.ok(Array.isArray(result.tasks), "tasks must be an empty array, not undefined, for a project with no tasks");
    assert.equal(result.tasks!.length, 0);
  });
});
