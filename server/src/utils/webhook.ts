import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import logger from "./logger.js";

const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 2;

function sign(body: string): string {
  return createHmac("sha256", env.N8N_WEBHOOK_SECRET!).update(body).digest("hex");
}

/**
 * Fire-and-forget event notification to n8n. Never throws — a down or slow n8n instance
 * must not block or fail the business operation that triggered it (proposal acceptance,
 * invoice overdue, etc). Callers should call this without awaiting on the critical path,
 * or await it only where the caller already treats failures as non-fatal.
 */
export async function notifyN8n(event: string, payload: Record<string, unknown>): Promise<void> {
  if (!env.N8N_WEBHOOK_BASE_URL) return;

  const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });
  const signature = sign(body);
  const url = `${env.N8N_WEBHOOK_BASE_URL.replace(/\/$/, "")}/${event}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Secritou-Signature": signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`n8n webhook responded ${res.status}`);
      }
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        logger.warn({ err: error, event }, "[n8n] Webhook delivery failed, giving up");
        return;
      }
    }
  }
}

/** Verifies an inbound X-Secritou-Signature header for endpoints n8n calls back into. */
export function verifyN8nSignature(body: string, signatureHeader: string | undefined): boolean {
  if (!env.N8N_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = sign(body);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// SEC-110: a captured, validly-signed callback body was replayable if Redis was down or the
// 5-minute Redis replay window hadn't yet expired — that Redis check was the ONLY anti-replay
// barrier, since the inbound body previously carried no timestamp/nonce we controlled. n8n
// workflows must now include a `timestamp` (epoch ms) in the body they sign before calling back
// (docs/n8n-events.md documents this as part of the callback contract) — this is checked
// independently of Redis, so a stale replay is rejected even with Redis fully unreachable.
export const N8N_CALLBACK_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

/**
 * Verifies the inbound callback body carries a `timestamp` (epoch ms, part of the signed
 * payload) within the freshness window. Returns false on a missing/malformed/non-numeric
 * timestamp, or one outside the window in either direction (a signature can't be replayed
 * forward and a clock-skewed n8n workflow shouldn't silently pass either).
 */
export function verifyN8nTimestamp(rawBody: string, windowMs: number = N8N_CALLBACK_FRESHNESS_WINDOW_MS): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || !("timestamp" in parsed)) return false;
  const timestamp = (parsed as { timestamp: unknown }).timestamp;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  return Math.abs(Date.now() - timestamp) <= windowMs;
}
