// SEC-022: documentService.update/createVersion called documentRepository.findById(id)/
// prisma.document.update(id, ...) directly, never passing a viewer — unlike getById/
// getDownloadUrl (see documentScopeManager.test.ts, SEC-122), which already scope a MANAGER to
// their own pôle via where.client.projects.some.serviceId. A MANAGER with the documents.update
// RBAC permission could edit or version any document company-wide, regardless of pôle.
//
// This test imports and calls the real documentService.update/createVersion against a real
// database — not a reimplementation — confirming a pole-A Manager is refused a pole-B document,
// while a same-pole Manager and an ADMIN (unscoped) still succeed.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let documentService: typeof import("../src/services/document.service.js").documentService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdDocIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ documentService } = await import("../src/services/document.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.document.deleteMany({ where: { id: { in: createdDocIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeDocumentInPole(serviceId: string) {
  const client = await prisma.client.create({ data: { name: "doc-scope client", serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "doc-scope project", clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const doc = await prisma.document.create({
    data: { name: "contrat.pdf", title: "Contrat", type: "CONTRACT", url: "https://example.test/x", clientId: client.id, projectId: project.id, accessLevel: "CLIENT_ADMIN" },
  });
  createdDocIds.push(doc.id);
  return doc;
}

describe("SEC-022: documentService.update enforces Manager pole scope", () => {
  test("a pole-A Manager cannot update a pole-B document", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const doc = await makeDocumentInPole(serviceB);

    await assert.rejects(
      () => documentService.update(doc.id, { title: "Renamed" }, { role: "MANAGER", serviceId: serviceA }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("a same-pole Manager can update the document", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const doc = await makeDocumentInPole(serviceA);

    const updated = await documentService.update(doc.id, { title: "Renamed" }, { role: "MANAGER", serviceId: serviceA });
    assert.equal(updated.title, "Renamed");
  });

  test("an ADMIN (unscoped) can update a document from any pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const doc = await makeDocumentInPole(serviceB);

    const updated = await documentService.update(doc.id, { title: "Renamed by admin" }, { role: "ADMIN" });
    assert.equal(updated.title, "Renamed by admin");
  });
});

describe("SEC-022: documentService.createVersion enforces Manager pole scope", () => {
  test("a pole-A Manager cannot version a pole-B document", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const doc = await makeDocumentInPole(serviceB);

    await assert.rejects(
      () => documentService.createVersion(doc.id, { url: "https://example.test/v2" }, { role: "MANAGER", serviceId: serviceA }),
      (err: unknown) => err instanceof Error && err.message === "Document not found"
    );
  });

  test("a same-pole Manager can version the document", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const doc = await makeDocumentInPole(serviceA);

    const version = await documentService.createVersion(doc.id, { url: "https://example.test/v2" }, { role: "MANAGER", serviceId: serviceA });
    createdDocIds.push(version.id);
    assert.equal(version.parentId, doc.id);
    assert.equal(version.version, doc.version + 1);
  });
});
