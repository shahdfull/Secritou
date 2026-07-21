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

  // SEC-169: one grouped query instead of one findMany per client — bounded by a 14-day window
  // (comfortably covers the "latest day + 7-day trailing baseline" = 8 rows/client this used to
  // fetch with `take: 8`), then grouped and truncated to 8 per client in memory.
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const allSnapshots = await prismaRead.metricSnapshot.findMany({
    where: { clientId: { in: clientIds }, source: "GSC", metric: "clicks", dimension: "", periodStart: { gte: fourteenDaysAgo } },
    orderBy: { periodStart: "desc" },
    select: { clientId: true, value: true, periodStart: true, client: { select: { name: true } } },
  });

  const byClient = new Map<string, typeof allSnapshots>();
  for (const snapshot of allSnapshots) {
    const list = byClient.get(snapshot.clientId) ?? [];
    if (list.length < 8) {
      // already ordered periodStart desc from the query above
      list.push(snapshot);
      byClient.set(snapshot.clientId, list);
    }
  }

  const anomalies: MetricAnomaly[] = [];

  for (const clientId of clientIds) {
    const snapshots = byClient.get(clientId) ?? [];
    if (snapshots.length < 2) continue; // not enough history to compare

    const [latest, ...baseline] = snapshots;
    if (baseline.length === 0) continue;

    const baselineAverage = baseline.reduce((sum, s) => sum + Number(s.value), 0) / baseline.length;
    if (baselineAverage === 0) continue; // avoid divide-by-zero on a client with no prior clicks

    const latestValue = Number(latest!.value);
    const changePct = (latestValue - baselineAverage) / baselineAverage;

    if (Math.abs(changePct) >= env.GSC_ANOMALY_THRESHOLD_PCT) {
      anomalies.push({
        clientId,
        clientName: latest!.client?.name ?? null,
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
