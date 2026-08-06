import { prisma, prismaRead } from "../config/prisma.js";
import type { CommissionStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy } from "../utils/listQuery.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// SEC-079: options.orderBy comes straight from req.query.orderBy via parseListQuery, never
// validated — interpolating it directly into Prisma's orderBy turns an unknown field into a 500
// instead of falling back to the default sort, unlike 8+ other repositories already whitelisting
// via buildOrderBy.
const SORTABLE_FIELDS = ["partnerId", "amount", "ratePct", "status", "paidAt", "createdAt"];

export const commissionRepository = {
  // ─── Splits ───────────────────────────────────────────────────────────────

  async getSplitsByProject(projectId: string) {
    return prismaRead.projectCommissionSplit.findMany({
      where: { projectId },
      include: { partner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  // SEC-080: explicit select — the one caller (computeForPaymentTx) only ever reads
  // .partnerId/.ratePct, never .id/.createdAt/.updatedAt that the implicit full-row select
  // otherwise loaded for every row.
  async getSplitsByProjectTx(tx: TxClient, projectId: string) {
    return tx.projectCommissionSplit.findMany({ where: { projectId }, select: { partnerId: true, ratePct: true } });
  },

  // A single partner's own split on a project — used for the MANAGER "your share"
  // badge, which must not reveal other partners' rates.
  async getSplitForPartner(projectId: string, partnerId: string) {
    return prismaRead.projectCommissionSplit.findFirst({ where: { projectId, partnerId } });
  },

  // ─── Auto-split (RG-005-bis) ───────────────────────────────────────────────

  async getProjectForSplit(projectId: string) {
    return prismaRead.project.findUnique({
      where: { id: projectId },
      select: { id: true, serviceId: true, commissionSplitMode: true },
    });
  },

  // RG-030 (refonte paiement à la tâche) : source du pré-remplissage à 65% suggéré côté client
  // pour payoutBudget — jamais persisté automatiquement, seulement affiché comme suggestion que
  // le CEO doit valider explicitement (voir commissionService.getProjectSplitState).
  async getProposalAmountForProject(projectId: string) {
    const project = await prismaRead.project.findUnique({
      where: { id: projectId },
      select: { proposal: { select: { amount: true } } },
    });
    return project?.proposal?.amount ?? null;
  },

  // RG-028: read inside the same transaction as the payment write, so computeForPaymentTx sees
  // a mode switch that may have landed concurrently rather than a stale read-committed snapshot.
  async getProjectSplitModeTx(tx: TxClient, projectId: string) {
    return tx.project.findUnique({ where: { id: projectId }, select: { commissionSplitMode: true } });
  },

  async projectHasAnyCommission(projectId: string) {
    const count = await prismaRead.commission.count({ where: { projectId } });
    return count > 0;
  },

  // RG-030 : lu dans la même transaction que l'écriture d'un payoutAmount, pour que le total
  // reflète l'état réel post-écriture (pas un instantané read-committed potentiellement obsolète
  // si deux écritures concurrentes sur le même projet se chevauchent).
  async getProjectPayoutBudgetTx(tx: TxClient, projectId: string) {
    return tx.project.findUnique({ where: { id: projectId }, select: { payoutBudget: true } });
  },

  // Somme des payoutAmount de toutes les tâches du projet, à l'exclusion de la tâche en cours
  // d'écriture (son nouveau montant est ajouté séparément par l'appelant) — évite de compter
  // deux fois l'ancienne et la nouvelle valeur de la même tâche. excludeTaskId absent (création
  // d'une nouvelle tâche, pas encore d'id) : somme simplement toutes les tâches existantes.
  async sumOtherTasksPayoutAmountTx(tx: TxClient, projectId: string, excludeTaskId?: string) {
    const result = await tx.task.aggregate({
      where: { projectId, ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}), payoutAmount: { not: null } },
      _sum: { payoutAmount: true },
    });
    return Number(result._sum.payoutAmount ?? 0);
  },

  // RG-030 (rappel LOT 5) : ProjectManagerFee.amount rejoint le total contrôlé par l'enveloppe,
  // au même titre que Task.payoutAmount. excludeManagerId absent (création du premier fee pour ce
  // couple projet/manager) : somme simplement tous les fees existants du projet.
  async sumOtherManagerFeesTx(tx: TxClient, projectId: string, excludeManagerId?: string) {
    const result = await tx.projectManagerFee.aggregate({
      where: { projectId, ...(excludeManagerId ? { managerId: { not: excludeManagerId } } : {}) },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },

  async upsertManagerFeeTx(tx: TxClient, args: { projectId: string; managerId: string; amount: number }) {
    return tx.projectManagerFee.upsert({
      where: { projectId_managerId: { projectId: args.projectId, managerId: args.managerId } },
      create: { projectId: args.projectId, managerId: args.managerId, amount: args.amount },
      update: { amount: args.amount },
    });
  },

  // RG-005-bis assumes a single ADMIN account in practice (see CLAUDE.md) — the first one
  // found is the sole recipient of the ADMIN share and of any Manager/Freelancer remainder.
  // SEC-038: findFirst without an orderBy has no guaranteed row order in Postgres — with more
  // than one ADMIN account (RG-021 explicitly allows several), which one receives the ADMIN
  // commission share could vary from call to call. Ordered by createdAt asc so the oldest ADMIN
  // account (the agency's founding admin, first ever created) is always the one picked.
  async getAdminPartnerId() {
    const admin = await prismaRead.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return admin?.id ?? null;
  },

  async getActiveManagersForService(serviceId: string | null) {
    return prismaRead.user.findMany({
      where: { role: "MANAGER", serviceId: serviceId ?? "__none__" },
      select: { id: true },
    });
  },

  async getDistinctAssignedFreelancers(projectId: string) {
    const tasks = await prismaRead.task.findMany({
      where: { projectId, assigneeId: { not: null }, assignee: { role: "FREELANCER" } },
      select: { assigneeId: true },
      distinct: ["assigneeId"],
    });
    return tasks.map((t) => t.assigneeId as string);
  },

  async setSplitsTx(tx: TxClient, projectId: string, splits: { partnerId: string; ratePct: number }[]) {
    await tx.projectCommissionSplit.deleteMany({ where: { projectId } });
    if (splits.length > 0) {
      await tx.projectCommissionSplit.createMany({
        data: splits.map((s) => ({ projectId, partnerId: s.partnerId, ratePct: s.ratePct })),
      });
    }
    return tx.projectCommissionSplit.findMany({ where: { projectId } });
  },

  async setModeTx(
    tx: TxClient,
    projectId: string,
    data: { commissionSplitMode?: "AUTO" | "MANUAL" | "PER_TASK"; commissionSplitDesynced?: boolean }
  ) {
    return tx.project.update({ where: { id: projectId }, data });
  },

  async recordHistoryTx(
    tx: TxClient,
    args: {
      projectId: string;
      trigger: "AUTO_RECALC" | "MANUAL_EDIT" | "MODE_RESET_TO_AUTO" | "MODE_SET_PER_TASK";
      previousSplits: unknown;
      newSplits: unknown;
    }
  ) {
    return tx.commissionSplitHistory.create({
      data: {
        projectId: args.projectId,
        trigger: args.trigger,
        previousSplits: args.previousSplits as Prisma.InputJsonValue,
        newSplits: args.newSplits as Prisma.InputJsonValue,
      },
    });
  },

  async getSplitHistory(projectId: string) {
    return prismaRead.commissionSplitHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  },

  // ─── Commissions ──────────────────────────────────────────────────────────

  async createManyTx(
    tx: TxClient,
    rows: { partnerId: string; projectId: string; invoiceId: string; paymentId: string; basis: number; ratePct: number; amount: number }[]
  ) {
    if (rows.length === 0) return [];
    // SEC-170: createManyAndReturn (Prisma 5.14+) doesn't support `include`, only `select` — the
    // one-row-at-a-time loop this replaced existed only to work around that gap. `select` here
    // reproduces the exact same shape the previous `include` produced.
    return tx.commission.createManyAndReturn({
      data: rows,
      select: {
        id: true,
        partnerId: true,
        projectId: true,
        invoiceId: true,
        paymentId: true,
        basis: true,
        ratePct: true,
        amount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        partner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
      },
    });
  },

  // RG-032 (TASK_FIXED) : une seule ligne par validation de tâche, jamais dans createManyTx
  // (réservé à PROJECT_PERCENT/un paiement) — taskId/baseAmount/coefficient sont propres à ce
  // régime, invoiceId/paymentId/basis/ratePct restent null (colonnes PROJECT_PERCENT).
  async createTaskFixedTx(
    tx: TxClient,
    row: { partnerId: string; projectId: string; taskId: string; baseAmount: number; coefficient: number; amount: number }
  ) {
    return tx.commission.create({
      data: {
        partnerId: row.partnerId,
        projectId: row.projectId,
        taskId: row.taskId,
        baseAmount: row.baseAmount,
        coefficient: row.coefficient,
        amount: row.amount,
        source: "TASK_FIXED",
      },
    });
  },

  async taskHasCommission(taskId: string) {
    const count = await prismaRead.commission.count({ where: { taskId } });
    return count > 0;
  },

  // RG-035 : les ProjectManagerFee fixés à l'avance par le CEO, lus au moment de la livraison
  // pour générer une Commission MANAGER_PROJECT_FEE par fee — jamais avant.
  // SEC-080: explicit select — the one caller (generateManagerFeesOnDeliveryTx) only ever reads
  // .managerId/.amount.
  async getManagerFeesByProjectTx(tx: TxClient, projectId: string) {
    return tx.projectManagerFee.findMany({ where: { projectId }, select: { managerId: true, amount: true } });
  },

  // SEC-080: was a one-row-per-manager await-in-a-loop (createManagerFeeCommissionTx) — the
  // createMany pattern is already established just above in this file for the equivalent
  // PROJECT_PERCENT case (SEC-170, createManyTx). The single caller
  // (generateManagerFeesOnDeliveryTx) never reads the returned rows, so no relations are selected
  // here (unlike createManyTx, whose caller does consume them).
  async createManagerFeeCommissionsManyTx(tx: TxClient, rows: { partnerId: string; projectId: string; amount: number }[]) {
    if (rows.length === 0) return [];
    return tx.commission.createManyAndReturn({
      data: rows.map((row) => ({ ...row, source: "MANAGER_PROJECT_FEE" as const })),
      select: { id: true, partnerId: true, projectId: true, amount: true },
    });
  },

  async projectHasManagerFeeCommission(projectId: string) {
    const count = await prismaRead.commission.count({ where: { projectId, source: "MANAGER_PROJECT_FEE" } });
    return count > 0;
  },

  async getAll(
    options: ListQueryOptions & { partnerId?: string; status?: CommissionStatus }
  ): Promise<PaginatedResult<Prisma.CommissionGetPayload<{ include: { partner: { select: { id: true; name: true; email: true } }; project: { select: { id: true; name: true } }; invoice: { select: { id: true; number: true } } } }>>> {
    const where: Prisma.CommissionWhereInput = {};
    if (options.partnerId) where.partnerId = options.partnerId;
    if (options.status) where.status = options.status;

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prismaRead.commission.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: buildOrderBy(options.orderBy, options.orderDir || "desc", SORTABLE_FIELDS, "createdAt"),
        include: {
          partner: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
        },
      }),
      prismaRead.commission.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async getOwedByPartner(partnerId?: string) {
    return prismaRead.commission.groupBy({
      by: ["partnerId", "status"],
      where: partnerId ? { partnerId } : undefined,
      _sum: { amount: true },
    });
  },

  // SEC-080: markPaid's own pre-check only ever reads .status — the full partner/project/invoice
  // include was never consumed by its one caller (commissionService.markPaid reads the freshly
  // updated row from commissionRepository.markPaid below for that, not this pre-check).
  async findStatusById(id: string) {
    return prismaRead.commission.findUnique({
      where: { id },
      select: { status: true },
    });
  },

  async markPaid(id: string) {
    return prisma.commission.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
      // SEC-078: currency added alongside number — the COMMISSION_PAID notification needs both
      // to build a message consistent with every other money notification in the codebase
      // (e.g. invoice.service.ts's "${amount} ${currency ?? 'TND'}" pattern).
      // SEC-080: project dropped — commissionService.markPaid never reads .project on the
      // returned row (only .partnerId/.amount/.invoice/.partner/.id).
      include: { partner: { select: { id: true, name: true, email: true } }, invoice: { select: { id: true, number: true, currency: true } } }
    });
  },
};
