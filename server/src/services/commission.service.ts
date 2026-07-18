import { commissionRepository } from "../repositories/commission.repository.js";
import { HttpError } from "../utils/httpError.js";
import { roundMoney } from "../utils/vat.js";
import { prisma, prismaRead } from "../config/prisma.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { env } from "../config/env.js";
import { notifyN8n } from "../utils/webhook.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const commissionService = {
  async getSplitsByProject(projectId: string) {
    return commissionRepository.getSplitsByProject(projectId);
  },

  // "Your share" for a MANAGER — returns their own split only, or null if unset,
  // never the other partners' rates on the same project.
  async getMySplitForProject(projectId: string, partnerId: string) {
    return commissionRepository.getSplitForPartner(projectId, partnerId);
  },

  // Replaces the full set of splits for a project. Rates are per-project manual
  // assignments (e.g. 70-30 or 50-50 between the partners) — no fixed company-wide
  // rule, so this is set explicitly per deal rather than derived.
  async setSplits(projectId: string, splits: { partnerId: string; ratePct: number }[]) {
    const project = await prismaRead.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new HttpError(404, "Project not found");

    const total = splits.reduce((sum, s) => sum + s.ratePct, 0);
    if (splits.some((s) => s.ratePct <= 0)) {
      throw new HttpError(422, "Each commission rate must be greater than 0", "INVALID_COMMISSION_RATE");
    }
    if (total > 100) {
      throw new HttpError(422, `Commission rates sum to ${total}%, which exceeds 100%`, "COMMISSION_RATES_EXCEED_100");
    }
    const partnerIds = new Set(splits.map((s) => s.partnerId));
    if (partnerIds.size !== splits.length) {
      throw new HttpError(422, "Duplicate partner in commission splits", "DUPLICATE_COMMISSION_PARTNER");
    }

    return commissionRepository.setSplits(projectId, splits);
  },

  // Called from invoice.service.ts addPayment() inside the same transaction, once a
  // payment has been recorded — this is the "paiement encaissé" trigger. Computes one
  // Commission row per partner assigned to the project, prorated on the amount actually
  // received for this payment (not the invoice's cumulative amountPaid), so a deposit
  // payment and a later balance payment each produce their own commissions.
  async computeForPaymentTx(
    tx: TxClient,
    args: { paymentId: string; invoiceId: string; projectId: string | null; amountReceived: number }
  ) {
    if (!args.projectId || args.amountReceived <= 0) return [];

    const splits = await commissionRepository.getSplitsByProjectTx(tx, args.projectId);
    if (splits.length === 0) return [];

    const rows = splits.map((split) => {
      const ratePct = Number(split.ratePct);
      const amount = roundMoney(args.amountReceived * (ratePct / 100));
      return {
        partnerId: split.partnerId,
        projectId: args.projectId!,
        invoiceId: args.invoiceId,
        paymentId: args.paymentId,
        basis: roundMoney(args.amountReceived),
        ratePct,
        amount,
      };
    });

    return commissionRepository.createManyTx(tx, rows);
  },

  async getAll(options: ListQueryOptions & { partnerId?: string; status?: "PENDING" | "PAID" }) {
    return commissionRepository.getAll(options);
  },

  // Summary for the "à verser par associé" screen: total owed (PENDING) and total
  // already paid out, grouped by partner.
  async getOwedSummary() {
    const grouped = await commissionRepository.getOwedByPartner();
    const byPartner = new Map<string, { partnerId: string; pending: number; paid: number }>();
    for (const row of grouped) {
      const entry = byPartner.get(row.partnerId) ?? { partnerId: row.partnerId, pending: 0, paid: 0 };
      const sum = Number(row._sum.amount ?? 0);
      if (row.status === "PENDING") entry.pending = sum;
      else if (row.status === "PAID") entry.paid = sum;
      byPartner.set(row.partnerId, entry);
    }
    return Array.from(byPartner.values());
  },

  // Owed summary for a single partner (self-service view for a MANAGER checking
  // their own payout) — same shape as getOwedSummary() but scoped to one partnerId.
  async getOwedSummaryForPartner(partnerId: string) {
    const grouped = await commissionRepository.getOwedByPartner(partnerId);
    const summary = { partnerId, pending: 0, paid: 0 };
    for (const row of grouped) {
      const sum = Number(row._sum.amount ?? 0);
      if (row.status === "PENDING") summary.pending = sum;
      else if (row.status === "PAID") summary.paid = sum;
    }
    return summary;
  },

  async markPaid(id: string) {
    const commission = await commissionRepository.findById(id);
    if (!commission) throw new HttpError(404, "Commission not found");
    if (commission.status === "PAID") throw new HttpError(409, "Commission already marked as paid", "COMMISSION_ALREADY_PAID");
    const updatedCommission = await commissionRepository.markPaid(id);
    
    // Send COMMISSION_PAID notification to the partner
    const commissionUrl = `${env.FRONTEND_URL}/admin/commissions`;
    await enqueueNotifications([{
      userId: updatedCommission.partnerId,
      title: "Commission versée",
      message: `Votre commission de ${Number(updatedCommission.amount).toFixed(3)} ${updatedCommission.invoice?.number ? "" : ""} a été versée.`,
      type: "COMMISSION_PAID" as const,
      entityId: updatedCommission.id,
      link: commissionUrl,
    }]);

    void notifyN8n("commission.paid", {
      commissionId: updatedCommission.id,
      freelancerId: updatedCommission.partnerId,
      freelancerEmail: updatedCommission.partner?.email,
      freelancerName: updatedCommission.partner?.name,
      amount: Number(updatedCommission.amount),
      currency: "TND",
      adminUrl: commissionUrl,
    });

    return updatedCommission;
  },
};
