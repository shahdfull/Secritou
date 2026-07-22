// SEC-023 (ANOMALIES.yaml): documentService.signDocument had two independent defects, both
// found while reading document.service.ts to confirm entity 3.18's status:
// (a) the ownership check only looked at doc.project?.clientId — a CONTRACT document created
//     without a projectId (a real, validator-allowed path) could NEVER be signed by its
//     rightful owner, always 403.
// (b) Document.signedByClientId is actually a foreign key to User.id (relation
//     "SignedDocuments" on User), not Client.id, despite its name — the code wrote the
//     Client's id into it, which ALWAYS violated the FK constraint. No client has ever been
//     able to successfully sign a contract through this endpoint, project-linked or not,
//     until this fix.
// This test imports and calls the real signDocument against a real database — not a
// reimplementation — for both the normal (project-linked) and project-less paths.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let documentService: typeof import("../src/services/document.service.js").documentService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceId: string;
let adminId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdDocumentIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ documentService } = await import("../src/services/document.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
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
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeClientWithUser(emailPrefix: string) {
  const client = await prisma.client.create({ data: { name: `${emailPrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const user = await prisma.user.create({
    data: { email: `${emailPrefix}-${Date.now()}@example.com`, name: `${emailPrefix} user`, passwordHash: "x", role: "CLIENT", clientId: client.id },
  });
  createdUserIds.push(user.id);
  return { client, user };
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("documentService.signDocument (SEC-023)", () => {
  test("a project-linked contract can be signed by the rightful client's user", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, user } = await makeClientWithUser("sec023-a");
    const project = await prisma.project.create({ data: { name: "SEC-023 project", clientId: client.id, serviceId } });
    createdProjectIds.push(project.id);
    const doc = await prisma.document.create({
      data: { name: "Contract A", title: "Contract A", type: "CONTRACT", url: "https://example.com/a.pdf", projectId: project.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    const signed = await documentService.signDocument(doc.id, client.id, user.id);
    assert.ok(signed.signedAt, "signedAt must be set");
    assert.equal(signed.signedByClientId, user.id, "signedByClientId must store the signing USER's id (it's a User FK despite the name)");
  });

  test("a CONTRACT document with no projectId (directly attached to a client) can also be signed", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, user } = await makeClientWithUser("sec023-b");
    const doc = await prisma.document.create({
      data: { name: "Contract B", title: "Contract B", type: "CONTRACT", url: "https://example.com/b.pdf", clientId: client.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    const signed = await documentService.signDocument(doc.id, client.id, user.id);
    assert.ok(signed.signedAt);
    assert.equal(signed.signedByClientId, user.id);
  });

  test("a different client cannot sign someone else's contract", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client: ownerClient } = await makeClientWithUser("sec023-c-owner");
    const { user: otherUser, client: otherClient } = await makeClientWithUser("sec023-c-other");
    const doc = await prisma.document.create({
      data: { name: "Contract C", title: "Contract C", type: "CONTRACT", url: "https://example.com/c.pdf", clientId: ownerClient.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    await assert.rejects(
      () => documentService.signDocument(doc.id, otherClient.id, otherUser.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        return true;
      }
    );
  });

  test("a document already signed cannot be signed again", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, user } = await makeClientWithUser("sec023-d");
    const doc = await prisma.document.create({
      data: { name: "Contract D", title: "Contract D", type: "CONTRACT", url: "https://example.com/d.pdf", clientId: client.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    await documentService.signDocument(doc.id, client.id, user.id);
    await assert.rejects(
      () => documentService.signDocument(doc.id, client.id, user.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 409);
        assert.equal((err as InstanceType<typeof HttpError>).code, "ALREADY_SIGNED");
        return true;
      }
    );
  });

  // SEC-185: signDocument used to write only { signedAt, signedByClientId } — no IP, user-agent,
  // or content hash, despite the same capture mechanism already existing for downloadDocument via
  // documentService.logAccess. Fixed by writing a DocumentAccessLog row (action "SIGN") alongside
  // the signature, carrying ipAddress/userAgent (and contentHash when the document has a fileKey
  // in S3 — none of this file's fixtures do, covered by the hash's best-effort null path here).
  test("signing captures the signer's IP and user-agent in a DocumentAccessLog row (SEC-185)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, user } = await makeClientWithUser("sec185-a");
    const doc = await prisma.document.create({
      data: { name: "Contract E", title: "Contract E", type: "CONTRACT", url: "https://example.com/e.pdf", clientId: client.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    await documentService.signDocument(doc.id, client.id, user.id, { ipAddress: "203.0.113.7", userAgent: "SEC-185 test agent" });

    const log = await prisma.documentAccessLog.findFirst({ where: { documentId: doc.id, action: "SIGN" } });
    assert.ok(log, "a SIGN access log row must be created");
    assert.equal(log!.ipAddress, "203.0.113.7");
    assert.equal(log!.userAgent, "SEC-185 test agent");
    assert.equal(log!.userId, user.id);
  });

  test("signing without IP/user-agent metadata (e.g. an internal call) still succeeds — capture is best-effort, never blocking", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { client, user } = await makeClientWithUser("sec185-b");
    const doc = await prisma.document.create({
      data: { name: "Contract F", title: "Contract F", type: "CONTRACT", url: "https://example.com/f.pdf", clientId: client.id, uploadedById: adminId },
    });
    createdDocumentIds.push(doc.id);

    const signed = await documentService.signDocument(doc.id, client.id, user.id);
    assert.ok(signed.signedAt);
  });
});
