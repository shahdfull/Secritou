// SEC-040 (§2.6 du rapport "Casquette full-stack/2.6 Couverture de tests", session 2026-07-19) :
// aucun test n'appelait directement projectService.createProject/archiveProject/restoreProject.
// C'est notamment ce qui a laissé passer le bug SEC-039 (bouton "Nouveau projet" 100% cassé) —
// les tests backend existants validaient createProject avec un proposalId valide fourni
// directement, sans jamais rejouer le payload réellement envoyé par le formulaire front.
//
// This test imports and calls the real projectService against a real database — not a
// reimplementation — covering:
// - createProject: rejects a missing/non-existent proposalId, rejects a proposal not ACCEPTED,
//   succeeds from a real ACCEPTED proposal, and forces serviceId to the acting MANAGER's own
//   pole regardless of what the caller passes (mirrors updateProject's existing guard).
// - archiveProject / restoreProject: archive sets archivedAt and makes the project invisible to
//   findAll (mirrors soft-delete's archivedAt: null filter); restoreProject only affects
//   deletedAt (soft-delete), not archivedAt — confirmed directly, since the two are independent
//   soft-state axes (see SEC-040 note in ANOMALIES.yaml) and restoring a non-deleted project
//   must reject with 404.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
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
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.task.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClient(namePrefix: string, serviceId?: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  return client;
}

async function makeProposal(clientId: string, status: "DRAFT" | "SENT" | "ACCEPTED") {
  const proposal = await prisma.proposal.create({
    data: { title: "test proposal", clientId, status, ...(status === "ACCEPTED" ? { acceptedAt: new Date() } : {}) },
  });
  createdProposalIds.push(proposal.id);
  return proposal;
}

describe("projectService.createProject — SEC-040", () => {
  test("rejects a non-existent proposalId with 404", { skip: !dbAvailable }, async () => {
    await assert.rejects(
      () => projectService.createProject({ name: "x", proposalId: "00000000-0000-0000-0000-000000000000" }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("rejects a proposal that is not ACCEPTED with 422", { skip: !dbAvailable }, async () => {
    const client = await makeClient("draft-proposal");
    const proposal = await makeProposal(client.id, "SENT");
    await assert.rejects(
      () => projectService.createProject({ name: "x", proposalId: proposal.id, clientId: client.id }),
      (err: unknown) => err instanceof HttpError && err.statusCode === 422 && err.code === "PROPOSAL_NOT_ACCEPTED"
    );
  });

  test("succeeds from a real ACCEPTED proposal (the only valid path per acceptWithCascade)", { skip: !dbAvailable }, async () => {
    const client = await makeClient("accepted-proposal");
    const proposal = await makeProposal(client.id, "ACCEPTED");
    const project = await projectService.createProject({ name: "real project", proposalId: proposal.id, clientId: client.id });
    createdProjectIds.push(project.id);
    assert.equal(project.clientId, client.id);
  });

  test("forces serviceId to the MANAGER's own pole even if the caller passes another pole's id", { skip: !dbAvailable }, async () => {
    const client = await makeClient("manager-scope-force");
    const proposal = await makeProposal(client.id, "ACCEPTED");
    const project = await projectService.createProject(
      { name: "scoped project", proposalId: proposal.id, clientId: client.id, serviceId: serviceB },
      { userRole: "MANAGER", userServiceId: serviceA }
    );
    createdProjectIds.push(project.id);
    assert.equal(project.serviceId, serviceA);
  });
});

describe("projectService.archiveProject / restoreProject — SEC-040", () => {
  test("archiveProject sets archivedAt and hides the project from findAll", { skip: !dbAvailable }, async () => {
    const client = await makeClient("archive-target");
    const project = await prisma.project.create({ data: { name: "to be archived", clientId: client.id } });
    createdProjectIds.push(project.id);

    const archived = await projectService.archiveProject(project.id);
    assert.ok(archived.archivedAt);

    const listed = await projectService.getAllProjects("admin-id", "ADMIN", { page: 1, pageSize: 50 });
    assert.ok(!listed.data.some((p) => p.id === project.id));
  });

  test("archiveProject on an already-deleted or already-archived project rejects with 404", { skip: !dbAvailable }, async () => {
    const client = await makeClient("archive-twice");
    const project = await prisma.project.create({ data: { name: "double archive", clientId: client.id } });
    createdProjectIds.push(project.id);
    await projectService.archiveProject(project.id);

    await assert.rejects(
      () => projectService.archiveProject(project.id),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("restoreProject only reverses deletedAt (soft-delete), not archivedAt", { skip: !dbAvailable }, async () => {
    const client = await makeClient("restore-vs-archive");
    const project = await prisma.project.create({ data: { name: "archived not deleted", clientId: client.id } });
    createdProjectIds.push(project.id);
    await projectService.archiveProject(project.id);

    // restoreProject's own query filters on deletedAt: { not: null } — an archived-but-not-
    // deleted project was never soft-deleted, so this must reject with 404, not silently
    // "restore" (there is nothing to restore, and no un-archive path exists — see SEC-040).
    await assert.rejects(
      () => projectService.restoreProject(project.id),
      (err: unknown) => err instanceof HttpError && err.statusCode === 404
    );
  });

  test("restoreProject reverses a real soft-delete (deletedAt)", { skip: !dbAvailable }, async () => {
    const client = await makeClient("restore-target");
    const project = await prisma.project.create({ data: { name: "to be restored", clientId: client.id } });
    createdProjectIds.push(project.id);
    await projectService.deleteProject(project.id);

    const restored = await projectService.restoreProject(project.id);
    assert.equal(restored.deletedAt, null);
  });
});
