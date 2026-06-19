// Analytics Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { sqlDateRange } from "../utils/sqlHelpers.js";
import { startOfBusinessMonth } from "../utils/dateRange.js";

function getPreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - duration),
    to: new Date(to.getTime() - duration),
  };
}

export const analyticsRepository = {
  async getLeadStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const wonCount = byStatus.find((s) => s.status === "WON")?.count || 0;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    // Get previous period stats for growth calculation
    let previousConversionRate = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const previousWhere = {
        companyId,
        createdAt: {
          gte: previous.from,
          lte: previous.to,
        },
      };
      const [prevTotal, prevByStatusRaw] = await Promise.all([
        prisma.lead.count({ where: previousWhere }),
        prisma.lead.groupBy({
          by: ["status"],
          where: previousWhere,
          _count: { status: true },
        }),
      ]);
      const prevWonCount = prevByStatusRaw.find((s) => s.status === "WON")?._count?.status || 0;
      previousConversionRate = prevTotal > 0 ? Math.round((prevWonCount / prevTotal) * 100) : 0;
    }

    return { total, byStatus, wonCount, conversionRate, previousConversionRate };
  },

  async getClientStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    // Month boundary computed in the business timezone (not server-local) so "new this month"
    // is not off-by-one near month edges.
    const startOfMonth = startOfBusinessMonth();
    const monthFrom = from && from > startOfMonth ? from : startOfMonth;

    const [total, newThisMonth] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.count({
        where: {
          companyId,
          createdAt: {
            gte: monthFrom,
            ...(to && { lte: to }),
          },
        },
      }),
    ]);

    // Get previous period stats
    let previousNew = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      previousNew = await prisma.client.count({
        where: {
          companyId,
          createdAt: {
            gte: previous.from,
            lte: previous.to,
          },
        },
      });
    }

    return { total, newThisMonth, previousNew };
  },

  async getProjectStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const completedCount = byStatus.find((s) => s.status === "COMPLETED")?.count || 0;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // Get previous period stats
    let previousCompletionRate = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const previousWhere = {
        companyId,
        createdAt: {
          gte: previous.from,
          lte: previous.to,
        },
      };
      const [prevTotal, prevByStatusRaw] = await Promise.all([
        prisma.project.count({ where: previousWhere }),
        prisma.project.groupBy({
          by: ["status"],
          where: previousWhere,
          _count: { status: true },
        }),
      ]);
      const prevCompletedCount = prevByStatusRaw.find((s) => s.status === "COMPLETED")?._count?.status || 0;
      previousCompletionRate = prevTotal > 0 ? Math.round((prevCompletedCount / prevTotal) * 100) : 0;
    }

    return { total, byStatus, completedCount, completionRate, previousCompletionRate };
  },

  async getTaskStats(companyId: string, from?: Date, to?: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ total: bigint; doneCount: bigint; overdueCount: bigint }>
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE t.status = 'DONE')::bigint AS "doneCount",
        COUNT(*) FILTER (
          WHERE t."dueDate" < NOW() AND t.status != 'DONE'
        )::bigint AS "overdueCount"
      FROM "Task" t
      INNER JOIN "Project" p ON p.id = t."projectId"
      WHERE p."companyId" = ${companyId}
      ${sqlDateRange("createdAt", from, to, "t")}
    `;

    const row = rows[0];
    const total = Number(row?.total ?? 0);
    const doneCount = Number(row?.doneCount ?? 0);
    const taskDonePct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    // Get previous period stats
    let previousTaskDonePct = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const prevRows = await prisma.$queryRaw<
        Array<{ total: bigint; doneCount: bigint }>
      >`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE t.status = 'DONE')::bigint AS "doneCount"
        FROM "Task" t
        INNER JOIN "Project" p ON p.id = t."projectId"
        WHERE p."companyId" = ${companyId}
        AND t."createdAt" >= ${previous.from.toISOString()}
        AND t."createdAt" <= ${previous.to.toISOString()}
      `;
      const prevRow = prevRows[0];
      const prevTotal = Number(prevRow?.total ?? 0);
      const prevDone = Number(prevRow?.doneCount ?? 0);
      previousTaskDonePct = prevTotal > 0 ? Math.round((prevDone / prevTotal) * 100) : 0;
    }

    return {
      total,
      doneCount,
      overdueCount: Number(row?.overdueCount ?? 0),
      taskDonePct,
      previousTaskDonePct,
    };
  },

  async getLeadsByMonth(companyId: string, from?: Date, to?: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ month: string; count: bigint; month_num: number }>
    >`
      SELECT
        TO_CHAR("createdAt", 'Mon') AS month,
        COUNT(*)::bigint AS count,
        EXTRACT(MONTH FROM "createdAt")::int AS month_num
      FROM "Lead"
      WHERE "companyId" = ${companyId}
      ${sqlDateRange("createdAt", from, to)}
      GROUP BY month_num, TO_CHAR("createdAt", 'Mon')
      ORDER BY month_num
    `;

    return rows.map((row) => ({
      month: row.month,
      count: Number(row.count),
    }));
  },

  async getProjectsByStatus(companyId: string, from?: Date, to?: Date) {
    const colorMap: Record<string, string> = {
      PLANNING: "#94a3b8",
      IN_PROGRESS: "#2563eb",
      REVIEW: "#f59e0b",
      COMPLETED: "#10b981",
    };

    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const byStatusRaw = await prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    return byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
      color: colorMap[item.status] || "#64748b",
    }));
  },

  async getRevenueByMonth(companyId: string, from?: Date, to?: Date) {
    // "Collected revenue" — actual cash received, summed from individual InvoicePayment rows
    // (so partial payments are included; previously the Invoice-level paidAt filter dropped
    // every PARTIAL invoice). This is the *collected* figure and is intentionally different
    // from "invoiced (confirmed)" in summary.repository — do not conflate or merge them.
    //
    // Buckets are keyed on DATE_TRUNC('month', payment date) including the year, so Jan 2025
    // and Jan 2026 no longer collapse into the same bucket.
    const rows = await prisma.$queryRaw<
      Array<{ bucket: Date; month: string; revenue: number }>
    >`
      SELECT
        DATE_TRUNC('month', ip."paidAt") AS bucket,
        TO_CHAR(ip."paidAt", 'Mon YYYY') AS month,
        COALESCE(SUM(ip."amount"), 0)::float AS revenue
      FROM "InvoicePayment" ip
      INNER JOIN "Invoice" i ON i.id = ip."invoiceId"
      WHERE i."companyId" = ${companyId}
        AND i.status <> 'CANCELLED'
      ${sqlDateRange("paidAt", from, to, "ip")}
      GROUP BY bucket, month
      ORDER BY bucket
    `;

    return rows.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
    }));
  },
};
