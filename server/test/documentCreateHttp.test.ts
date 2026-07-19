// SEC-068 (découvert incidemment en travaillant sur SEC-063) : createDocumentSchema
// (shared/src/schemas/document.schema.ts#documentBaseSchema) n'avait pas de champ `title`, alors
// que Document.title est requis (String, sans défaut) sur le modèle Prisma. Le middleware
// validate() retirait silencieusement `title` du body avant que le contrôleur/service ne le
// voie (confirmé empiriquement : Zod .parse() retire toute clé non déclarée par défaut). Aucun
// test existant n'exerçait la vraie route HTTP POST /documents (les tests précédents appelaient
// documentService.create directement, contournant validate() où le bug se produisait) — c'est
// pourquoi ce défaut n'avait jamais été détecté malgré son impact sur tous les appelants
// (ADMIN/MANAGER inclus, pas seulement le dépôt de livrable freelance de SEC-063).
//
// SEC-063 (même session) : POST /documents était authorize("ADMIN", "MANAGER") seul — l'onglet
// "Mes livrables" (FREELANCER) sur ProjectDetailPage.tsx appelait cette route mais recevait
// systématiquement 403 avant même la logique métier.
//
// This test exercises the real HTTP stack (app.ts → routes → validate() → controller → service →
// repository → the real database) via supertest — proving:
// 1. POST /documents as ADMIN with a title actually persists that title (SEC-068).
// 2. POST /documents as a FREELANCER staffed on the project, depositing a DELIVERABLE, succeeds
//    (SEC-063) — title survives here too.
// 3. The critical security property this SEC-063 correctif introduces: a FREELANCER attempting a
//    non-DELIVERABLE type, or a project they're NOT staffed on, is rejected with 403.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const TEST_PASSWORD = "TestPass123!SEC068";

let app: import("express").Express;
let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;

let serviceId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];
const createdDocIds: string[] = [];

before(async () => {
  try {
    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
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

async function makeUser(email: string, role: "ADMIN" | "FREELANCER") {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = await prisma.user.create({ data: { email, name: `HTTP test ${role}`, passwordHash, role } });
  createdUserIds.push(user.id);
  return user;
}

async function login(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.tokens.accessToken as string;
}

describe("POST /documents — real HTTP stack (SEC-068 + SEC-063)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("an ADMIN creating a document with a title actually persists that title (SEC-068)", async () => {
    const admin = await makeUser(`sec068-admin-${Date.now()}@example.com`, "ADMIN");
    const token = await login(admin.email);

    const res = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Guide interne", title: "Guide interne complet", type: "GUIDE", url: "https://example.com/guide.pdf" });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.title, "Guide interne complet", "the client-supplied title must survive validation and persist");
    if (res.body.data.id) createdDocIds.push(res.body.data.id);
  });

  test("a FREELANCER staffed on the project can deposit their own DELIVERABLE, title included (SEC-063 + SEC-068)", async () => {
    const client = await prisma.client.create({ data: { name: "sec063 http client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec063 http project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const freelancer = await makeUser(`sec063-freelancer-${Date.now()}@example.com`, "FREELANCER");
    const task = await prisma.task.create({ data: { title: "assigned task", projectId: project.id, assigneeId: freelancer.id } });
    createdTaskIds.push(task.id);
    const token = await login(freelancer.email);

    const res = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Mon livrable",
        title: "Mon livrable",
        type: "DELIVERABLE",
        accessLevel: "ADMIN_FREELANCER",
        url: "https://example.com/livrable.pdf",
        projectId: project.id,
        clientId: client.id,
      });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.title, "Mon livrable");
    if (res.body.data.id) createdDocIds.push(res.body.data.id);
  });

  test("a FREELANCER attempting a non-DELIVERABLE type is rejected with 403 (security)", async () => {
    const client = await prisma.client.create({ data: { name: "sec063 reject-type client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec063 reject-type project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const freelancer = await makeUser(`sec063-reject-type-${Date.now()}@example.com`, "FREELANCER");
    const task = await prisma.task.create({ data: { title: "assigned task", projectId: project.id, assigneeId: freelancer.id } });
    createdTaskIds.push(task.id);
    const token = await login(freelancer.email);

    const res = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Contrat", title: "Contrat", type: "CONTRACT", url: "https://example.com/contrat.pdf", projectId: project.id });

    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  test("a FREELANCER not staffed on the project is rejected with 403 (security)", async () => {
    const client = await prisma.client.create({ data: { name: "sec063 not-staffed client", serviceId } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec063 not-staffed project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const freelancer = await makeUser(`sec063-not-staffed-${Date.now()}@example.com`, "FREELANCER");
    // No task assigned to this freelancer on this project.
    const token = await login(freelancer.email);

    const res = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Intrusion",
        title: "Intrusion",
        type: "DELIVERABLE",
        accessLevel: "ADMIN_FREELANCER",
        url: "https://example.com/intrusion.pdf",
        projectId: project.id,
      });

    assert.equal(res.status, 403, JSON.stringify(res.body));
  });
});
