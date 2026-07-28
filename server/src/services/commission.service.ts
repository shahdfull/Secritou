// Deux régimes de rémunération coexistent, par projet, selon Project.commissionSplitMode :
//
// - AUTO/MANUAL (pourcentage projet, RG-005-bis, inchangé par la refonte) : ProjectCommissionSplit
//   porte un ratePct par partenaire, appliqué à chaque paiement encaissé (computeForPaymentTx).
//   AUTO calcule ce split automatiquement (computeAutoSplit) ; MANUAL est saisi à la main par le
//   CEO (setSplits). Génère des Commission source = PROJECT_PERCENT.
//
// - PER_TASK (paiement à la tâche, refonte RG-006 à RG-011) : ProjectCommissionSplit n'a plus de
//   sens et reste vide (purgé par setSplitToPerTask). Deux mécanismes de paiement distincts :
//     - Freelancer/exécutant : Task.payoutAmount fixé par le CEO avant travail (RG-007), modulé
//       par un barème qualité/délai/reprises à la validation (RG-008,
//       computeForTaskValidationTx, appelée depuis task.service.ts dans la même transaction que
//       le passage à DONE). Génère des Commission source = TASK_FIXED.
//     - Manager de pôle : ProjectManagerFee, montant fixe par (projet, manager), exigible
//       seulement à la livraison du projet (RG-011, generateManagerFeesOnDeliveryTx, appelée
//       depuis project.service.ts#clientApprove — seul chemin réel vers COMPLETED). Génère des
//       Commission source = MANAGER_PROJECT_FEE.
//   L'enveloppe totale du projet (Project.payoutBudget) plafonne SUM(Task.payoutAmount) au pire
//   coefficient (1.20x) + SUM(ProjectManagerFee.amount) — voir assertPayoutBudgetNotExceededTx
//   (RG-006). Une même personne peut être Manager ET Freelancer (User.canExecuteAsFreelancer) :
//   ses gains TASK_FIXED et son fee MANAGER_PROJECT_FEE s'additionnent normalement dans
//   getOwedSummary/getOwedSummaryForPartner (agrégés par partnerId, indépendamment de source).
//
// Important : la valeur d'enum MANUAL ne signifie PAS « paiement à la tâche » — c'est PER_TASK
// qui porte ce sens. MANUAL reste, comme avant la refonte, « pourcentages projet saisis à la
// main ». RG-010 : dès qu'au moins une Commission existe sur un projet, son commissionSplitMode
// est verrouillé (COMMISSION_MODE_LOCKED sur setSplits/resetToAutoSplit, ALREADY_PER_TASK/
// COMMISSION_ALREADY_EXISTS sur setSplitToPerTask) — un projet ne change plus jamais de régime de
// paiement une fois de l'argent réellement calculé dessus.
import { commissionRepository } from "../repositories/commission.repository.js";
import { HttpError } from "../utils/httpError.js";
import { roundMoney } from "../utils/vat.js";
import { prisma, prismaRead } from "../config/prisma.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { env } from "../config/env.js";
import { notifyN8n } from "../utils/webhook.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// RG-005-bis: even shares within a bucket, rounded to 2 decimals, with the rounding
// remainder folded into the first recipient so the bucket's total is exact (avoids e.g.
// three managers at 6.67/6.67/6.67 summing to 20.01).
function splitEvenly(totalPct: number, recipientIds: string[]): { partnerId: string; ratePct: number }[] {
  if (recipientIds.length === 0) return [];
  const share = roundMoney(totalPct / recipientIds.length);
  const rows = recipientIds.map((partnerId) => ({ partnerId, ratePct: share }));
  const remainder = roundMoney(totalPct - share * recipientIds.length);
  if (remainder !== 0) rows[0]!.ratePct = roundMoney(rows[0]!.ratePct + remainder);
  return rows;
}

