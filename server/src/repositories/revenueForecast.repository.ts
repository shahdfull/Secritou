import { prismaRead } from "../config/prisma.js";
import { roundMoney } from "../utils/vat.js";
import { DEFAULT_CURRENCY } from "../constants/currency.js";
import { env } from "../config/env.js";

export interface ForecastPeriod {
  invoicesDue: number;
  proposalsPending: number;
  projectedRevenue: number;
}

export interface ClientForecast {
  clientId: string;
  clientName: string;
  amount: number;
  invoicesDue: number;
}

export interface RevenueForecastData {
  next30Days: ForecastPeriod;
  next60Days: ForecastPeriod;
  next90Days: ForecastPeriod;
  overdueAmount: number;
  byClient: ClientForecast[];
}

// Coarse win-probability proxy by proposal status, since there is no per-proposal
// probability field (yet). VIEWED means the client has actually opened it, which is
// a meaningfully stronger signal than a proposal that's merely been SENT.
// Overridable via FORECAST_PROBABILITY_SENT / FORECAST_PROBABILITY_VIEWED — recalibrate
// once there's real conversion data instead of editing this file.
const PROBABILITY_BY_STATUS: Record<string, number> = {
  SENT: env.FORECAST_PROBABILITY_SENT,
  VIEWED: env.FORECAST_PROBABILITY_VIEWED,
};

async function getPeriodForecast(cutoffDays: number, serviceId?: string): Promise<ForecastPeriod> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + cutoffDays * 86_400_000);

  const [invoicesRaw, proposalsRaw] = await Promise.all([
    prismaRead.invoice.findMany({
      where: {
        status: { in: ["SENT", "PARTIAL"] },
        dueDate: { gte: now, lte: cutoff },
        currency: DEFAULT_CURRENCY,
        deletedAt: null,
        client: { deletedAt: null },
        ...(serviceId ? { project: { serviceId } } : {}),
      },
      select: { amount: true },
    }),
    // Bounded by expiresAt (proxy for expected closing date), same as invoicesDue is
    // bounded by dueDate — otherwise the same pipeline value leaks into every window
    // regardless of when it's actually expected to close. Proposals with no expiresAt
    // set have unknown timing: only surfaced in the widest (90-day) window rather than
    // silently dropped from the forecast or double-counted in every window.
    prismaRead.proposal.findMany({
      where: {
        status: { in: ["SENT", "VIEWED"] },
        currency: DEFAULT_CURRENCY,
        ...(cutoffDays >= 90
          ? { OR: [{ expiresAt: { lte: cutoff } }, { expiresAt: null }] }
          : { expiresAt: { gte: now, lte: cutoff } }),
        // A proposal with no linked project is service-neutral / pre-project: only
        // ADMIN (unscoped) sees it in the forecast, same rule as assertProposalInScope.
        ...(serviceId ? { projectId: { not: null }, project: { serviceId } } : {}),
      },
      select: { amount: true, status: true },
    }),
  ]);

  const invoicesDue = invoicesRaw.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const proposalsPending = proposalsRaw.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const weightedProposals = proposalsRaw.reduce(
    (s, p) => s + Number(p.amount ?? 0) * (PROBABILITY_BY_STATUS[p.status] ?? 0),
    0
  );
  const projectedRevenue = roundMoney(invoicesDue + weightedProposals);

  return { invoicesDue, proposalsPending, projectedRevenue };
}

export const revenueForecastRepository = {
  async getForecast(serviceId?: string): Promise<RevenueForecastData> {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86_400_000);

    const [p30, p60, p90, overdueRaw, byClientRaw] = await Promise.all([
      getPeriodForecast(30, serviceId),
      getPeriodForecast(60, serviceId),
      getPeriodForecast(90, serviceId),
      prismaRead.invoice.findMany({
        where: {
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: now },
          currency: DEFAULT_CURRENCY,
          deletedAt: null,
          client: { deletedAt: null },
          ...(serviceId ? { project: { serviceId } } : {}),
        },
        select: { amount: true },
      }),
      prismaRead.invoice.groupBy({
        by: ["clientId"],
        where: {
          status: { in: ["SENT", "PARTIAL"] },
          dueDate: { gte: now, lte: in90 },
          currency: DEFAULT_CURRENCY,
          deletedAt: null,
          client: { deletedAt: null },
          ...(serviceId ? { project: { serviceId } } : {}),
        },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ]);

    const overdueAmount = overdueRaw.reduce((s, i) => s + Number(i.amount ?? 0), 0);

    // Enrich byClient with client names
    const clientIds = byClientRaw.map((r) => r.clientId);
    const clients = await prismaRead.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));

    const byClient: ClientForecast[] = byClientRaw.map((r) => ({
      clientId: r.clientId,
      clientName: clientMap.get(r.clientId) ?? "—",
      amount: Number(r._sum.amount ?? 0),
      invoicesDue: r._count.id,
    }));

    return {
      next30Days: p30,
      next60Days: p60,
      next90Days: p90,
      overdueAmount,
      byClient,
    };
  },
};
