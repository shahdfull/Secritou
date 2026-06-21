#!/usr/bin/env bash
# PostgreSQL backup → S3 with retention policy
#
# Retention:
#   daily/   — keep 7 most recent
#   weekly/  — keep 4 most recent (runs on Sundays)
#   monthly/ — keep 3 most recent (runs on 1st of month)
#
# Required env vars:
#   DATABASE_URL     — PostgreSQL connection string
#   S3_BUCKET        — target bucket
#   S3_ENDPOINT      — (optional) for MinIO / R2 / Backblaze
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#
# Usage (cron):
#   0 1 * * * /path/to/scripts/backup-db.sh >> /var/log/secritou-backup.log 2>&1

set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DAY_OF_WEEK=$(date -u +"%u")   # 7 = Sunday
DAY_OF_MONTH=$(date -u +"%d")  # 01..31

DUMP_FILE="/tmp/secritou-${TIMESTAMP}.dump"
BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
ENDPOINT_ARGS=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  ENDPOINT_ARGS="--endpoint-url ${S3_ENDPOINT}"
fi

log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"; }

# ── 1. Dump ──────────────────────────────────────────────────────────────────
log "Starting pg_dump..."
pg_dump "${DATABASE_URL:?DATABASE_URL is required}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="${DUMP_FILE}"
log "Dump complete: $(du -sh "${DUMP_FILE}" | cut -f1)"

# ── 2. Determine prefix (daily / weekly / monthly) ────────────────────────────
PREFIXES=("daily")
[[ "${DAY_OF_WEEK}" == "7" ]] && PREFIXES+=("weekly")
[[ "${DAY_OF_MONTH}" == "01" ]] && PREFIXES+=("monthly")

for PREFIX in "${PREFIXES[@]}"; do
  S3_KEY="${PREFIX}/secritou-${TIMESTAMP}.dump"
  log "Uploading to s3://${BUCKET}/${S3_KEY}..."
  aws s3 cp ${ENDPOINT_ARGS} "${DUMP_FILE}" "s3://${BUCKET}/${S3_KEY}"
  log "Upload done: ${S3_KEY}"
done

# ── 3. Cleanup local temp file ────────────────────────────────────────────────
rm -f "${DUMP_FILE}"

# ── 4. Retention: prune old backups ──────────────────────────────────────────
prune_prefix() {
  local prefix="$1"
  local keep="$2"

  log "Pruning ${prefix}/ (keeping ${keep} most recent)..."
  mapfile -t all_keys < <(
    aws s3 ls ${ENDPOINT_ARGS} "s3://${BUCKET}/${prefix}/" \
      | awk '{print $4}' \
      | sort -r
  )

  if [[ ${#all_keys[@]} -le ${keep} ]]; then
    log "  Nothing to prune (${#all_keys[@]} backups present)"
    return
  fi

  local to_delete=("${all_keys[@]:${keep}}")
  for key in "${to_delete[@]}"; do
    log "  Deleting s3://${BUCKET}/${prefix}/${key}"
    aws s3 rm ${ENDPOINT_ARGS} "s3://${BUCKET}/${prefix}/${key}"
  done
}

prune_prefix "daily"   7
prune_prefix "weekly"  4
prune_prefix "monthly" 3

log "Backup complete."
