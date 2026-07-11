import crypto from "crypto";
import { google } from "googleapis";
import { gscConnectionRepository } from "../repositories/gscConnection.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { buildConsentUrl, createOAuthClient, exchangeCodeForTokens } from "./googleOAuth.service.js";
import { encryptSecret } from "../utils/encryption.js";
import { HttpError } from "../utils/httpError.js";
import { getRedisClient } from "../cache/redis.js";
import { env } from "../config/env.js";

const PENDING_TTL_SECONDS = 10 * 60;

function pendingKey(pendingId: string): string {
  return `gsc:pending:${pendingId}`;
}

// Short-lived signed state so the OAuth callback can be traced back to the client
// it was initiated for, without a server-side session. HMAC prevents a caller from
// forging a state that points at a different clientId (which would attach someone
// else's Google property to their own client record via CSRF).
const STATE_TTL_MS = 10 * 60_000;

function stateSecret(): string {
  // Reuses INTEGRATIONS_ENCRYPTION_KEY as the HMAC key — separate concerns (encryption
  // vs signing) but both are "integrations" secrets already gated by the same env var.
  if (!env.INTEGRATIONS_ENCRYPTION_KEY) {
    throw new HttpError(500, "INTEGRATIONS_ENCRYPTION_KEY is not configured", "ENCRYPTION_KEY_MISSING");
  }
  return env.INTEGRATIONS_ENCRYPTION_KEY;
}

function signState(payload: string): string {
  return crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

export function buildState(clientId: string, initiatedById: string): string {
  const payload = JSON.stringify({ clientId, initiatedById, ts: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
}

export function parseState(state: string): { clientId: string; initiatedById: string } {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || signState(encoded) !== signature) {
    throw new HttpError(400, "Invalid or tampered OAuth state", "OAUTH_STATE_INVALID");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (Date.now() - payload.ts > STATE_TTL_MS) {
    throw new HttpError(400, "OAuth consent expired, please restart the connection", "OAUTH_STATE_EXPIRED");
  }
  return { clientId: payload.clientId, initiatedById: payload.initiatedById };
}

export const gscConnectionService = {
  async startConnect(clientId: string, initiatedById: string) {
    const client = await clientRepository.findById(clientId);
    if (!client) throw new HttpError(404, "Client not found");
    const state = buildState(clientId, initiatedById);
    return { url: buildConsentUrl(state) };
  },

  // After the OAuth callback exchanges the code for tokens, the caller still needs to
  // pick which Search Console property to attach (a Google account can have several).
  // Tokens are cached server-side (short TTL) and only an opaque pendingId + the site
  // list are returned to the browser — the raw refresh/access tokens never transit
  // through the client.
  async listAvailableSites(clientId: string, code: string) {
    const tokens = await exchangeCodeForTokens(code);
    const auth = createOAuthClient();
    auth.setCredentials(tokens);
    const searchConsole = google.searchconsole({ version: "v1", auth });
    const { data } = await searchConsole.sites.list();

    const redis = await getRedisClient();
    if (!redis) throw new HttpError(503, "Redis is unavailable, cannot complete OAuth connection", "REDIS_UNAVAILABLE");
    const pendingId = crypto.randomUUID();
    await redis.set(
      pendingKey(pendingId),
      JSON.stringify({ clientId, refreshToken: tokens.refresh_token, accessToken: tokens.access_token, expiryDate: tokens.expiry_date }),
      { EX: PENDING_TTL_SECONDS }
    );

    return {
      pendingId,
      sites: (data.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel })),
    };
  },

  async completeConnect(clientId: string, connectedById: string, pendingId: string, siteUrl: string) {
    const redis = await getRedisClient();
    if (!redis) throw new HttpError(503, "Redis is unavailable, cannot complete OAuth connection", "REDIS_UNAVAILABLE");
    const raw = await redis.get(pendingKey(pendingId));
    if (!raw) throw new HttpError(400, "This connection request has expired, please restart it", "GSC_PENDING_EXPIRED");
    const pending = JSON.parse(raw) as { clientId: string; refreshToken: string; accessToken?: string; expiryDate?: number };
    if (pending.clientId !== clientId) {
      throw new HttpError(403, "This connection request does not belong to this client", "GSC_PENDING_CLIENT_MISMATCH");
    }
    await redis.del(pendingKey(pendingId));

    const connection = await gscConnectionRepository.upsert(clientId, {
      siteUrl,
      encryptedRefreshToken: encryptSecret(pending.refreshToken),
      encryptedAccessToken: pending.accessToken ? encryptSecret(pending.accessToken) : undefined,
      accessTokenExpiresAt: pending.expiryDate ? new Date(pending.expiryDate) : undefined,
      connectedById,
    });
    return connection;
  },

  async getStatus(clientId: string) {
    const connection = await gscConnectionRepository.findByClientId(clientId);
    if (!connection) return { connected: false as const };
    return {
      connected: true as const,
      siteUrl: connection.siteUrl,
      lastSyncedAt: connection.lastSyncedAt,
      lastSyncError: connection.lastSyncError,
    };
  },

  async disconnect(clientId: string) {
    const connection = await gscConnectionRepository.findByClientId(clientId);
    if (!connection) throw new HttpError(404, "No Search Console connection for this client");
    await gscConnectionRepository.disconnect(clientId);
  },
};
