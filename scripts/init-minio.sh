#!/usr/bin/env bash
# Creates the local dev bucket in MinIO.
# Requires: mc (MinIO Client) — install with: brew install minio/stable/mc
# or: curl -sL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && chmod +x /usr/local/bin/mc

set -euo pipefail

MINIO_URL="${MINIO_URL:-http://localhost:9000}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${S3_BUCKET:-secritou-dev}"

echo "→ Configuring mc alias for local MinIO..."
mc alias set local "$MINIO_URL" "$MINIO_USER" "$MINIO_PASS" --api S3v4

echo "→ Creating bucket: $BUCKET"
mc mb --ignore-existing "local/$BUCKET"

echo "→ Setting bucket policy to public (dev only)"
mc anonymous set public "local/$BUCKET"

echo "✓ MinIO bucket '$BUCKET' is ready at $MINIO_URL"