// RG-005-bis calculation: no Freelancer assigned -> ADMIN 80 / Managers 20 (Managers' share
// rolls up to ADMIN if the pole has 0 Manager). At least one Freelancer assigned -> ADMIN 40 /
// Managers 20 / Freelancers 40, same Manager roll-up rule. Managers and Freelancers each split
// their bucket evenly among themselves.
function computeAutoSplit(args: { adminId: string; managerIds: string[]; freelancerIds: string[] }): {
  partnerId: string;
  ratePct: number;
}[] {
  const hasFreelancers = args.freelancerIds.length > 0;
  const managerBucket = 20;
  const freelancerBucket = hasFreelancers ? 40 : 0;
  const adminBucket = hasFreelancers ? 40 : 80;

  const managerRows = args.managerIds.length > 0 ? splitEvenly(managerBucket, args.managerIds) : [];
  const freelancerRows = hasFreelancers ? splitEvenly(freelancerBucket, args.freelancerIds) : [];
  const managerRollup = args.managerIds.length === 0 ? managerBucket : 0;

  const byPartner = new Map<string, number>();
  byPartner.set(args.adminId, adminBucket + managerRollup);
  for (const row of managerRows) byPartner.set(row.partnerId, (byPartner.get(row.partnerId) ?? 0) + row.ratePct);
  for (const row of freelancerRows) byPartner.set(row.partnerId, (byPartner.get(row.partnerId) ?? 0) + row.ratePct);

  return Array.from(byPartner.entries()).map(([partnerId, ratePct]) => ({ partnerId, ratePct }));
}

// RG-006 (refonte paiement à la tâche) : coefficient maximal du barème (RG-008/LOT 4) — le
// plafond est calculé sur ce pire cas pour qu'aucune validation ultérieure ne puisse faire
// dépasser l'enveloppe, même si chaque tâche individuelle passe la validation à un coefficient
// plus bas au moment de son écriture.
const WORST_CASE_COEFFICIENT = 1.20;

// RG-008 (barème) : coefficient = coefDeadline + bonusQualité + malusReprises, borné à
// [0.85, 1.20]. Calculé une seule fois à la validation, jamais recalculé rétroactivement — voir
// computeForTaskValidationTx.
function computeQualityCoefficient(args: { dueDate: Date | null; completedAt: Date; qualityScore: number; reworkCount: number }): number {
  let coefDeadline: number;
  if (!args.dueDate) {
    coefDeadline = 1.00;
  } else {
    const lateMs = args.completedAt.getTime() - args.dueDate.getTime();
    if (lateMs <= 0) coefDeadline = 1.00;
    else if (lateMs <= 24 * 60 * 60 * 1000) coefDeadline = 0.95;
    else coefDeadline = 0.85;
  }

  const bonusQualite = args.qualityScore <= 2 ? -0.05 : args.qualityScore === 3 ? 0.00 : args.qualityScore === 4 ? 0.05 : 0.10;
  const malusReprises = args.reworkCount >= 3 ? -0.05 : 0.00;

  const raw = coefDeadline + bonusQualite + malusReprises;
  return Math.min(WORST_CASE_COEFFICIENT, Math.max(0.85, raw));
}

