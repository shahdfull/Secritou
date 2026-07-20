// SEC-122 : documentRepository.findById n'avait aucune branche MANAGER (seulement CLIENT et
// FREELANCER) alors que findAll en a une — un Manager du pôle A pouvait lire/télécharger par ID
// direct un document rattaché à un client/projet du pôle B, malgré que le controller transmette
// déjà viewer.serviceId (silencieusement ignoré côté repository). Corrigé en ajoutant la branche
// MANAGER (même logique que findAll : where.client.projects.some.serviceId).
//
// This test imports and calls the real documentService.getById/documentRepository.findById
// against a real database — not a reimplementation — confirming a pole-A Manager is refused a
// pole-B document, while a same-pole Manager and an ADMIN (unscoped) can still read it.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

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

describe("SEC-122: documentService.getById enforces Manager pole scope", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a pole-A Manager cannot read a pole-B document by direct id", async () => {
    const doc = await makeDocumentInPole(serviceB);

    const found = await documentService.getById(doc.id, { role: "MANAGER", serviceId: serviceA });
    assert.equal(found, null);
  });

  test("a same-pole Manager can still read the document", async () => {
    const doc = await makeDocumentInPole(serviceA);

    const found = await documentService.getById(doc.id, { role: "MANAGER", serviceId: serviceA });
    assert.ok(found);
    assert.equal(found!.id, doc.id);
  });

  test("an ADMIN (unscoped) can read a document from any pole", async () => {
    const doc = await makeDocumentInPole(serviceB);

    const found = await documentService.getById(doc.id, { role: "ADMIN" });
    assert.ok(found);
    assert.equal(found!.id, doc.id);
  });
});
