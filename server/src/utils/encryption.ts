import crypto from "crypto";
import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

// AES-256-GCM encryption for long-lived secrets stored at rest (OAuth refresh tokens).
// Not used for passwords (those are hashed, never decrypted) — this is for values the
// app must read back later, like Google Search Console refresh tokens.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  if (!env.INTEGRATIONS_ENCRYPTION_KEY) {
    throw new HttpError(500, "INTEGRATIONS_ENCRYPTION_KEY is not configured", "ENCRYPTION_KEY_MISSING");
  }
  const raw = env.INTEGRATIONS_ENCRYPTION_KEY;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new HttpError(500, "INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes", "ENCRYPTION_KEY_INVALID");
  }
  return key;
}

// Format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new HttpError(500, "Malformed encrypted secret", "ENCRYPTION_FORMAT_INVALID");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
