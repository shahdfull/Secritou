// SEC-168: project.service.ts#clientApprove used to build the client's post-approval email link
// with Windows-style backslashes (`${env.FRONTEND_URL}\client\invoices`) instead of URL slashes
// — a link some browsers/mail clients would normalize, others wouldn't, right at the moment the
// client needs to reach their balance invoice. Verified already fixed by direct reading
// (project.service.ts:441 now uses `/client/invoices`), but no test had ever inspected the actual
// email content clientApprove generates.
//
// This test imports and calls the real projectService.clientApprove against a real database —
// not a reimplementation — mocking only emailService.send (the external side effect) to capture
// the generated email body, and asserts the portal link uses forward slashes.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let emailService: typeof import("../src/services/email.service.js").emailService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ emailService } = await import("../src/services/email.service.js"));
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
  await prisma.invoice.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("clientApprove's client-facing email uses a real URL, not backslashes (SEC-168)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("the portal link in the post-approval client email uses forward slashes", async () => {
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await prisma.client.create({ data: { name: `sec168-client-${uniq}`, email: `sec168-${uniq}@example.com`, serviceId } });
    createdClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: { email: `sec168-user-${uniq}@example.com`, name: "SEC-168 client user", passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(clientUser.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-168 proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({
      data: { name: "SEC-168 project", clientId: client.id, serviceId, status: "REVIEW", proposalId: proposal.id },
    });
    createdProjectIds.push(project.id);
    await prisma.invoice.create({
      data: { number: `SEC-168-DEP-${uniq}`, title: "Deposit", amount: 300, amountHT: 300, currency: "TND", status: "PAID", invoiceType: "DEPOSIT", clientId: client.id, projectId: project.id },
    });

    let capturedBody: string | undefined;
    // Manual reference-swap instead of mock.method/mock.restoreAll: this test file runs as part
    // of a single process alongside dozens of others (run-all.test.ts) — mock.restoreAll() is a
    // GLOBAL registry reset, and another file's after() hook calling it can wipe out this file's
    // still-active mock. A plain save/restore of the function reference is immune to that.
    const originalSend = emailService.send;
    emailService.send = async (args: { to: string; subject: string; html?: string; text?: string }) => {
      capturedBody = args.html ?? args.text;
    };
    try {
      const approved = await projectService.clientApprove(project.id, client.id, clientUser.id);
      assert.ok(approved, "clientApprove must resolve successfully");
    } finally {
      emailService.send = originalSend;
    }

    assert.ok(capturedBody, "the client-facing email must have been sent");
    assert.match(capturedBody!, /\/client\/invoices/, "the portal link must use forward slashes");
    assert.doesNotMatch(capturedBody!, /\\client\\invoices/, "the portal link must not contain backslashes");
  });
});
