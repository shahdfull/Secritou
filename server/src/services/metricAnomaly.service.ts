import { prismaRead } from "../config/prisma.js";
import { env } from "../config/env.js";

export type MetricAnomaly = {
  clientId: string;
  clientName: string | null;
  metric: string;
  latestValue: number;
  baselineAverage: number;
  changePct: number;
  direction: "up" | "down";
};

/**
 * Compares each client's most recent GSC "clicks" snapshot against the trailing 7-day
 * average of the snapshots immediately before it. Flags a client when the deviation exceeds
 * GSC_ANOMALY_THRESHOLD_PCT — a sudden traffic drop/spike is the signal worth surfacing to
 * the agency, not the raw numbers (already visible on the client dashboard).
 */
export async function detectClickAnomalies(clientIds: string[]): Promise<MetricAnomaly[]> {
  if (clientIds.length === 0) return [];

  const anomalies: MetricAnomaly[] = [];

  for (const clientId of clientIds) {
    const snapshots = await prismaRead.metricSnapshot.findMany({
      where: { clientId, source: "GSC", metric: "clicks", dimension: "" },
      orderBy: { periodStart: "desc" },
      take: 8, // latest day + 7-day trailing baseline
      select: { value: true, periodStart: true, client: { select: { name: true } } },
    });

    if (snapshots.length < 2) continue; // not enough history to compare

    const [latest, ...baseline] = snapshots;
    if (baseline.length === 0) continue;

    const baselineAverage = baseline.reduce((sum, s) => sum + Number(s.value), 0) / baseline.length;
    if (baselineAverage === 0) continue; // avoid divide-by-zero on a client with no prior clicks

    const latestValue = Number(latest.value);
    const changePct = (latestValue - baselineAverage) / baselineAverage;

    if (Math.abs(changePct) >= env.GSC_ANOMALY_THRESHOLD_PCT) {
      anomalies.push({
        clientId,
        clientName: latest.client?.name ?? null,
        metric: "clicks",
        latestValue,
        baselineAverage: Math.round(baselineAverage * 100) / 100,
        changePct: Math.round(changePct * 1000) / 1000,
        direction: changePct >= 0 ? "up" : "down",
      });
    }
  }

  return anomalies;
}
