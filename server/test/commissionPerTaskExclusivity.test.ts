// RG-028 (REFERENTIEL.md §5) : un projet en mode PER_TASK est rémunéré à la tâche, jamais en
// pourcentage du paiement encaissé. computeForPaymentTx doit lire
// project.commissionSplitMode et retourner [] immédiatement pour ce mode — sinon un
// encaissement génère des commissions au pourcentage EN PLUS des paiements par tâche.
//
// Ce test importe et appelle réellement invoiceService.addPayment contre une base réelle —
// pas une réimplémentation — sur un projet PER_TASK qui porte encore des
// ProjectCommissionSplit résiduels (état transitoire juste après la bascule), et vérifie
// qu'aucune Commission n'est créée.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let invoiceService: typeof import("../src/services/invoice.service.js").invoiceService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ invoiceService } = await import("../src/services/invoice.service.js"));
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
  await prisma.commission.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.projectCommissionSplit.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.payment.deleteMany({ where: { invoice: { projectId: { in: createdProjectIds } } } });
  await prisma.invoice.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("RG-028 : no PROJECT_PERCENT commission for a PER_TASK project, even with residual splits", () => {
  test("a real payment on a PER_TASK project with residual ProjectCommissionSplit rows creates zero Commission", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const client = await prisma.client.create({ data: { name: "rg028 client", serviceId } });
    createdClientIds.push(client.id);
    const partner = await prisma.user.create({
      data: { email: `rg028-${Date.now()}@example.com`, name: "rg028 partner", passwordHash: "x", role: "MANAGER", serviceId },
    });
    createdUserIds.push(partner.id);
    const project = await prisma.project.create({
      data: { name: "rg028 project", clientId: client.id, serviceId, commissionSplitMode: "PER_TASK" },
    });
    createdProjectIds.push(project.id);
    // Residual split left over from before the bascule — must not resurrect a % commission.
    await prisma.projectCommissionSplit.create({ data: { projectId: project.id, partnerId: partner.id, ratePct: 50 } });

    const invoice = await prisma.invoice.create({
      data: { number: `RG028-${Date.now()}`, title: "Test", amount: 1000, amountPaid: 0, status: "SENT", currency: "TND", projectId: project.id, clientId: project.clientId! },
    });

    await invoiceService.addPayment(invoice.id, { amount: 400 }, undefined, undefined);

    const commissions = await prisma.commission.findMany({ where: { invoiceId: invoice.id } });
    assert.equal(commissions.length, 0, "PER_TASK mode must block any PROJECT_PERCENT commission, regardless of residual splits");
  });
});
