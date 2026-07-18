// RG-008 (REFERENTIEL.md §5) : "Une ligne de commission est créée uniquement lorsqu'un
// paiement (Payment) est effectivement enregistré contre une facture." Le chemin nominal
// (computeForPaymentTx appelé depuis addPayment) était déjà vérifié par lecture directe, mais
// aucun test n'assérait l'exclusivité elle-même — CLAUDE.md exige verifie: test spécifiquement
// pour les affirmations négatives/d'exclusivité, un grep ou la lecture du seul chemin nominal
// ne prouvant jamais qu'aucun autre chemin ne le contourne.
//
// Ce test importe et appelle réellement invoiceService.addPayment contre une base réelle —
// pas une réimplémentation — et vérifie : (1) un paiement réel crée bien une Commission par
// partenaire, proratisée sur le montant réellement appliqué ; (2) un paiement entièrement
// absorbé par un trop-perçu (appliedAmount = 0, cas déjà géré par SEC-022/creditNote) ne crée
// aucune Commission, confirmant que le déclencheur est bien conditionné sur un montant
// réellement appliqué à la facture, pas sur la simple existence d'un Payment.
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

async function makeProjectWithSplit(namePrefix: string, ratePct: number) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const partner = await prisma.user.create({
    data: { email: `${namePrefix}-${Date.now()}@example.com`, name: `${namePrefix} partner`, passwordHash: "x", role: "MANAGER", serviceId },
  });
  createdUserIds.push(partner.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  await prisma.projectCommissionSplit.create({ data: { projectId: project.id, partnerId: partner.id, ratePct } });
  return { client, partner, project };
}

describe("RG-008 : Commission created only when a Payment is actually recorded", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a real payment against an invoice creates exactly one Commission, prorated on the applied amount", async () => {
    const { project } = await makeProjectWithSplit("rg008-a", 50);
    const invoice = await prisma.invoice.create({
      data: { number: `RG008-A-${Date.now()}`, title: "Test", amount: 1000, amountPaid: 0, status: "SENT", currency: "TND", projectId: project.id, clientId: project.clientId },
    });

    await invoiceService.addPayment(invoice.id, { amount: 400 }, undefined, undefined);

    const commissions = await prisma.commission.findMany({ where: { invoiceId: invoice.id } });
    assert.equal(commissions.length, 1, "exactly one Commission row must exist, one per (partner, Payment)");
    assert.equal(Number(commissions[0].basis), 400, "basis must be the amount actually applied to the invoice");
    assert.equal(Number(commissions[0].amount), 200, "amount must be prorated by the split's ratePct (50% of 400)");
  });

  test("a payment fully absorbed as overpayment (appliedAmount = 0) creates no Commission", async () => {
    const { project } = await makeProjectWithSplit("rg008-b", 50);
    // amountPaid already equals amount, but status is left at PARTIAL (not yet recomputed to
    // PAID) — a state addPayment() itself would never leave an invoice in, but reachable here
    // by writing directly, to isolate the appliedAmount = 0 branch: any further payment against
    // this invoice is entirely overpayment (rawAmountPaid > invoiceAmount, newAmountPaid capped
    // at invoiceAmount, so appliedAmount = newAmountPaid - previous amountPaid = 0).
    const invoice = await prisma.invoice.create({
      data: { number: `RG008-B-${Date.now()}`, title: "Test", amount: 500, amountPaid: 500, status: "PARTIAL", currency: "TND", projectId: project.id, clientId: project.clientId },
    });

    await invoiceService.addPayment(invoice.id, { amount: 100 }, undefined, undefined);

    const commissions = await prisma.commission.findMany({ where: { invoiceId: invoice.id } });
    assert.equal(commissions.length, 0, "no Commission must be created when nothing was actually applied to the invoice");
  });
});
