import { google } from "googleapis";
import { gscConnectionRepository } from "../repositories/gscConnection.repository.js";
import { metricSnapshotRepository, type MetricSnapshotInput } from "../repositories/metricSnapshot.repository.js";
import { createOAuthClient, refreshAccessToken } from "./googleOAuth.service.js";
import { encryptSecret, decryptSecret } from "../utils/encryption.js";
import { roundMoney } from "../utils/vat.js";
import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";
import { userRepository } from "../repositories/user.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { env } from "../config/env.js";
import { gscTokenRevocations, gscSyncErrors } from "../observability/metrics.js";
import { detectClickAnomalies } from "./metricAnomaly.service.js";
import { notifyN8n } from "../utils/webhook.js";

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function handleGscRevocation(clientId: string, siteUrl?: string) {
  logger.warn({ clientId }, "[searchConsole] GSC connection revoked");
  gscTokenRevocations.inc({ clientId });
  // Disconnect the GSC connection
  await gscConnectionRepository.disconnect(clientId);
  // Notify all admins
  const admins = await userRepository.findAdmins();
  const gscUrl = `${env.FRONTEND_URL}/app/settings?tab=search-console`;
  await enqueueNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      title: "Connexion Search Console révoquée",
      message: `La connexion Google Search Console pour le client ${clientId} (${siteUrl ?? "non spécifié"}) a été révoquée. Veuillez reconnecter.`,
      type: "GENERAL" as const,
      entityId: clientId,
      link: gscUrl,
    }))
  );

  const client = await clientRepository.findById(clientId).catch(() => null);
  void notifyN8n("gsc.connection_revoked", {
    clientId,
    clientName: client?.name,
    siteUrl,
    adminUrl: gscUrl,
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
  });
}

async function getAuthorizedClient(clientId: string) {
  const connection = await gscConnectionRepository.findByClientId(clientId);
  if (!connection) throw new HttpError(404, "No Search Console connection for this client", "GSC_NOT_CONNECTED");

  const refreshToken = decryptSecret(connection.encryptedRefreshToken);
  const stillValid =
    connection.encryptedAccessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() - Date.now() > 60_000;

  const auth = createOAuthClient();
  if (stillValid) {
    auth.setCredentials({ access_token: decryptSecret(connection.encryptedAccessToken!), refresh_token: refreshToken });
  } else {
    try {
      const credentials = await refreshAccessToken(refreshToken);
      if (!credentials.access_token) throw new HttpError(502, "Google did not return an access token on refresh", "GSC_REFRESH_FAILED");
      auth.setCredentials(credentials);
      await gscConnectionRepository.updateAccessToken(
        clientId,
        encryptSecret(credentials.access_token),
        credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3500_000)
      );
    } catch (error) {
      if (error instanceof HttpError && error.code === "GSC_TOKEN_REVOKED") {
        await handleGscRevocation(clientId, connection.siteUrl);
      }
      throw error;
    }
  }

  return { auth, siteUrl: connection.siteUrl };
}

// Pulls the last full day's aggregate clicks/impressions/ctr/position for a client's
// property and stores them as MetricSnapshot rows. Search Console data has a ~2-3 day
// lag, so "yesterday" is not usually complete — callers should sync a few days back.
export async function syncClient(clientId: string, projectId: string | null, periodStart: Date, periodEnd: Date) {
  const connection = await gscConnectionRepository.findByClientId(clientId);
  if (!connection) throw new HttpError(404, "No Search Console connection for this client", "GSC_NOT_CONNECTED");
  
  const { auth, siteUrl } = await getAuthorizedClient(clientId);
  const searchConsole = google.searchconsole({ version: "v1", auth });

  try {
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: toDateOnly(periodStart),
        endDate: toDateOnly(periodEnd),
        dimensions: [],
        type: "web",
      },
    });

    const row = response.data.rows?.[0];
    const rows: MetricSnapshotInput[] = row
      ? [
          { clientId, projectId, source: "GSC", metric: "clicks", value: row.clicks ?? 0, periodStart, periodEnd },
          { clientId, projectId, source: "GSC", metric: "impressions", value: row.impressions ?? 0, periodStart, periodEnd },
          { clientId, projectId, source: "GSC", metric: "ctr", value: roundMoney((row.ctr ?? 0) * 100), periodStart, periodEnd },
          { clientId, projectId, source: "GSC", metric: "position", value: roundMoney(row.position ?? 0), periodStart, periodEnd },
        ]
      : [];

    if (rows.length > 0) await metricSnapshotRepository.upsertMany(rows);
    await gscConnectionRepository.recordSyncSuccess(clientId);
    return rows.length;
  } catch (error) {
    // Check if it's a 401 unauthorized error from Google's API
    const is401Error = (error as { response?: { status?: number } })?.response?.status === 401;
    if (is401Error) {
      await handleGscRevocation(clientId, connection.siteUrl);
    }
    throw error;
  }
}

export async function syncAllConnectedClients() {
  const connections = await gscConnectionRepository.findAll();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() - 3); // GSC lag: avoid pulling an incomplete day
  periodEnd.setHours(0, 0, 0, 0);
  const periodStart = new Date(periodEnd);

  let synced = 0;
  const syncedClientIds: string[] = [];
  for (const connection of connections) {
    try {
      await syncClient(connection.clientId, null, periodStart, periodEnd);
      synced += 1;
      syncedClientIds.push(connection.clientId);
    } catch (err) {
      logger.error({ err, clientId: connection.clientId }, "[searchConsole] Sync failed for client");
      // If it's a GSC_TOKEN_REVOKED or 401 error, we already handled it in syncClient, so don't record error again? Wait no, let's check:
      const isHandledError =
        (err instanceof HttpError && err.code === "GSC_TOKEN_REVOKED") ||
        (err as { response?: { status?: number } })?.response?.status === 401;
      if (!isHandledError) {
        await gscConnectionRepository.recordSyncError(connection.clientId, err instanceof Error ? err.message : String(err));
        gscSyncErrors.inc({ clientId: connection.clientId });
      }
    }
  }

  try {
    const anomalies = await detectClickAnomalies(syncedClientIds);
    if (anomalies.length > 0) {
      void notifyN8n("gsc.anomaly_detected", {
        agencyEmail: env.CONTACT_RECEIVER_EMAIL,
        anomalies: anomalies.map((a) => ({
          clientId: a.clientId,
          clientName: a.clientName,
          latestClicks: a.latestValue,
          baselineAverage: a.baselineAverage,
          changePct: Math.round(a.changePct * 100),
          direction: a.direction,
          adminUrl: `${env.FRONTEND_URL}/app/clients/${a.clientId}`,
        })),
      });
    }
  } catch (err) {
    logger.error({ err }, "[searchConsole] Anomaly detection failed");
  }

  return { total: connections.length, synced };
}