export const commissionService = {
  async getSplitsByProject(projectId: string) {
    return commissionRepository.getSplitsByProject(projectId);
  },

  // RG-006 : appelé dans la même transaction que toute écriture d'un payoutAmount de Task OU
  // d'un ProjectManagerFee.amount (LOT 5) — le total contrôlé est SUM(Task.payoutAmount) +
  // SUM(ProjectManagerFee.amount), au pire coefficient (1.20x, le max du barème RG-008 ; un fee
  // manager n'est pas soumis au barème mais reste compté au même facteur pour rester sur le pire
  // cas global). Rejette si payoutBudget n'est pas fixé (PAYOUT_BUDGET_NOT_SET) ou si le total
  // dépasserait l'enveloppe (PAYOUT_BUDGET_EXCEEDED). Exactement un des deux candidats
  // (candidatePayoutAmount / candidateManagerFeeAmount) doit être fourni par l'appelant — l'autre
  // terme est lu tel quel en base (les AUTRES tâches / AUTRES managers, jamais celui en cours
  // d'écriture, pour ne pas compter deux fois l'ancienne et la nouvelle valeur).
  async assertPayoutBudgetNotExceededTx(
    tx: TxClient,
    args: {
      projectId: string;
      taskId?: string;
      candidatePayoutAmount?: number;
      managerId?: string;
      candidateManagerFeeAmount?: number;
    }
  ) {
    const project = await commissionRepository.getProjectPayoutBudgetTx(tx, args.projectId);
    if (!project) throw new HttpError(404, "Project not found");
    if (project.payoutBudget === null) {
      throw new HttpError(422, "Project has no payout budget set — the CEO must fix it before any task payout amount", "PAYOUT_BUDGET_NOT_SET");
    }

    const [otherTasksTotal, otherManagerFeesTotal] = await Promise.all([
      commissionRepository.sumOtherTasksPayoutAmountTx(tx, args.projectId, args.taskId),
      commissionRepository.sumOtherManagerFeesTx(tx, args.projectId, args.managerId),
    ]);
    const tasksTotal = otherTasksTotal + (args.candidatePayoutAmount ?? 0);
    const managerFeesTotal = otherManagerFeesTotal + (args.candidateManagerFeeAmount ?? 0);
    const worstCaseTotal = roundMoney((tasksTotal * WORST_CASE_COEFFICIENT) + managerFeesTotal);
    const budget = Number(project.payoutBudget);

    if (worstCaseTotal > budget) {
      throw new HttpError(
        422,
        `Worst-case payout total (${worstCaseTotal}, at the ${WORST_CASE_COEFFICIENT}x quality coefficient) would exceed the project's payout budget (${budget})`,
        "PAYOUT_BUDGET_EXCEEDED"
      );
    }
  },

  async getProjectSplitState(projectId: string) {
    const project = await prismaRead.project.findUnique({
      where: { id: projectId },
      select: { id: true, commissionSplitMode: true, commissionSplitDesynced: true, payoutBudget: true },
    });
    if (!project) throw new HttpError(404, "Project not found");
    const [splits, proposalAmount] = await Promise.all([
      commissionRepository.getSplitsByProject(projectId),
      commissionRepository.getProposalAmountForProject(projectId),
    ]);
    return {
      splits,
      commissionSplitMode: project.commissionSplitMode,
      commissionSplitDesynced: project.commissionSplitDesynced,
      payoutBudget: project.payoutBudget === null ? null : Number(project.payoutBudget),
      // RG-006: 65% of the accepted proposal's amount, surfaced only as a suggestion for the
      // CEO's payout-budget input — never written anywhere automatically (see setProjectPayoutBudget).
      suggestedPayoutBudget: proposalAmount === null ? null : roundMoney(Number(proposalAmount) * 0.65),
    };
  },

  async getSplitHistory(projectId: string) {
    return commissionRepository.getSplitHistory(projectId);
  },

  async taskHasCommission(taskId: string) {
    return commissionRepository.taskHasCommission(taskId);
  },

  // RG-011 : appelé dans la MÊME transaction que le passage du projet à COMPLETED
  // (project.service.ts#clientApprove — seul chemin réel vers ce statut, SEC-081). Génère une
  // Commission MANAGER_PROJECT_FEE par ProjectManagerFee déjà fixé par le CEO sur ce projet.
  // Ne s'exécute qu'en mode PER_TASK — en AUTO/MANUAL, la rémunération manager reste le
  // pourcentage du split, pas un fee fixe. Idempotent au niveau service (skip si déjà généré) en
  // plus de la protection DB (@@unique([projectId, managerId]) sur ProjectManagerFee lui-même,
  // qui empêche deux fees pour le même manager, mais pas un second appel de cette fonction sur un
  // projet qui n'a par ailleurs aucun ProjectManagerFee — projectHasManagerFeeCommission couvre
  // ce cas).
  async generateManagerFeesOnDeliveryTx(tx: TxClient, projectId: string) {
    const project = await commissionRepository.getProjectSplitModeTx(tx, projectId);
    if (project?.commissionSplitMode !== "PER_TASK") return [];

    const fees = await commissionRepository.getManagerFeesByProjectTx(tx, projectId);
    if (fees.length === 0) return [];

    const alreadyGenerated = await commissionRepository.projectHasManagerFeeCommission(projectId);
    if (alreadyGenerated) return [];

    const rows = [];
    for (const fee of fees) {
      const row = await commissionRepository.createManagerFeeCommissionTx(tx, {
        partnerId: fee.managerId,
        projectId,
        amount: Number(fee.amount),
      });
      rows.push(row);
    }
    return rows;
  },

  // RG-006 (rappel LOT 5) : écriture d'un ProjectManagerFee, soumise au même contrôle
  // d'enveloppe qu'un payoutAmount de Task.
  async setManagerFee(projectId: string, managerId: string, amount: number) {
    const project = await prismaRead.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new HttpError(404, "Project not found");
    return prisma.$transaction(async (tx) => {
      await this.assertPayoutBudgetNotExceededTx(tx, {
        projectId,
        managerId,
        candidateManagerFeeAmount: amount,
      });
      return commissionRepository.upsertManagerFeeTx(tx, { projectId, managerId, amount });
    });
  },

  // RG-006 (refonte paiement à la tâche) : l'enveloppe maximale versable sur le projet, fixée
  // explicitement par le CEO. Écriture directe, aucun calcul dérivé — le pré-remplissage à 65%
  // de Proposal.amount est un calcul côté client uniquement (jamais persisté automatiquement),
  // le CEO doit toujours valider explicitement via cet endpoint.
  async setProjectPayoutBudget(projectId: string, payoutBudget: number | null) {
    const project = await prismaRead.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new HttpError(404, "Project not found");
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { payoutBudget },
      select: { id: true, payoutBudget: true },
    });
    return { id: updated.id, payoutBudget: updated.payoutBudget === null ? null : Number(updated.payoutBudget) };
  },

  // Recalculates and overwrites the project's splits per RG-005-bis. No-op (aside from raising
  // the desync flag) when the project is in MANUAL mode — manual edits are never silently
  // overwritten by this path.
  async recalcAutoSplit(projectId: string) {
    const project = await commissionRepository.getProjectForSplit(projectId);
    if (!project) throw new HttpError(404, "Project not found");

    if (project.commissionSplitMode === "MANUAL") {
      await prisma.project.update({ where: { id: projectId }, data: { commissionSplitDesynced: true } });
      return commissionRepository.getSplitsByProject(projectId);
    }

    const adminId = await commissionRepository.getAdminPartnerId();
    if (!adminId) throw new HttpError(422, "No ADMIN account found to receive the commission split", "NO_ADMIN_ACCOUNT");
    const [managers, freelancerIds, previousSplits] = await Promise.all([
      commissionRepository.getActiveManagersForService(project.serviceId),
      commissionRepository.getDistinctAssignedFreelancers(projectId),
      commissionRepository.getSplitsByProject(projectId),
    ]);

    const newSplits = computeAutoSplit({
      adminId,
      managerIds: managers.map((m) => m.id),
      freelancerIds,
    });

    return prisma.$transaction(async (tx) => {
      const saved = await commissionRepository.setSplitsTx(tx, projectId, newSplits);
      await commissionRepository.recordHistoryTx(tx, {
        projectId,
        trigger: "AUTO_RECALC",
        previousSplits,
        newSplits: saved,
      });
      return saved;
    });
  },

  // Repasses a project to AUTO mode: recalculates immediately and clears the desync signal.
  // RG-010 : dès qu'au moins une Commission existe sur ce projet, le mode est verrouillé — sans
  // ce garde-fou, un aller-retour MANUAL/PER_TASK -> AUTO après des tâches déjà payées les
  // repaierait une seconde fois au pourcentage.
  async resetToAutoSplit(projectId: string) {
    const project = await commissionRepository.getProjectForSplit(projectId);
    if (!project) throw new HttpError(404, "Project not found");
    const hasCommission = await commissionRepository.projectHasAnyCommission(projectId);
    if (hasCommission) {
      throw new HttpError(409, "Project already has commissions recorded — commission mode is locked", "COMMISSION_MODE_LOCKED");
    }

    const adminId = await commissionRepository.getAdminPartnerId();
    if (!adminId) throw new HttpError(422, "No ADMIN account found to receive the commission split", "NO_ADMIN_ACCOUNT");
    const [managers, freelancerIds, previousSplits] = await Promise.all([
      commissionRepository.getActiveManagersForService(project.serviceId),
      commissionRepository.getDistinctAssignedFreelancers(projectId),
      commissionRepository.getSplitsByProject(projectId),
    ]);

    const newSplits = computeAutoSplit({
      adminId,
      managerIds: managers.map((m) => m.id),
      freelancerIds,
    });

    return prisma.$transaction(async (tx) => {
      await commissionRepository.setModeTx(tx, projectId, { commissionSplitMode: "AUTO", commissionSplitDesynced: false });
      const saved = await commissionRepository.setSplitsTx(tx, projectId, newSplits);
      await commissionRepository.recordHistoryTx(tx, {
        projectId,
        trigger: "MODE_RESET_TO_AUTO",
        previousSplits,
        newSplits: saved,
      });
      return saved;
    });
  },

  // "Your share" for a MANAGER — returns their own split only, or null if unset,
  // never the other partners' rates on the same project.
  async getMySplitForProject(projectId: string, partnerId: string) {
    return commissionRepository.getSplitForPartner(projectId, partnerId);
  },

  // Replaces the full set of splits for a project. Rates are per-project manual
  // assignments (e.g. 70-30 or 50-50 between the partners) — no fixed company-wide
  // rule, so this is set explicitly per deal rather than derived. Per RG-005-bis, a manual
  // edit switches the project to MANUAL mode (freezing recalcAutoSplit) and clears any
  // pending desync signal, since the CEO's edit is by definition up to date.
  // RG-010 : verrouillé dès qu'au moins une Commission existe sur le projet — même raison que
  // resetToAutoSplit ci-dessus.
  async setSplits(projectId: string, splits: { partnerId: string; ratePct: number }[]) {
    const project = await prismaRead.project.findUnique({ where: { id: projectId }, select: { id: true, commissionSplitMode: true } });
    if (!project) throw new HttpError(404, "Project not found");
    if (project.commissionSplitMode === "PER_TASK") {
      throw new HttpError(409, "Project is in PER_TASK commission mode — percentage splits are not applicable", "PROJECT_IS_PER_TASK");
    }
    const hasCommission = await commissionRepository.projectHasAnyCommission(projectId);
    if (hasCommission) {
      throw new HttpError(409, "Project already has commissions recorded — commission mode is locked", "COMMISSION_MODE_LOCKED");
    }

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

    const previousSplits = await commissionRepository.getSplitsByProject(projectId);
    return prisma.$transaction(async (tx) => {
      await commissionRepository.setModeTx(tx, projectId, { commissionSplitMode: "MANUAL", commissionSplitDesynced: false });
      const saved = await commissionRepository.setSplitsTx(tx, projectId, splits);
      await commissionRepository.recordHistoryTx(tx, {
        projectId,
        trigger: "MANUAL_EDIT",
        previousSplits,
        newSplits: saved,
      });
      return saved;
    });
  },

  // RG-029: switches a project to PER_TASK mode. Purges any residual ProjectCommissionSplit in
  // the same transaction (a % split has no meaning once the project is paid per task) and
  // records the switch in history with newSplits: [] so the purge itself is auditable. Refuses
  // (409) if the project already has a Commission — RG-010's exclusivity assumption is that a
  // project's payment/commission regime doesn't change retroactively once money has actually
  // been computed under the previous regime.
  async setSplitToPerTask(projectId: string) {
    const project = await prismaRead.project.findUnique({ where: { id: projectId }, select: { id: true, commissionSplitMode: true } });
    if (!project) throw new HttpError(404, "Project not found");
    if (project.commissionSplitMode === "PER_TASK") {
      throw new HttpError(409, "Project is already in PER_TASK commission mode", "ALREADY_PER_TASK");
    }
    const hasCommission = await commissionRepository.projectHasAnyCommission(projectId);
    if (hasCommission) {
      throw new HttpError(409, "Project already has commissions recorded — cannot switch commission mode", "COMMISSION_ALREADY_EXISTS");
    }

    const previousSplits = await commissionRepository.getSplitsByProject(projectId);
    return prisma.$transaction(async (tx) => {
      await commissionRepository.setModeTx(tx, projectId, { commissionSplitMode: "PER_TASK", commissionSplitDesynced: false });
      const saved = await commissionRepository.setSplitsTx(tx, projectId, []);
      await commissionRepository.recordHistoryTx(tx, {
        projectId,
        trigger: "MODE_SET_PER_TASK",
        previousSplits,
        newSplits: saved,
      });
      return saved;
    });
  },

  // Called from invoice.service.ts addPayment() inside the same transaction, once a
  // payment has been recorded — this is the "paiement encaissé" trigger. Computes one
  // Commission row per partner assigned to the project, prorated on the amount actually
  // received for this payment (not the invoice's cumulative amountPaid), so a deposit
  // payment and a later balance payment each produce their own commissions.
  //
  // RG-028: a project in PER_TASK mode is paid per Task, never as a % of payments received —
  // returning early here is the only guard against a payment generating a PROJECT_PERCENT
  // commission on top of the per-task payouts.
  async computeForPaymentTx(
    tx: TxClient,
    args: { paymentId: string; invoiceId: string; projectId: string | null; amountReceived: number }
  ) {
    if (!args.projectId || args.amountReceived <= 0) return [];

    const project = await commissionRepository.getProjectSplitModeTx(tx, args.projectId);
    if (project?.commissionSplitMode === "PER_TASK") return [];

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

  // RG-008 : appelé depuis task.service.ts dans la MÊME transaction que le passage à DONE.
  // Ne s'exécute qu'en mode PER_TASK (en mode AUTO/MANUAL, aucune commission de tâche n'est
  // générée — le pourcentage du projet gouverne toujours). Calcule le coefficient une seule
  // fois ; jamais recalculé si qualityScore/reworkCount changent ensuite (une commission déjà
  // créée n'est jamais mise à jour, seulement annulée puis recréée explicitement par le CEO —
  // hors scope automatique). idempotent au niveau DB via @@unique([taskId, partnerId]).
  async computeForTaskValidationTx(
    tx: TxClient,
    args: { taskId: string; projectId: string; partnerId: string; payoutAmount: number; dueDate: Date | null; completedAt: Date; qualityScore: number; reworkCount: number }
  ) {
    const project = await commissionRepository.getProjectSplitModeTx(tx, args.projectId);
    if (project?.commissionSplitMode !== "PER_TASK") return null;

    const coefficient = computeQualityCoefficient({
      dueDate: args.dueDate,
      completedAt: args.completedAt,
      qualityScore: args.qualityScore,
      reworkCount: args.reworkCount,
    });
    const amount = roundMoney(args.payoutAmount * coefficient);

    return commissionRepository.createTaskFixedTx(tx, {
      partnerId: args.partnerId,
      projectId: args.projectId,
      taskId: args.taskId,
      baseAmount: args.payoutAmount,
      coefficient,
      amount,
    });
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
