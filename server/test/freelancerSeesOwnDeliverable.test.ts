// Bug fonctionnel, signalé par le porteur du projet (session du 2026-07-18) : l'onglet "Mes
// livrables" du détail projet n'était filtré par aucun projet côté lecture (client/src/features/
// projects/ProjectDetailPage.tsx appelait useDocuments({ page: 1, pageSize: 50 }) sans jamais
// passer projectId: project.id, alors que le hook et l'API le supportent).
//
// Investigation plus poussée : un second bug, plus grave, était empilé — le dépôt de livrable
// (createDocument) ne transmettait jamais projectId/clientId non plus, seulement
// tags: [project.name] (texte libre). Vérifié empiriquement contre une base réelle :
// documentRepository.findAll's scope FREELANCER filtre `where.project = { tasks: { some: {...} }
// }` — une relation Prisma imbriquée qui ne matche JAMAIS un Document dont projectId est null.
// Conséquence réelle : un livrable déposé par un freelance était invisible POUR LUI-MÊME dès
// qu'il consultait via ce chemin scope-filtré, même après avoir corrigé uniquement la lecture
// (l'ajout de projectId sur useDocuments seul n'aurait rien changé tant que les documents créés
// n'avaient pas de projectId réel).
//
// Fixed: ProjectDetailPage.tsx passe désormais projectId (lecture) et projectId + clientId
// (écriture, à la création).
//
// This test imports and calls the real documentService.create then documentService.getAll
// against a real database — not a reimplementation — and confirms a FREELANCER can see a
// deliverable they just uploaded, scoped to their own project, once projectId is set.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let documentService: typeof import("../src/services/document.service.js").documentService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdDocIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ documentService } = await import("../src/services/document.service.js"));
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
  await prisma.document.deleteMany({ where: { id: { in: createdDocIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("FREELANCER sees their own project-scoped deliverable (document upload projectId gap)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a deliverable created with projectId/clientId is visible to the freelancer staffed on that project", async () => {
    const client = await prisma.client.create({ data: { name: "deliverable-scope client", serviceId } });
    createdClientIds.push(client.id);
    const freelancer = await prisma.user.create({
      data: { email: `deliv-scope-${Date.now()}@example.com`, name: "Deliverable Freelancer", passwordHash: "x", role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);
    const project = await prisma.project.create({ data: { name: "deliverable-scope project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({ data: { title: "assigned task", projectId: project.id, assigneeId: freelancer.id } });
    createdTaskIds.push(task.id);

    const doc = await documentService.create({
      name: "Rapport final",
      title: "Rapport final",
      type: "DELIVERABLE",
      accessLevel: "ADMIN_FREELANCER",
      url: "https://example.com/rapport.pdf",
      projectId: project.id,
      clientId: client.id,
      uploadedById: freelancer.id,
    });
    createdDocIds.push(doc.id);

    const result = await documentService.getAll(
      { page: 1, pageSize: 50, projectId: project.id },
      { role: "FREELANCER", userId: freelancer.id }
    );

    assert.ok(
      result.data.some((d) => d.id === doc.id),
      "the freelancer must see the deliverable they just uploaded to their own project"
    );
  });

  test("without projectId (the pre-fix behavior), the same deliverable is invisible to the freelancer — proves the gap was real", async () => {
    const client = await prisma.client.create({ data: { name: "deliverable-gap client", serviceId } });
    createdClientIds.push(client.id);
    const freelancer = await prisma.user.create({
      data: { email: `deliv-gap-${Date.now()}@example.com`, name: "Gap Freelancer", passwordHash: "x", role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);
    const project = await prisma.project.create({ data: { name: "deliverable-gap project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const task = await prisma.task.create({ data: { title: "assigned task", projectId: project.id, assigneeId: freelancer.id } });
    createdTaskIds.push(task.id);

    const doc = await documentService.create({
      name: "Sans projectId",
      title: "Sans projectId",
      type: "DELIVERABLE",
      accessLevel: "ADMIN_FREELANCER",
      url: "https://example.com/sans-projet.pdf",
      uploadedById: freelancer.id,
      // projectId intentionally omitted — reproduces the original bug.
    });
    createdDocIds.push(doc.id);

    const result = await documentService.getAll(
      { page: 1, pageSize: 50 },
      { role: "FREELANCER", userId: freelancer.id }
    );

    assert.ok(
      !result.data.some((d) => d.id === doc.id),
      "a document with no projectId must be invisible to any FREELANCER — confirms the scope filter's real behavior"
    );
  });
});
