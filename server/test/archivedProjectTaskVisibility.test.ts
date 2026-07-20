// SEC-041 follow-up (§2.1/§2.2 du rapport de suivi, session 2026-07-19) : SEC-040 a exposé un
// bouton "Archiver" réel dans l'UI, rendant atteignable un chemin (archivedAt sur un Project)
// qui n'avait jamais été exercé jusque-là. Deux angles morts, jusqu'ici purement théoriques,
// sont devenus réels :
//
// 1. task.repository.ts#buildWhere/findById/existsInCompany filtraient project.deletedAt: null
//    mais jamais project.archivedAt — les tâches d'un projet archivé restaient visibles/
//    listées dans /app/tasks pour ADMIN/MANAGER/FREELANCER, alors que le service d'écriture
//    (assertProjectIsOpenForTaskChanges) rejette déjà toute modification avec 409
//    PROJECT_ARCHIVED. Une carte Kanban pouvait donc être vue et glissée pour un rejet serveur
//    invisible à l'écran.
// 2. project.repository.ts#findById (GET /projects/:id) ne filtre ni archivedAt ni deletedAt
//    pour aucun rôle (contrairement à findByIdAdmin, utilisé par update/delete/archive) — la
//    fiche projet reste consultable par lien direct après archivage, contredisant le texte du
//    dialogue de confirmation ("disparaîtra de toutes les listes et vues").
//
// SEC-086 (session 2026-07-20) : findById filtre désormais deletedAt (un projet supprimé n'est
// plus consultable via GET /projects/:id, quel que soit le rôle) — archivedAt reste
// délibérément NON filtré ici (comportement voulu, la fiche d'un projet archivé reste
// consultable par lien direct).
//
// This test imports and calls the real taskService/projectService against a real database —
// not a reimplementation — to prove: an archived project's tasks are excluded from
// taskService.getAllTasks/getTaskById for every role, while projectService.getProjectById
// still returns the archived project itself (documenting the current, intentional
// asymmetry: findById filters deletedAt but not archivedAt by design).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let taskService: typeof import("../src/services/task.service.js").taskService;
let projectService: typeof import("../src/services/project.service.js").projectService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ taskService } = await import("../src/services/task.service.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
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
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeArchivedProjectWithTask() {
  const client = await prisma.client.create({ data: { name: "archived-visibility client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "archived-visibility project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const freelancer = await prisma.user.create({
    data: { email: `freelancer-${project.id}@test.local`, name: "F", passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(freelancer.id);
  const task = await prisma.task.create({ data: { title: "task on archived project", projectId: project.id, assigneeId: freelancer.id } });
  createdTaskIds.push(task.id);
  await projectService.archiveProject(project.id);
  return { project, task, freelancer };
}

describe("archived project task visibility — SEC-041 follow-up", () => {
  test("ADMIN's getAllTasks excludes tasks of an archived project", { skip: !dbAvailable }, async () => {
    const { task } = await makeArchivedProjectWithTask();
    const result = await taskService.getAllTasks(undefined, "admin-id", "ADMIN", { page: 1, pageSize: 100 });
    assert.ok(!result.data.some((t) => t.id === task.id));
  });

  test("MANAGER's getAllTasks (same pole) excludes tasks of an archived project", { skip: !dbAvailable }, async () => {
    const { task } = await makeArchivedProjectWithTask();
    const result = await taskService.getAllTasks(undefined, "manager-id", "MANAGER", { page: 1, pageSize: 100 }, { userRole: "MANAGER", userServiceId: serviceA });
    assert.ok(!result.data.some((t) => t.id === task.id));
  });

  test("FREELANCER's getAllTasks excludes their own task once its project is archived", { skip: !dbAvailable }, async () => {
    const { task, freelancer } = await makeArchivedProjectWithTask();
    const result = await taskService.getAllTasks(undefined, freelancer.id, "FREELANCER", { page: 1, pageSize: 100 });
    assert.ok(!result.data.some((t) => t.id === task.id));
  });

  test("getTaskById 404s on a task belonging to an archived project", { skip: !dbAvailable }, async () => {
    const { task } = await makeArchivedProjectWithTask();
    await assert.rejects(
      () => taskService.getTaskById(task.id, "admin-id", "ADMIN"),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("getProjectById still returns an archived project by direct id (findById is unfiltered, unlike task visibility)", { skip: !dbAvailable }, async () => {
    const { project } = await makeArchivedProjectWithTask();
    const found = await projectService.getProjectById(project.id, "admin-id", "ADMIN");
    assert.equal(found.id, project.id);
    assert.ok(found.archivedAt);
  });
});
