import { prismaRead } from "../config/prisma.js";

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

const CONVERSION_RATE = 0.3;

async function getPeriodForecast(cutoffDays: number): Promise<ForecastPeriod> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + cutoffDays * 86_400_000);

  const [invoicesRaw, proposalsRaw] = await Promise.all([
    prismaRead.invoice.findMany({
      where: {
        status: { in: ["SENT", "PARTIAL"] },
        dueDate: { gte: now, lte: cutoff },
      },
      select: { amount: true },
    }),
    prismaRead.proposal.findMany({
      where: { status: { in: ["SENT", "VIEWED"] } },
      select: { amount: true },
    }),
  ]);

  const invoicesDue = invoicesRaw.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const proposalsPending = proposalsRaw.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const projectedRevenue = Math.round((invoicesDue + proposalsPending * CONVERSION_RATE) * 100) / 100;

  return { invoicesDue, proposalsPending, projectedRevenue };
}

export const revenueForecastRepository = {
  async getForecast(): Promise<RevenueForecastData> {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86_400_000);

    const [p30, p60, p90, overdueRaw, byClientRaw] = await Promise.all([
      getPeriodForecast(30),
      getPeriodForecast(60),
      getPeriodForecast(90),
      prismaRead.invoice.findMany({
        where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } },
        select: { amount: true },
      }),
      prismaRead.invoice.groupBy({
        by: ["clientId"],
        where: {
          status: { in: ["SENT", "PARTIAL"] },
          dueDate: { gte: now, lte: in90 },
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
