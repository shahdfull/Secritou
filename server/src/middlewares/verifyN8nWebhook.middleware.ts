import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { verifyN8nSignature } from "../utils/webhook.js";
import { HttpError } from "../utils/httpError.js";
import { getRedisClient } from "../cache/redis.js";
import logger from "../utils/logger.js";

// A signature is a deterministic function of the exact request bytes, so "this signature was
// already accepted recently" is equivalent to "this exact request was already processed" —
// used as a replay guard since the callback body has no timestamp/nonce field we control (it's
// produced by the n8n workflow, not by notifyN8n's own outbound envelope). Fails open (allows
// the request) if Redis is unreachable/disabled: this is a defense-in-depth replay guard, not
// the primary auth control (HMAC signature verification still applies unconditionally below).
const REPLAY_WINDOW_SECONDS = 5 * 60;

async function markSignatureSeen(signature: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (!redis) return true;
    const key = `n8n:webhook:seen:${signature}`;
    const wasSet = await redis.set(key, "1", { NX: true, EX: REPLAY_WINDOW_SECONDS });
    return wasSet !== null;
  } catch (err) {
    logger.warn({ err }, "[verifyN8nWebhook] Replay-guard check failed, allowing request");
    return true;
  }
}

/**
 * Gates routes that n8n workflows call back into (e.g. pushing an AI-generated result).
 * Requires N8N_WEBHOOK_SECRET to be configured — the same shared secret used to sign
 * outbound events in notifyN8n. Signature is computed over the raw JSON bytes (see
 * app.ts's express.json({ verify }) which populates req.rawBody).
 */
export const verifyN8nWebhook: RequestHandler = async (req, _res, next) => {
  if (!env.N8N_WEBHOOK_SECRET) {
    next(new HttpError(503, "n8n callback endpoint disabled : set N8N_WEBHOOK_SECRET to enable"));
    return;
  }

  const signature = req.headers["x-secritou-signature"] as string | undefined;
  const rawBody = req.rawBody;

  if (!rawBody || !signature || !verifyN8nSignature(rawBody, signature)) {
    next(new HttpError(401, "Invalid or missing signature"));
    return;
  }

  if (!(await markSignatureSeen(signature))) {
    next(new HttpError(401, "This request has already been processed", "REPLAYED_WEBHOOK"));
    return;
  }

  next();
};
