// SEC-060 (rapport Product Owner, §7 constat P1, session 2026-07-19) : Document supportait déjà
// un projectId optionnel mais aucun taskId — confirmé par lecture directe du schéma, aucune pièce
// jointe ne pouvait être attachée directement à une tâche (seulement au projet).
//
// This test imports and calls the real documentRepository.findAll/findById against a real
// database — not a reimplementation — proving:
// 1. A document created with only a taskId (no projectId) is returned when filtering by that
//    taskId.
// 2. The critical security property this correctif introduces: a FREELANCER assigned to the
//    task can see a task-only document (no projectId to scope through), and a FREELANCER NOT
//    assigned to that task cannot — mirroring the existing project-based FREELANCER scope, which
//    alone would have missed this document entirely (where.project on a null relation never
//    matches).
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let documentRepository: typeof import("../src/repositories/document.repository.js").documentRepository;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdDocumentIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ documentRepository } = await import("../src/repositories/document.repository.js"));
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
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeTask() {
  const client = await prisma.client.create({ data: { name: "task-attachments client", serviceId: serviceA } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "task-attachments project", clientId: client.id, serviceId: serviceA } });
  createdProjectIds.push(project.id);
  const task = await prisma.task.create({ data: { title: "task-attachments task", projectId: project.id } });
  createdTaskIds.push(task.id);
  return task;
}

async function makeFreelancer(suffix: string) {
  const user = await prisma.user.create({
    data: { email: `attach-${suffix}@test.local`, name: `F-${suffix}`, passwordHash: "x", role: "FREELANCER" },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeTaskOnlyDocument(taskId: string) {
  const doc = await prisma.document.create({
    data: {
      name: "cahier-des-charges.pdf",
      title: "cahier-des-charges.pdf",
      type: "OTHER",
      url: "https://example.test/doc.pdf",
      accessLevel: "ADMIN_FREELANCER",
      taskId,
    },
  });
  createdDocumentIds.push(doc.id);
  return doc;
}

describe("documentRepository taskId support — SEC-060", () => {
  test("findAll filters by taskId and returns a document with no projectId", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const doc = await makeTaskOnlyDocument(task.id);

    const result = await documentRepository.findAll({ page: 1, pageSize: 10, orderBy: "createdAt", orderDir: "desc", taskId: task.id });

    const ids = result.data.map((d) => d.id);
    assert.ok(ids.includes(doc.id));
    assert.equal(result.data.find((d) => d.id === doc.id)?.projectId, null);
  });

  test("a FREELANCER assigned to the task can see a task-only document via findAll (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const assignedFreelancer = await makeFreelancer("assigned1");
    await prisma.task.update({ where: { id: task.id }, data: { assigneeId: assignedFreelancer.id } });
    const doc = await makeTaskOnlyDocument(task.id);

    const result = await documentRepository.findAll({
      page: 1,
      pageSize: 10,
      orderBy: "createdAt",
      orderDir: "desc",
      role: "FREELANCER",
      viewerUserId: assignedFreelancer.id,
    });

    assert.ok(result.data.map((d) => d.id).includes(doc.id));
  });

  test("a FREELANCER NOT assigned to the task cannot see a task-only document via findAll (security)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const assignedFreelancer = await makeFreelancer("assigned2");
    const otherFreelancer = await makeFreelancer("other2");
    await prisma.task.update({ where: { id: task.id }, data: { assigneeId: assignedFreelancer.id } });
    const doc = await makeTaskOnlyDocument(task.id);

    const result = await documentRepository.findAll({
      page: 1,
      pageSize: 10,
      orderBy: "createdAt",
      orderDir: "desc",
      role: "FREELANCER",
      viewerUserId: otherFreelancer.id,
    });

    assert.ok(!result.data.map((d) => d.id).includes(doc.id));
  });

  test("findById respects the same FREELANCER task-scope for a task-only document", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const assignedFreelancer = await makeFreelancer("assigned3");
    const otherFreelancer = await makeFreelancer("other3");
    await prisma.task.update({ where: { id: task.id }, data: { assigneeId: assignedFreelancer.id } });
    const doc = await makeTaskOnlyDocument(task.id);

    const foundBySelf = await documentRepository.findById(doc.id, { role: "FREELANCER", userId: assignedFreelancer.id });
    assert.ok(foundBySelf);

    const foundByOther = await documentRepository.findById(doc.id, { role: "FREELANCER", userId: otherFreelancer.id });
    assert.equal(foundByOther, null);
  });

  test("the FREELANCER scope still works via a project-attached document (search branch does not silently override it)", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const task = await makeTask();
    const assignedFreelancer = await makeFreelancer("assigned4");
    await prisma.task.update({ where: { id: task.id }, data: { assigneeId: assignedFreelancer.id } });
    const doc = await prisma.document.create({
      data: {
        name: "project-level.pdf",
        title: "project-level.pdf",
        type: "OTHER",
        url: "https://example.test/doc2.pdf",
        accessLevel: "ADMIN_FREELANCER",
        projectId: task.projectId,
      },
    });
    createdDocumentIds.push(doc.id);

    // Combining role scoping with a search term exercises the where.AND / where.OR interaction
    // this correctif had to get right (the search branch also assigns where.OR).
    const result = await documentRepository.findAll({
      page: 1,
      pageSize: 10,
      orderBy: "createdAt",
      orderDir: "desc",
      role: "FREELANCER",
      viewerUserId: assignedFreelancer.id,
      search: "project-level",
    });

    assert.ok(result.data.map((d) => d.id).includes(doc.id));
  });
});
