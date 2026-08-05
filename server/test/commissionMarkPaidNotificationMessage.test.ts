// SEC-078: commission.service.ts#markPaid built the COMMISSION_PAID notification message with
// `${updatedCommission.invoice?.number ? "" : ""}` — both ternary branches returned the same
// empty string, so the invoice number never appeared regardless of whether the commission was
// tied to a real invoice, despite commissionRepository.markPaid loading invoice:{select:{id,
// number}} specifically for this message. The currency was also missing entirely, unlike every
// other money notification in the codebase (e.g. invoice.service.ts's
// "${amount} ${currency ?? 'TND'}" pattern) — fixed in the same commit since it's the same dead
// data problem on the same message.
//
// This test imports and calls the real commissionService.markPaid against a real database and
// BullMQ queue, then reads the actual enqueued notification job's message — not a
// reimplementation of the message-building logic.
//
// Requires a real, migrated database and reachable Redis; skipped otherwise.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let commissionService: typeof import("../src/services/commission.service.js").commissionService;
let communicationQueue: typeof import("../src/jobs/queues.js").communicationQueue;
let dbAvailable = true;

const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];
const createdCommissionIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ commissionService } = await import("../src/services/commission.service.js"));
    ({ communicationQueue } = await import("../src/jobs/queues.js"));
    await prisma.$queryRaw`SELECT 1`;
    await communicationQueue.waitUntilReady();
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.commission.deleteMany({ where: { id: { in: createdCommissionIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makePartnerAndProject() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const partner = await prisma.user.create({
    data: { email: `sec078-partner-${suffix}@test.local`, name: "SEC-078 Partner", passwordHash: "x", role: "ADMIN" },
  });
  createdUserIds.push(partner.id);
  const client = await prisma.client.create({ data: { name: `sec078-client-${suffix}` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `sec078-project-${suffix}`, clientId: client.id } });
  createdProjectIds.push(project.id);
  return { partner, client, project };
}

async function getEnqueuedMessage(commissionId: string, partnerId: string): Promise<string | undefined> {
  const jobId = `notification|COMMISSION_PAID|${commissionId}|${partnerId}`;
  let job = await communicationQueue.getJob(jobId);
  for (let i = 0; i < 20 && !job; i++) {
    await new Promise((r) => setTimeout(r, 25));
    job = await communicationQueue.getJob(jobId);
  }
  const message = job ? String(job.data.message) : undefined;
  await job?.remove().catch(() => {});
  return message;
}

describe("commissionService.markPaid: COMMISSION_PAID notification message (SEC-078, real code)", () => {
  test("includes the real invoice number and currency when the commission is tied to an invoice", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { partner, client, project } = await makePartnerAndProject();

    const invoice = await prisma.invoice.create({
      data: { number: `SEC-078-${Date.now()}`, title: "Invoice", amount: 1000, currency: "TND", clientId: client.id, invoiceType: "STANDARD" },
    });
    createdInvoiceIds.push(invoice.id);

    const commission = await prisma.commission.create({
      data: { partnerId: partner.id, projectId: project.id, invoiceId: invoice.id, amount: 150, status: "PENDING" },
    });
    createdCommissionIds.push(commission.id);

    await commissionService.markPaid(commission.id);

    const message = await getEnqueuedMessage(commission.id, partner.id);
    assert.ok(message, "markPaid must enqueue a real COMMISSION_PAID notification");
    assert.match(message!, /150\.000 TND/, "message must include the real amount and currency");
    assert.match(message!, new RegExp(`\\(facture ${invoice.number}\\)`), "message must include the real invoice number, not a dead ternary");
    assert.doesNotMatch(message!, / {2}a été/, "message must not contain the old double-space artifact from the dead ternary");
  });

  test("omits the invoice reference cleanly (no dead ternary artifact) when no invoice is linked", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { partner, project } = await makePartnerAndProject();

    const commission = await prisma.commission.create({
      data: { partnerId: partner.id, projectId: project.id, amount: 75, status: "PENDING" },
    });
    createdCommissionIds.push(commission.id);

    await commissionService.markPaid(commission.id);

    const message = await getEnqueuedMessage(commission.id, partner.id);
    assert.ok(message, "markPaid must enqueue a real COMMISSION_PAID notification");
    assert.match(message!, /75\.000 TND a été versée\./, "message must still include the amount and currency, with no invoice reference and no double space");
    assert.doesNotMatch(message!, /facture/, "message must not mention an invoice when none is linked");
  });
});
