#!/usr/bin/env bash
# PostgreSQL restore from S3 backup
#
# Usage:
#   ./scripts/restore-db.sh <s3-key>
#   ./scripts/restore-db.sh daily/secritou-20260711T030000Z.dump
#
# Required env vars (same as backup-db.sh):
#   DATABASE_URL     : target PostgreSQL connection string
#   S3_BUCKET        : source bucket
#   S3_ENDPOINT      : (optional) for MinIO / R2 / Backblaze
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#
# The script:
#   1. Downloads the dump from S3 to a temp file
#   2. Drops and recreates the target database (with confirmation prompt)
#   3. Restores via pg_restore
#   4. Runs a row-count smoke test
#   5. Cleans up the temp file

set -euo pipefail

S3_KEY="${1:?Usage: restore-db.sh <s3-key>}"
BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
DUMP_FILE="/tmp/secritou-restore-$(date -u +%s).dump"

ENDPOINT_ARGS=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  ENDPOINT_ARGS="--endpoint-url ${S3_ENDPOINT}"
fi

# Parse DATABASE_URL → pg connection variables
parse_pg_url() {
  local url="${DATABASE_URL:?DATABASE_URL is required}"
  PGUSER=$(echo "$url" | sed -E 's|postgresql://([^:]+):.*|\1|')
  PGPASSWORD=$(echo "$url" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
  PGHOST=$(echo "$url" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
  PGPORT=$(echo "$url" | sed -E 's|.*:([0-9]+)/.*|\1|; s|[^0-9].*||')
  PGPORT="${PGPORT:-5432}"
  PGDATABASE=$(echo "$url" | sed -E 's|.*/([^?]+).*|\1|')
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

parse_pg_url

echo "=== Secritou DB Restore ==="
echo "Source S3 key : s3://${BUCKET}/${S3_KEY}"
echo "Target DB     : ${PGDATABASE} @ ${PGHOST}:${PGPORT}"
echo ""
read -r -p "WARNING: This will DROP and recreate '${PGDATABASE}'. Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

# 1. Download
echo "[1/4] Downloading s3://${BUCKET}/${S3_KEY} ..."
# shellcheck disable=SC2086
aws s3 cp $ENDPOINT_ARGS "s3://${BUCKET}/${S3_KEY}" "${DUMP_FILE}"
echo "      Downloaded to ${DUMP_FILE} ($(du -h "${DUMP_FILE}" | cut -f1))"

# 2. Drop and recreate (connect to 'postgres' maintenance db to do it)
echo "[2/4] Dropping and recreating database '${PGDATABASE}' ..."
PGPASSWORD="${PGPASSWORD}" psql \
  -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${PGDATABASE}' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"${PGDATABASE}\";" \
  -c "CREATE DATABASE \"${PGDATABASE}\" OWNER \"${PGUSER}\";"

# 3. Restore
echo "[3/4] Restoring from dump ..."
PGPASSWORD="${PGPASSWORD}" pg_restore \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --no-owner \
  --no-acl \
  --jobs=4 \
  "${DUMP_FILE}"

# 4. Smoke test — count rows in critical tables
echo "[4/4] Smoke test ..."
PGPASSWORD="${PGPASSWORD}" psql \
  -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  -c "SELECT 'User' AS tbl, COUNT(*) FROM \"User\"
      UNION ALL SELECT 'Client', COUNT(*) FROM \"Client\"
      UNION ALL SELECT 'Invoice', COUNT(*) FROM \"Invoice\"
      UNION ALL SELECT 'Project', COUNT(*) FROM \"Project\";"

# 5. Cleanup
rm -f "${DUMP_FILE}"
echo ""
echo "=== Restore complete. Run 'npx prisma migrate deploy' if needed. ==="
