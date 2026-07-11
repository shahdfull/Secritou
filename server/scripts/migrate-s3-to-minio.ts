import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

// Copies every object from the source bucket (existing AWS S3) into the
// destination bucket (self-hosted MinIO), preserving keys exactly so
// existing Document/PortfolioItem/etc. rows (which store only the key)
// keep resolving correctly once the app's S3_ENDPOINT is switched.
//
// Usage:
//   tsx scripts/migrate-s3-to-minio.ts [--apply] [--prefix=some/folder]
//
// Without --apply the script only lists what it would copy (dry run).
// Safe to re-run: objects already present at the destination (same key,
// same size) are skipped, so an interrupted run can simply be repeated.

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function flagValue(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(name.length + 3);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const dryRun = !hasFlag("--apply");
const prefix = flagValue("prefix");

const sourceClient = new S3Client({
  region: process.env.SRC_S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: requireEnv("SRC_S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("SRC_S3_SECRET_ACCESS_KEY"),
  },
  ...(process.env.SRC_S3_ENDPOINT ? { endpoint: process.env.SRC_S3_ENDPOINT, forcePathStyle: true } : {}),
});
const sourceBucket = requireEnv("SRC_S3_BUCKET");

const destClient = new S3Client({
  region: process.env.DEST_S3_REGION ?? "us-east-1",
  endpoint: requireEnv("DEST_S3_ENDPOINT"),
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv("DEST_S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("DEST_S3_SECRET_ACCESS_KEY"),
  },
});
const destBucket = requireEnv("DEST_S3_BUCKET");

async function destObjectMatches(key: string, size: number): Promise<boolean> {
  try {
    const head = await destClient.send(new HeadObjectCommand({ Bucket: destBucket, Key: key }));
    return head.ContentLength === size;
  } catch {
    return false;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function copyObject(key: string, size: number): Promise<void> {
  const got = await sourceClient.send(new GetObjectCommand({ Bucket: sourceBucket, Key: key }));
  const body = await streamToBuffer(got.Body as Readable);
  await destClient.send(
    new PutObjectCommand({
      Bucket: destBucket,
      Key: key,
      Body: body,
      ContentType: got.ContentType,
      Metadata: got.Metadata,
    })
  );
  void size;
}

async function main() {
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Source: s3://${sourceBucket}${prefix ? `/${prefix}` : ""} (${process.env.SRC_S3_ENDPOINT ?? "AWS S3"})`);
  console.log(`Destination: s3://${destBucket} (${process.env.DEST_S3_ENDPOINT})`);

  let continuationToken: string | undefined;
  let scanned = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  do {
    const page = await sourceClient.send(
      new ListObjectsV2Command({
        Bucket: sourceBucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of page.Contents ?? []) {
      if (!obj.Key || obj.Size === undefined) continue;
      scanned += 1;

      const alreadyThere = await destObjectMatches(obj.Key, obj.Size);
      if (alreadyThere) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] would copy: ${obj.Key} (${obj.Size} bytes)`);
        continue;
      }

      try {
        await copyObject(obj.Key, obj.Size);
        copied += 1;
        if (copied % 50 === 0) console.log(`  ...copied ${copied} objects so far`);
      } catch (error) {
        failed += 1;
        console.error(`  FAILED: ${obj.Key}`, error);
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log("---");
  console.log(`Scanned: ${scanned}`);
  console.log(`Copied:  ${copied}`);
  console.log(`Skipped (already present): ${skipped}`);
  console.log(`Failed:  ${failed}`);
  if (dryRun) console.log("No changes made. Re-run with --apply to copy objects.");
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
