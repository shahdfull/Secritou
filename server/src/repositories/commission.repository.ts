import { prisma, prismaRead } from "../config/prisma.js";
import type { CommissionStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const commissionRepository = {
  // ─── Splits ───────────────────────────────────────────────────────────────

  async getSplitsByProject(projectId: string) {
    return prismaRead.projectCommissionSplit.findMany({
      where: { projectId },
      include: { partner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async getSplitsByProjectTx(tx: TxClient, projectId: string) {
    return tx.projectCommissionSplit.findMany({ where: { projectId } });
  },

  // A single partner's own split on a project — used for the MANAGER "your share"
  // badge, which must not reveal other partners' rates.
  async getSplitForPartner(projectId: string, partnerId: string) {
    return prismaRead.projectCommissionSplit.findFirst({ where: { projectId, partnerId } });
  },

  async setSplits(projectId: string, splits: { partnerId: string; ratePct: number }[]) {
    return prisma.$transaction(async (tx) => {
      await tx.projectCommissionSplit.deleteMany({ where: { projectId } });
      if (splits.length === 0) return [];
      await tx.projectCommissionSplit.createMany({
        data: splits.map((s) => ({ projectId, partnerId: s.partnerId, ratePct: s.ratePct })),
      });
      return tx.projectCommissionSplit.findMany({ where: { projectId } });
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
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
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

  async findById(id: string) {
    return prismaRead.commission.findUnique({ 
      where: { id },
      include: { partner: { select: { id: true, name: true, email: true } }, project: { select: { id: true, name: true } }, invoice: { select: { id: true, number: true } } }
    });
  },

  async markPaid(id: string) {
    return prisma.commission.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
      include: { partner: { select: { id: true, name: true, email: true } }, project: { select: { id: true, name: true } }, invoice: { select: { id: true, number: true } } }
    });
  },
};
