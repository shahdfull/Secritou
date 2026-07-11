# Round 8 — Operational Continuity & Human Access Governance Audit

**Date :** 2026-07-11  
**Scope :** Parts A–H (backup/DR · impersonation · offboarding · runbooks · API versioning · cost/scalability · documentation · rollback/flags)  
**Rule :** Full read of current source — no trust in previous reports.

---

## Report A — Backup & Disaster Recovery

### A-1. Backup script coverage

**File read :** `scripts/backup-db.sh`

The script is production-grade for a single-database setup:

| Aspect | Status |
|---|---|
| Tool | `pg_dump --format=custom --compress=9 --no-owner --no-acl` ✅ |
| Upload | `aws s3 cp` with optional `--endpoint-url` for MinIO/R2 ✅ |
| Tiered retention | Daily (7 d) · Weekly (4 w on Sunday) · Monthly (3 m on 1st) ✅ |
| Error handling | `set -euo pipefail` at top ✅ |

**Gaps identified :**

| ID | Severity | Finding |
|---|---|---|
| A-1 | HIGH | No restore procedure exists. `scripts/` has no `restore-db.sh` and no runbook section. A team member on call at 03:00 has no documented steps. |
| A-2 | HIGH | Cron setup is not in the repository. `backup-db.sh` must be wired to a host crontab or CI schedule manually — risk of silent omission on new server. |
| A-3 | MED | No automated restore smoke-test. There is no `verify-backup.sh` that runs `pg_restore --list` on the most recent dump and asserts a row count. |
| A-4 | MED | `docker-compose.prod.yml` mounts `postgres_data` as a named volume but no WAL archiving is configured. PITR (point-in-time recovery) is unavailable between backup windows. |
| A-5 | LOW | S3 bucket lifecycle policy is not defined in the repo. The retention logic lives in the shell script (deletes by prefix + date math) — if the script fails silently, objects accumulate forever. An S3/MinIO lifecycle rule would provide a belt-and-suspenders guarantee. |
| A-6 | LOW | MinIO orphan key risk: `scripts/init-minio-prod.sh` creates the bucket and sets it private, but there is no script to purge orphaned object keys (deleted Document rows whose `fileKey` was never cleaned up before this audit cycle's fix). |

### A-2. Production compose volumes

`docker-compose.prod.yml` (fully read): Named volumes for `postgres_data`, `redis_data`, `minio_data`. No host-path bind mounts. The MinIO console port (9001) is correctly unexposed. Postgres port is not published to the host (only reachable inside the compose network) — good.

---

## Report B — Impersonation Mechanism

### Exhaustive search results

**Search pattern :** `impersonat|actAs|sudo|switchUser|loginAs|on-behalf` across all `server/src/**/*.ts` files.

**Result : zero matches.**

There is no impersonation route, middleware, service function, or helper in the codebase. The admin cannot "login as" a user. This is confirmed absent — not merely undiscovered.

**Implication :** Support and debugging of client-side issues requires the admin to reproduce the problem using their own ADMIN credentials, which cannot see the CLIENT portal. This is a **UX/operational gap**, not a security risk.

| ID | Severity | Finding |
|---|---|---|
| B-1 | LOW | No impersonation capability exists. When debugging a client-reported portal bug, the ADMIN has no way to see the client's exact view without temporarily setting their own `clientId` in the DB — an ad-hoc and risky operation. Consider adding a read-only `GET /api/v1/admin/impersonate/:userId` that issues a short-lived (5-min), non-renewable, audit-logged access token for admin use only. |

---

## Report C — Offboarding & Access Revocation

### C-1. `deleteUser` flow

**Files read :** `server/src/services/user.service.ts`, `server/src/repositories/user.repository.ts`

```
userService.deleteUser(id)
  → userRepository.delete(id)
      → prisma.refreshToken.deleteMany({ where: { userId: id } })   ← explicit revocation
      → prisma.user.delete({ where: { id } })
```

Refresh tokens are deleted before the user row — the sequence is correct and atomic within a single Prisma operation.

### C-2. Role-change revocation

`userService.updateUser` detects a role change and calls `userRepository.revokeSessions(id)` which deletes all refresh tokens for the user. The audit log is also written (`USER_ROLE_CHANGED`). This is correct.

### C-3. Findings

| ID | Severity | Finding |
|---|---|---|
| C-1 | MED | **Access token cannot be revoked.** After `deleteUser`, any already-issued access token remains valid until its expiry (`JWT_ACCESS_EXPIRES_IN`, default 1 h). A deleted employee retains API access for up to 1 hour. This is an inherent limitation of stateless JWTs — mitigation is to keep access token TTL short (already ≤ 1 h). Document this explicitly so on-call knows to wait out the TTL or restart the server if immediate revocation is critical. |
| C-2 | LOW | **BullMQ orphaned jobs.** When a user is deleted, pending email/notification jobs referencing their `userId` remain in the queue. These will fail gracefully (user not found at delivery time) but clutter the queue and count as BullMQ failures. No cleanup of queued jobs is done at deletion time. |
| C-3 | LOW | **Deletion not audit-logged.** `userService.deleteUser` calls `userRepository.delete` but never calls `auditLogService.record`. Role changes are audited but user deletion is not. An audit trail of who deleted whom is missing. |
| C-4 | LOW | `resetToken` and `resetTokenExpiry` fields: these are cleared by the `resetPassword` flow, but if a user is deleted while a reset token is pending, the user row disappears so no leak — correct by cascade. No issue here. |

---

## Report D — Incident Runbooks

### D-1. Alerting coverage

**File read :** `monitoring/alerts.yml`

Current alerts (4 total):

| Alert | Expression | Gap |
|---|---|---|
| HighErrorRate | `rate(http_errors_total[5m]) > 0.05` | No alert for specific 5xx burst vs 4xx noise |
| SlowQueries | P99 DB query > 1 s | Good |
| CacheHitRateLow | Cache hit rate < 50% | Good |
| APIDown | `up{job="secritou-api"} == 0` | Good |

**Missing alerts :**

| ID | Severity | Missing Alert |
|---|---|---|
| D-1 | HIGH | **BullMQ queue backlog.** No alert on `bullmq_queue_waiting_count > N` or job failure rate. A stuck document processor (PDFs failing) would be invisible until a client complains. |
| D-2 | HIGH | **GSC token expiry / revocation.** `handleGscRevocation` logs a warning and sends in-app notifications, but no Prometheus counter is incremented and no alert fires to PagerDuty/email. |
| D-3 | MED | **Disk/volume pressure.** No alert on MinIO disk usage or PostgreSQL data volume. |
| D-4 | MED | **Backup freshness.** No alert verifying the last successful backup is < 25 h old. |
| D-5 | LOW | **Memory pressure** (`process_resident_memory_bytes > N`). |

### D-2. Runbook files

Search for `RUNBOOK.md`, `docs/runbooks/`, `ops/`, `infra/` — **all absent.**

| ID | Severity | Finding |
|---|---|---|
| D-6 | HIGH | **No incident runbooks exist.** There is no documented response procedure for: BullMQ stall, GSC revocation, database unavailability, MinIO unreachable, failed deploy. |

### D-3. BullMQ failure path

`syncAllConnectedClients()` in `searchConsole.service.ts` wraps each client sync in try/catch, logs errors, and records them on the GSC connection row. This is correct defensively but produces no observable Prometheus metric for ops visibility.

---

## Report E — API Versioning & Contract Compatibility

### E-1. Current versioning

**Confirmed in `server/src/app.ts` lines 110–116 :**

```typescript
app.use("/api/v1", (req, res, next) => { ... });
app.use("/api/v1", apiRoutes);
app.use("/api/v1/metrics", metricsRoutes);
```

All 35+ route files mount under `/api/v1`. There is no v2 or version-negotiation header (`Accept: application/vnd.secritou.v2+json`).

### E-2. Findings

| ID | Severity | Finding |
|---|---|---|
| E-1 | LOW | **No breaking-change process documented.** If a v2 endpoint must break the v1 contract, there is no runbook for dual-serving v1+v2 during a transition window. Acceptable for a single-agency SaaS; document the intent (v1 is the only version; bump to /api/v2 when a breaking change is needed). |
| E-2 | LOW | **No `Deprecation` response header.** If a route is deprecated, there is no mechanism to signal clients in-band. Consider adding a deprecation middleware when the time comes. |
| E-3 | INFO | The single-version approach is appropriate for this codebase's scale and single-tenant nature. The `/api/v1` prefix is sufficient future-proofing. No action required now. |

---

## Report F — Cost & Scalability

### F-1. N+1 query analysis

All major repositories were read. Findings:

- `client.repository.ts`: uses `include` for related projects in client detail — single joined query, not N+1.
- `healthBoard.repository.ts`, `executiveMetrics.repository.ts`: complex `groupBy` aggregations — correctly batched in single queries.
- `clientSuccess.repository.ts`: `metrics: { include: { history: { take: 30 } } }` — history is bounded to 30 rows per metric, not unbounded.
- Pagination: all list endpoints use offset pagination (`skip` / `take`) — consistent across all repositories.

**No systemic N+1 patterns found.** Prisma's eager-loading via `include` is used correctly throughout.

### F-2. GSC rate limiting

`syncAllConnectedClients()` in `searchConsole.service.ts` runs sequentially (`for...of` loop, not `Promise.all`). This is intentional — it serializes API calls and avoids thundering-herd against the Google Search Console API. Google's quota is 25,000 queries/day free; for an agency with < 100 clients, one sync/day consumes < 100 quota units.

**No rate limiting issue** for current scale. If client count grows beyond ~200, introduce a concurrency limiter (`p-limit` or BullMQ rate-limited queue).

### F-3. PDF generation cost

**File read :** `server/src/jobs/processors/documents.processor.ts`

PDF generation happens in BullMQ background jobs via `documentGeneratorService`. PDFs are generated using `pdfkit → Buffer → upload to MinIO`. No external paid PDF service is used — cost is CPU + MinIO storage only.

On proposal acceptance, **7 PDFs are generated in one burst** (welcome letter, contract, specs, brief, quote, invoice, roadmap). This is a BullMQ queue burst, not a synchronous spike. No cost risk.

### F-4. Pagination coverage

All major list endpoints paginate. No unbounded `findMany()` without `take` was found in list-focused repository methods.

| ID | Severity | Finding |
|---|---|---|
| F-1 | LOW | **Offset pagination at scale.** All endpoints use `skip/take` offset pagination. For tables that grow beyond ~50,000 rows (unlikely for single-agency), performance degrades. Cursor-based pagination would be needed at that scale — no action required now. |
| F-2 | LOW | **No GSC concurrency cap.** `syncAllConnectedClients` is sequential today. If the number of connected clients grows, add `p-limit(3)` to cap concurrency at 3 simultaneous API calls while still being faster than fully sequential. |

---

## Report G — Documentation & Bus Factor

### G-1. README.md accuracy

**File read :** `README.md`

| Item | README says | Reality | Status |
|---|---|---|---|
| Node version | ≥ 20 | ≥ 24 (added to `engines` field in root `package.json` in prior round) | ❌ Stale |
| JWT env var (dev quick start) | `JWT_SECRET=your-secret-here` | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` | ❌ Stale |
| JWT env var (prod section) | `JWT_SECRET=<strong-secret>` | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` | ❌ Stale |
| `INTEGRATIONS_ENCRYPTION_KEY` | Not mentioned | Required for GSC OAuth token encryption (`encryption.ts`) | ❌ Missing |
| AuditLog migration | Not mentioned | `AuditLog` table added in a prior migration | ❌ Missing |
| MinIO setup | Referenced via `init-minio.sh` | Correct | ✅ |
| Stack table | Correct | Matches actual stack | ✅ |
| Postman collection | Not linked | `server/Secritou-MVP-API.postman_collection.json` exists | ❌ Not linked |

### G-2. CLAUDE.md accuracy

**File read :** `CLAUDE.md`

| Item | Status |
|---|---|
| Header: `Stack : [ta stack réelle ici — ex: Node/Express + PostgreSQL + React, ou Django, etc.]` | ❌ Original placeholder text never removed |
| Security constraints section | ✅ Accurate |
| "Règles de développement" section | ✅ Accurate (migration rule + stack added in prior round) |
| `INTEGRATIONS_ENCRYPTION_KEY` not mentioned | ❌ Missing — anyone setting up the project from CLAUDE.md would miss it |

### G-3. ADRs and architectural decisions

No `docs/`, `docs/adr/`, `docs/decisions/`, or `ops/` directory exists. There are no Architecture Decision Records. All architectural choices (JWT family rotation, AES-256-GCM for OAuth tokens, single-agency model, TND 3-decimal rounding) exist only in the code and in prior audit files.

### G-4. Bus factor

| ID | Severity | Finding |
|---|---|---|
| G-1 | HIGH | **README has 5 stale/missing env var entries** (Node version, JWT_SECRET x2, INTEGRATIONS_ENCRYPTION_KEY, AuditLog). A new developer following the README would fail at setup or misconfigure auth. |
| G-2 | MED | **CLAUDE.md header placeholder not replaced.** The original `Stack : [ta stack réelle ici...]` placeholder remains at line 6. |
| G-3 | MED | **No ADRs.** Non-obvious decisions (3-decimal TND rounding, token family rotation, read/write Prisma split) are not documented outside of code comments. |
| G-4 | LOW | **Postman collection not linked from README.** `server/Secritou-MVP-API.postman_collection.json` is the only API reference besides Swagger but is not mentioned anywhere. |

---

## Report H — Rollback & Feature Flags

### H-1. Feature flags

Search across `server/src/` and `client/src/` for: `featureFlag`, `FEATURE_`, `LaunchDarkly`, `toggle`, `darklaunch`, `canary`.

**Result : zero matches.** No feature flag system exists.

### H-2. Rollback mechanism

`docker-compose.prod.yml` uses `build:` directives — images are built from source at deploy time, not pulled from a registry with a versioned tag. There is no image pinning, no `VERSION` file, and no git-sha injection into the build.

**Rollback procedure today :** `git checkout <previous-sha>` + `docker-compose -f docker-compose.prod.yml up --build -d`. This requires a full rebuild (minutes of downtime).

| ID | Severity | Finding |
|---|---|---|
| H-1 | MED | **No feature flags.** New features are released in full, with no gradual rollout. For a single-agency SaaS this is acceptable, but any risky database migration or behavioral change cannot be toggled off without a redeploy. |
| H-2 | MED | **No image pinning / versioned deploys.** `docker-compose.prod.yml` builds from source. To roll back, you must rebuild. If build takes 5+ minutes, MTTR during a bad deploy is high. Recommended: push tagged images to a registry (`ghcr.io/secritou/server:${GIT_SHA}`) so rollback is `docker pull` + `docker-compose up -d` (< 30 s). |
| H-3 | LOW | **No `VERSION` or git-sha in runtime.** `GET /api/v1/health` (if it exists) does not report the deployed commit SHA. Ops cannot confirm which version is running without SSH access. |

---

## Confirmé absent

The following were searched for and are confirmed not present in the codebase:

| Feature | Searched | Verdict |
|---|---|---|
| Impersonation / actAs / sudo | All `*.ts` in `server/src/` | **Absent** |
| Feature flags | All `*.ts`, `*.tsx` in `server/` and `client/` | **Absent** |
| Canary / dark-launch deployment | All config and source files | **Absent** |
| RUNBOOK.md | Repo root + all subdirs | **Absent** |
| `docs/` directory | Repo root | **Absent** |
| `ops/` / `infra/` directory | Repo root | **Absent** |
| ADR files | Entire repo | **Absent** |
| Restore script (`restore-db.sh`) | `scripts/` | **Absent** |
| Cron registration (crontab, GitHub Actions schedule for backup) | `.github/workflows/`, `scripts/` | **Absent** |
| WAL archiving config | `docker-compose.prod.yml`, `postgresql.conf` | **Absent** |
| S3 lifecycle policy script | `scripts/` | **Absent** |

---

## Consolidated Synthesis

### Priority matrix

| ID | Part | Severity | Finding | Effort |
|---|---|---|---|---|
| A-1 | Backup | HIGH | No restore procedure documented | Low — write `scripts/restore-db.sh` + runbook section |
| A-2 | Backup | HIGH | Cron not wired in repo | Low — add GitHub Actions scheduled workflow |
| D-6 | Runbooks | HIGH | No incident runbooks exist | Medium — write `RUNBOOK.md` |
| D-1 | Alerts | HIGH | No BullMQ queue alert | Low — add Prometheus counter + alert rule |
| G-1 | Docs | HIGH | README has 5 stale/wrong env vars | Low — update README |
| C-1 | Offboarding | MED | Access token lives up to 1 h after delete | By design — document in RUNBOOK |
| D-2 | Alerts | MED | No GSC revocation alert | Low — add Prometheus counter in `handleGscRevocation` |
| H-2 | Rollback | MED | No image pinning — rollback requires rebuild | Medium — add registry + tagging to CI |
| H-1 | Flags | MED | No feature flags | Low — document policy (none needed for now) |
| G-2 | Docs | MED | CLAUDE.md header placeholder | Trivial — one-line fix |
| G-3 | Docs | MED | No ADRs | Medium — create `docs/adr/` with 3–4 founding ADRs |
| C-2 | Offboarding | LOW | BullMQ orphaned jobs on user delete | Low — add queue drain in delete path |
| C-3 | Offboarding | LOW | User deletion not audit-logged | Low — add `auditLogService.record` to `deleteUser` |
| B-1 | Impersonation | LOW | No impersonation for admin debugging | Medium — optional |
| F-1 | Scalability | LOW | Offset pagination at scale | Not actionable until row counts grow |
| H-3 | Rollback | LOW | No git-sha in health endpoint | Low — inject `GIT_SHA` build arg |

### Items that require no code change

- **C-1 (access token TTL):** Acceptable by design; keep `JWT_ACCESS_EXPIRES_IN` ≤ 1 h and document.
- **E-3 (single API version):** Appropriate for scale.
- **F-3 (PDF cost):** No external cost; BullMQ queue burst is safe.

---

## Methodology

**What was read (first-hand) for this round :**

| File | Purpose |
|---|---|
| `README.md` | Part G — setup guide and env var accuracy |
| `CLAUDE.md` | Part G — dev rules and security constraints |
| `scripts/backup-db.sh` | Part A — backup coverage |
| `scripts/init-minio.sh` + `init-minio-prod.sh` | Part A — MinIO bucket setup |
| `docker-compose.yml` | Part A/F — dev infra |
| `docker-compose.prod.yml` | Part A/H — production stack, volume setup |
| `monitoring/alerts.yml` | Part D — alert coverage |
| `server/src/services/auth.service.ts` | Parts B/C — impersonation search, session revocation |
| `server/src/routes/auth.routes.ts` | Part B — impersonation route search |
| `server/src/services/user.service.ts` | Part C — deleteUser / offboarding |
| `server/src/repositories/user.repository.ts` | Part C — revokeSessions implementation |
| `server/src/services/searchConsole.service.ts` | Parts D/F — GSC error handling, rate limiting |
| `server/src/services/document.service.ts` | Part F — PDF/document storage |
| `server/src/jobs/processors/documents.processor.ts` | Part F — PDF generation in queue |
| `server/src/app.ts` (excerpt) | Part E — API versioning prefix |
| `server/src/routes/` (directory listing) | Part E — route inventory |
| `.github/workflows/ci.yml` | Part G — CI accuracy |
| `.github/dependabot.yml` | Part G — supply-chain coverage |
| `scripts/check-i18n.mjs` | Part G — script currency |

**What was searched (grep) :**

- `impersonat|actAs|sudo|switchUser|loginAs|on-behalf` — all `*.ts` in `server/src/`
- `featureFlag|FEATURE_|LaunchDarkly|toggle|darklaunch|canary` — all `*.ts`, `*.tsx`
- `N+1`, loop-inside-loop Prisma patterns — all `*.ts` in `server/src/`
- `take|skip|paginate|cursor` — all repository files

**Scope exclusions :** Route-level security (covered in Round 6+7), financial calculation accuracy (covered in Round 6+7), i18n completeness (covered in prior rounds).
