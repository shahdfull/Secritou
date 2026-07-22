// Bug fonctionnel, signalé par le porteur du projet (session du 2026-07-18) : les onglets
// "Actif" / "Terminé" du détail Freelancer (ProjectsPage.tsx) étaient calculés par .filter() sur
// une seule page paginée de useProjects (12 éléments par défaut), alors que la pagination en bas
// de page portait sur le total non filtré — deux logiques de pagination incompatibles sur le
// même écran. Un freelance avec plus de 12 projets voyait des compteurs et un contenu de
// sous-onglet faux (un projet "Terminé" sur la page 2 n'apparaissait jamais dans l'onglet
// "Terminé" tant qu'on n'y naviguait pas manuellement page par page).
//
// Root cause: project.repository.ts's buildWhere only supported a single-value `status` filter
// (shared with every other entity's generic ListQueryOptions) — "Actif" spans 3 statuses
// (PLANNING/IN_PROGRESS/REVIEW), which a single-value filter can't express.
//
// Fixed: a new `statusIn` parameter added to findAll/getAllProjects (server) and to
// projectsApi.getAll/useProjects (client) — the freelancer sub-tabs now each make their own
// independently paginated request, filtered by their own status set, instead of filtering a
// single loaded page client-side.
//
// This test imports and calls the real projectRepository.findAll against a real database — not a
// reimplementation — and confirms statusIn filters correctly and paginates independently of any
// other status.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectRepository: typeof import("../src/repositories/project.repository.js").projectRepository;
let dbAvailable = true;

let serviceId: string;
let freelancerId: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectRepository } = await import("../src/repositories/project.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
    const freelancer = await prisma.user.create({
      data: { email: `statusin-${Date.now()}@example.com`, name: "StatusIn Freelancer", passwordHash: "x", role: "FREELANCER" },
    });
    freelancerId = freelancer.id;
    createdUserIds.push(freelancer.id);
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeProjectWithTask(namePrefix: string, status: "PLANNING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED") {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId, status } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: "task", projectId: project.id, assigneeId: freelancerId } });
  createdTaskIds.push(task.id);
  return project;
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("projectRepository.findAll — statusIn (freelancer Active/Done sub-tabs)", () => {
  test("statusIn=[PLANNING,IN_PROGRESS,REVIEW] returns only active projects, never COMPLETED ones", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const active1 = await makeProjectWithTask("statusin-active-1", "PLANNING");
    const active2 = await makeProjectWithTask("statusin-active-2", "IN_PROGRESS");
    const done1 = await makeProjectWithTask("statusin-done-1", "COMPLETED");

    const result = await projectRepository.findAll(
      freelancerId, "FREELANCER",
      { page: 1, pageSize: 50, orderDir: "asc" },
      undefined, undefined,
      ["PLANNING", "IN_PROGRESS", "REVIEW"]
    );

    const ids = result.data.map((p) => p.id);
    assert.ok(ids.includes(active1.id), "PLANNING project must be included");
    assert.ok(ids.includes(active2.id), "IN_PROGRESS project must be included");
    assert.ok(!ids.includes(done1.id), "COMPLETED project must never appear in the active set");
  });

  test("statusIn paginates independently: page size 1 with 2 matching projects returns exactly 1, but total reflects both", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const p1 = await makeProjectWithTask("statusin-page-1", "PLANNING");
    const p2 = await makeProjectWithTask("statusin-page-2", "REVIEW");

    const page1 = await projectRepository.findAll(
      freelancerId, "FREELANCER",
      { page: 1, pageSize: 1, orderBy: "createdAt", orderDir: "asc" },
      undefined, undefined,
      ["PLANNING", "IN_PROGRESS", "REVIEW"]
    );

    assert.equal(page1.data.length, 1, "page size 1 must return exactly 1 row, not silently include the second");
    assert.ok(page1.total >= 2, "total must reflect the true unfiltered count of matching projects, not just this page's size");

    const allIds = new Set<string>();
    let page = 1;
    while (allIds.size < page1.total && page <= 20) {
      const result = await projectRepository.findAll(
        freelancerId, "FREELANCER",
        { page, pageSize: 1, orderBy: "createdAt", orderDir: "asc" },
        undefined, undefined,
        ["PLANNING", "IN_PROGRESS", "REVIEW"]
      );
      for (const p of result.data) allIds.add(p.id);
      page++;
    }
    assert.ok(allIds.has(p1.id) && allIds.has(p2.id), "walking every page must eventually surface both projects — nothing silently hidden beyond page 1");
  });
});
