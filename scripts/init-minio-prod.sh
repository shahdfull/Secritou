#!/usr/bin/env bash
# Creates/configures the production bucket on a self-hosted MinIO instance.
# Run once after the minio-prod service (docker-compose.prod.yml) is up.
# Requires: mc (MinIO Client)

set -euo pipefail

MINIO_URL="${MINIO_URL:?Set MINIO_URL, e.g. https://minio.secritou.com}"
MINIO_USER="${MINIO_ROOT_USER:?Set MINIO_ROOT_USER}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD}"
BUCKET="${S3_BUCKET:?Set S3_BUCKET, e.g. secritou-prod}"

echo "→ Configuring mc alias for production MinIO..."
mc alias set prod "$MINIO_URL" "$MINIO_USER" "$MINIO_PASS" --api S3v4

echo "→ Creating bucket: $BUCKET"
mc mb --ignore-existing "prod/$BUCKET"

# Production buckets stay private: the app serves objects via signed URLs
# (see getSignedReadUrl in upload.service.ts). Do not set anonymous/public
# access here unless S3_PUBLIC_ACL=true is intentionally set for the app.
echo "→ Bucket policy left private (app uses signed URLs)."

echo "✓ MinIO bucket '$BUCKET' is ready at $MINIO_URL"
