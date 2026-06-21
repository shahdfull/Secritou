import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { env } from "../config/env.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REGION = env.S3_REGION;
const BUCKET = env.S3_BUCKET ?? "";
const ENDPOINT = env.S3_ENDPOINT; // set for MinIO / R2 / Backblaze
const PUBLIC_URL_BASE = env.S3_PUBLIC_URL; // CDN or public bucket URL prefix

const MAX_FILE_SIZE = env.UPLOAD_MAX_BYTES;

// MIME → extension whitelist
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

// Per-context allowed MIME subsets
export const UPLOAD_CONTEXTS = {
  cv: ["application/pdf"],
  portfolio: ["application/pdf", "application/zip", "application/x-zip-compressed"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "text/plain",
  ],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
} as const;

export type UploadContext = keyof typeof UPLOAD_CONTEXTS;

// ---------------------------------------------------------------------------
// S3 client (singleton)
// ---------------------------------------------------------------------------

function buildS3Client(): S3Client {
  if (env.NODE_ENV === "production" && !env.S3_BUCKET) {
    throw new Error("S3_BUCKET is required in production");
  }
  const cfg: ConstructorParameters<typeof S3Client>[0] = { region: REGION };
  if (ENDPOINT) {
    cfg.endpoint = ENDPOINT;
    cfg.forcePathStyle = true; // required for MinIO / R2
  }
  if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    cfg.credentials = {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    };
  }
  return new S3Client(cfg);
}

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) _s3 = buildS3Client();
  return _s3;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface UploadResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

function buildKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".bin";
  return `${folder}/${uuidv4()}${ext}`;
}

function buildPublicUrl(key: string): string {
  if (PUBLIC_URL_BASE) return `${PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
  // Fallback: standard AWS path-style URL
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateUpload(
  mimeType: string,
  size: number,
  context: UploadContext
): void {
  if (size > MAX_FILE_SIZE) {
    throw Object.assign(
      new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB`),
      { statusCode: 413 }
    );
  }
  const allowed = UPLOAD_CONTEXTS[context] as readonly string[];
  if (!allowed.includes(mimeType)) {
    throw Object.assign(
      new Error(
        `File type "${mimeType}" is not allowed for context "${context}". Allowed: ${allowed.join(", ")}`
      ),
      { statusCode: 415 }
    );
  }
  if (!ALLOWED_MIME[mimeType]) {
    throw Object.assign(new Error(`Unsupported MIME type: ${mimeType}`), {
      statusCode: 415,
    });
  }
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  size: number,
  context: UploadContext,
  folder?: string
): Promise<UploadResult> {
  if (!BUCKET) {
    throw Object.assign(
      new Error("S3_BUCKET is not configured. Set S3_BUCKET env var."),
      { statusCode: 500 }
    );
  }

  validateUpload(mimeType, size, context);

  // Verify actual file content matches declared MIME type (defense against spoofed Content-Type)
  const detected = await fileTypeFromBuffer(buffer);
  // Some text/plain files have no magic bytes — only reject if detection succeeds but doesn't match
  if (detected && !ALLOWED_MIME[detected.mime]) {
    throw Object.assign(
      new Error(`Invalid file content (detected: ${detected.mime})`),
      { statusCode: 415 }
    );
  }
  if (detected && detected.mime !== mimeType) {
    const allowed = UPLOAD_CONTEXTS[context] as readonly string[];
    if (!allowed.includes(detected.mime)) {
      throw Object.assign(
        new Error(
          `File content (${detected.mime}) does not match declared type (${mimeType})`
        ),
        { statusCode: 415 }
      );
    }
    // Use the detected MIME instead of the client-supplied one
    mimeType = detected.mime;
  }

  const resolvedFolder = folder ?? context;
  const key = buildKey(resolvedFolder, originalName);

  // Encode original name to base64 for safe storage in S3 metadata (preserves UTF-8)
  const encodedName = Buffer.from(originalName, 'utf8').toString('base64');

  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: size,
        // Private by default — use signed URLs to serve
        ACL: env.S3_PUBLIC_ACL ? "public-read" : "private",
        Metadata: {
          originalName: encodedName,
        },
      })
    );

  } catch (s3Error) {
    throw s3Error;
  }

  const url = env.S3_PUBLIC_ACL
    ? buildPublicUrl(key)
    : await getSignedReadUrl(key, 60 * 60 * 24 * 7); // 7-day signed URL

  return { key, url, originalName, mimeType, size };
}

export async function deleteFile(key: string): Promise<void> {
  if (!BUCKET || !key) return;
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Non-fatal: object may already be gone
  }
}

export async function getSignedReadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!BUCKET) throw Object.assign(new Error("S3_BUCKET is not configured"), { statusCode: 500 });
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(getS3(), command, { expiresIn: expiresInSeconds });
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export const uploadService = {
  upload: uploadFile,
  delete: deleteFile,
  signedUrl: getSignedReadUrl,
  exists: fileExists,
  validate: validateUpload,
};
