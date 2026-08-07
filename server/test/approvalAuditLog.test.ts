import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { closeJobQueueConnections } from "./testCleanup.js";

let prisma: typeof import("../src/config/prisma.js").prisma;
let approvalService: typeof import("../src/services/approval.service.js").approvalService;
let dbAvailable = true;
let actorId: string;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdApprovalIds: string[] = [];
const createdAuditLogIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ approvalService } = await import("../src/services/approval.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const passwordHash = await bcrypt.hash("Sec005TestPass!", 10);
    const actor = await prisma.user.create({
      data: { email: `sec005-actor-${Date.now()}@example.com`, name: "SEC-005 Test Actor", passwordHash, role: "CLIENT" },
    });
    createdUserIds.push(actor.id);
    actorId = actor.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditLogIds } } });
  await prisma.approval.deleteMany({ where: { id: { in: createdApprovalIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
});

// SEC-073: closes the BullMQ/ioredis connection approval.service.ts opens transitively (via
// jobs/queues.ts) at import time — without this, node --test never exits when this file runs
// alone (npx tsx --test approvalAuditLog.test.ts), even though run-all.test.ts's own global
// after() already covers this file when it's imported through the aggregator.
after(closeJobQueueConnections);

async function findAuditLogFor(entityType: string, entityId: string, action: string) {
  for (let i = 0; i < 20; i++) {
    const row = await prisma.auditLog.findFirst({ where: { entityType, entityId, action }, orderBy: { createdAt: "desc" } });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

describe("approvalService writes audit logs for decisions (SEC-005)", () => {
  test("approve writes an approval.approve AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec005 approval client A" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec005 approval project A", clientId: client.id } });
    createdProjectIds.push(project.id);
    const approval = await prisma.approval.create({ data: { title: "SEC-005 approve", clientId: client.id, projectId: project.id, status: "PENDING" } });
    createdApprovalIds.push(approval.id);

    await approvalService.approve(approval.id, "ok", actorId);

    const entry = await findAuditLogFor("Approval", approval.id, "approval.approve");
    assert.ok(entry, "approvalService.approve must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.deepEqual(entry!.before, { status: "PENDING" });
    assert.deepEqual(entry!.after, { status: "APPROVED" });
  });

  test("reject writes an approval.reject AuditLog entry", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const client = await prisma.client.create({ data: { name: "sec005 approval client B" } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "sec005 approval project B", clientId: client.id } });
    createdProjectIds.push(project.id);
    const approval = await prisma.approval.create({ data: { title: "SEC-005 reject", clientId: client.id, projectId: project.id, status: "PENDING" } });
    createdApprovalIds.push(approval.id);

    await approvalService.reject(approval.id, "nope", actorId);

    const entry = await findAuditLogFor("Approval", approval.id, "approval.reject");
    assert.ok(entry, "approvalService.reject must write an AuditLog entry");
    createdAuditLogIds.push(entry!.id);
    assert.equal(entry!.actorId, actorId);
    assert.deepEqual(entry!.before, { status: "PENDING" });
    assert.deepEqual(entry!.after, { status: "REJECTED" });
  });
});
