#!/usr/bin/env bash
# Configure S3/MinIO lifecycle rules for backup retention.
#
# Usage:
#   ./scripts/set-s3-lifecycle.sh
#
# Required env vars:
#   S3_BUCKET            : target bucket (e.g. secritou-prod)
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION   : (optional, default us-east-1)
#   S3_ENDPOINT          : (optional) for MinIO / R2 / Backblaze
#
# Retention tiers (matching scripts/backup-db.sh):
#   daily/   → keep 7 days
#   weekly/  → keep 30 days
#   monthly/ → keep 365 days

set -euo pipefail

BUCKET="${S3_BUCKET:?S3_BUCKET is required}"

ENDPOINT_ARGS=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  ENDPOINT_ARGS="--endpoint-url ${S3_ENDPOINT}"
fi

LIFECYCLE_JSON=$(cat <<'EOF'
{
  "Rules": [
    {
      "ID": "daily-backups-7d",
      "Status": "Enabled",
      "Filter": { "Prefix": "daily/" },
      "Expiration": { "Days": 7 }
    },
    {
      "ID": "weekly-backups-30d",
      "Status": "Enabled",
      "Filter": { "Prefix": "weekly/" },
      "Expiration": { "Days": 30 }
    },
    {
      "ID": "monthly-backups-365d",
      "Status": "Enabled",
      "Filter": { "Prefix": "monthly/" },
      "Expiration": { "Days": 365 }
    }
  ]
}
EOF
)

echo "=== Setting S3 lifecycle on bucket: ${BUCKET} ==="
echo "  daily/   → expire after  7 days"
echo "  weekly/  → expire after 30 days"
echo "  monthly/ → expire after 365 days"
echo ""

# shellcheck disable=SC2086
aws s3api put-bucket-lifecycle-configuration \
  $ENDPOINT_ARGS \
  --bucket "${BUCKET}" \
  --lifecycle-configuration "${LIFECYCLE_JSON}"

echo "Done. Current lifecycle:"
# shellcheck disable=SC2086
aws s3api get-bucket-lifecycle-configuration $ENDPOINT_ARGS --bucket "${BUCKET}"
