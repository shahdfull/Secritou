# Backup & Restore — PostgreSQL

## Backup strategy

| Prefix | Frequency | Retention |
|--------|-----------|-----------|
| `daily/` | Every day at 01:00 UTC | 7 most recent |
| `weekly/` | Every Sunday at 01:00 UTC | 4 most recent |
| `monthly/` | 1st of each month at 01:00 UTC | 3 most recent |

Backups are compressed PostgreSQL custom-format dumps (`.dump`), uploaded to the S3 bucket defined by `S3_BUCKET`.

---

## Scheduling the backup script

### Option A — Cron system (VPS / dedicated server)

```bash
# Install once
chmod +x /path/to/secritou/scripts/backup-db.sh

# Add to crontab (crontab -e)
0 1 * * * \
  DATABASE_URL="postgresql://..." \
  S3_BUCKET="secritou-backups" \
  AWS_ACCESS_KEY_ID="..." \
  AWS_SECRET_ACCESS_KEY="..." \
  AWS_DEFAULT_REGION="eu-west-3" \
  /path/to/secritou/scripts/backup-db.sh >> /var/log/secritou-backup.log 2>&1
```

### Option B — GitHub Actions (PaaS / no SSH access)

Create `.github/workflows/backup.yml`:

```yaml
name: DB Backup
on:
  schedule:
    - cron: "0 1 * * *"   # 01:00 UTC daily
  workflow_dispatch:        # allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install pg_dump
        run: sudo apt-get install -y postgresql-client
      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          S3_BUCKET: ${{ secrets.S3_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: ${{ secrets.AWS_DEFAULT_REGION }}
        run: bash scripts/backup-db.sh
```

---

## Restore procedure

### Prerequisites
- `pg_restore` installed (`postgresql-client` package)
- Write access to target database
- S3 credentials with read access to the backup bucket

### Steps

**1. List available backups**
```bash
aws s3 ls s3://$S3_BUCKET/daily/
aws s3 ls s3://$S3_BUCKET/weekly/
aws s3 ls s3://$S3_BUCKET/monthly/
```

**2. Download the desired backup**
```bash
aws s3 cp s3://$S3_BUCKET/daily/secritou-20260619T010000Z.dump /tmp/restore.dump
```

**3. Restore to a clean database**
```bash
# Create a fresh database (do NOT restore over production without testing first)
psql $DATABASE_URL -c "CREATE DATABASE secritou_restore;"

pg_restore \
  --dbname="postgresql://user:password@host:5432/secritou_restore" \
  --no-owner \
  --no-acl \
  --verbose \
  /tmp/restore.dump
```

**4. Verify integrity**
```bash
psql "postgresql://user:password@host:5432/secritou_restore" <<'SQL'
SELECT COUNT(*) AS users        FROM "User";
SELECT COUNT(*) AS clients      FROM "Client";
SELECT COUNT(*) AS invoices     FROM "Invoice";
SELECT COUNT(*) AS projects     FROM "Project";
SELECT MAX("createdAt") AS latest_user FROM "User";
SQL
```

Expected: all counts > 0, `latest_user` matches expected recent date.

**5. Promote to production (if restore is valid)**
```bash
# Rename databases with zero-downtime (requires brief maintenance window)
psql $ADMIN_URL -c "ALTER DATABASE secritou_db RENAME TO secritou_db_old;"
psql $ADMIN_URL -c "ALTER DATABASE secritou_restore RENAME TO secritou_db;"
```

---

## Quarterly test procedure

Run the following checklist every quarter (add to your team calendar):

- [ ] Pick the most recent `monthly/` backup
- [ ] Restore to a temporary database (`secritou_test_restore`)
- [ ] Run the integrity queries above and confirm all counts are plausible
- [ ] Start the server pointing at `secritou_test_restore` and log in — verify dashboard loads
- [ ] Document the restore duration and backup size in the test log below
- [ ] Drop the temporary database: `psql $ADMIN_URL -c "DROP DATABASE secritou_test_restore;"`

### Test log

| Date | Backup used | Restore duration | Size | Tester | Result |
|------|-------------|-----------------|------|--------|--------|
| _(fill in)_ | | | | | |
