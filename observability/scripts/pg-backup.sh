#!/bin/sh
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/secritou_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-secritou}" | gzip > "$FILE"
find "$BACKUP_DIR" -name "secritou_*.sql.gz" -mtime +"${RETENTION_DAYS:-7}" -delete
echo "Backup created: $FILE"
