import { prisma } from "../../config/prisma.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import { dashboardService } from "../../services/dashboard.service.js";
import { clientSuccessService } from "../../services/clientSuccess.service.js";
import { userRepository } from "../../repositories/user.repository.js";
import { userSessionRepository } from "../../repositories/userSession.repository.js";
import { analyticsEventService } from "../../services/analyticsEvent.service.js";
import { enqueueNotifications } from "../queues.js";
import { env } from "../../config/env.js";
import { notifyN8n } from "../../utils/webhook.js";
import { auditLogService } from "../../services/auditLog.service.js";

export async function cleanupExpiredRefreshTokens() {
  const start = performance.now();
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
    },
  });
  recordBullMQJob("maintenance", "cleanup-refresh-tokens", "completed", (performance.now() - start) / 1000);
  return result.count;
}

type ArchiveRule = {
  sourceTable: string;
  archiveTable: string;
  thresholdDays: number;
  whereClause: string;
};

// SECURITY: sourceTable/archiveTable/whereClause below are interpolated directly into raw SQL
// via $executeRawUnsafe (table/column identifiers can't be parameterized in Postgres, so this is
// unavoidable for DDL/DML on dynamic table names). This is only safe because every value here is
// a hardcoded literal in this file, never user input or config read at runtime. Never make
// ARCHIVE_RULES configurable (env var, DB-backed settings, admin UI, etc.) without adding a
// strict allowlist of table names first — doing so directly would turn this into a SQL injection
// vector.

// Runtime guard: enforces the allowlist even if ARCHIVE_RULES is accidentally made dynamic.
const ALLOWED_ARCHIVE_TABLES = new Set([
  "Lead", "LeadArchive",
  "ContactRequest", "ContactRequestArchive",
  "Notification", "NotificationArchive",
  "Document", "DocumentArchive",
]);

function assertSafeArchiveTable(name: string) {
  if (!ALLOWED_ARCHIVE_TABLES.has(name)) {
    throw new Error(`[maintenance] Blocked unsafe table name in archive rule: "${name}"`);
  }
}

// Allowlist-based guard for WHERE clauses interpolated into $executeRawUnsafe.
// Each clause must start with a quoted identifier, IS/=/</>/<=/>=, AND/OR/NOT, NOW(),
// INTERVAL, a quoted literal, or a digit. This blocks stacked statements (;), comments
// (--), and common injection payloads while allowing the legitimate date-range filters
// used in ARCHIVE_RULES. Fail-safe: unknown patterns are rejected, not accepted.
const SAFE_WHERE_CLAUSE_RE = /^"[A-Za-z_][A-Za-z0-9_]*"(\s+IS\s|\s*=\s|\s*<\s|\s*>\s|\s*AND\s|\s*OR\s)/i;

function assertSafeWhereClause(clause: string, label: string) {
  const trimmed = clause.trim();
  if (!SAFE_WHERE_CLAUSE_RE.test(trimmed)) {
    throw new Error(`[maintenance] Blocked potentially unsafe whereClause in rule "${label}": ${trimmed}`);
  }
  if (trimmed.includes(";") || trimmed.includes("--") || /\/\*/.test(trimmed)) {
    throw new Error(`[maintenance] whereClause contains forbidden characters in rule "${label}"`);
  }
}

const ARCHIVE_RULES: ArchiveRule[] = [
  {
    sourceTable: "Lead",
    archiveTable: "LeadArchive",
    thresholdDays: 30,
    whereClause: `"archivedAt" IS NOT NULL AND "archivedAt" < NOW() - INTERVAL '30 days'`,
  },
  {
    sourceTable: "ContactRequest",
    archiveTable: "ContactRequestArchive",
    thresholdDays: 180,
    whereClause: `"createdAt" < NOW() - INTERVAL '180 days'`,
  },
  {
    sourceTable: "Notification",
    archiveTable: "NotificationArchive",
    thresholdDays: 90,
    whereClause: `"read" = true AND "createdAt" < NOW() - INTERVAL '90 days'`,
  },
  {
    sourceTable: "Document",
    archiveTable: "DocumentArchive",
    thresholdDays: 365,
    whereClause: `"createdAt" < NOW() - INTERVAL '365 days'`,
  },
];

function buildMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function partitionParts(date: Date) {
  const start = buildMonthStart(date);
  const next = addMonths(start, 1);
  const suffix = `${start.getUTCFullYear()}_${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    start: start.toISOString().slice(0, 10),
    next: next.toISOString().slice(0, 10),
    suffix,
  };
}

async function ensureMonthlyPartitions(archiveTable: string) {
  assertSafeArchiveTable(archiveTable);
  const start = new Date(Date.UTC(2020, 0, 1));
  const end = addMonths(buildMonthStart(new Date()), 1);

  for (let current = start; current < end; current = addMonths(current, 1)) {
    const { start: rangeStart, next, suffix } = partitionParts(current);
    const partitionName = `${archiveTable}_${suffix}`;
    // SEC-020: the whole statement is DDL (CREATE TABLE ... PARTITION OF), and Postgres
    // does not accept bound parameters ($1/$2) anywhere in DDL — not just for identifiers.
    // rangeStart/next are safe to inline: they are always `YYYY-MM-DD` strings produced by
    // partitionParts() above via toISOString().slice(0, 10), never user input.
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${partitionName}"
       PARTITION OF "${archiveTable}"
       FOR VALUES FROM ('${rangeStart}'::date) TO ('${next}'::date);`
    );
  }
}

async function archiveTableRows(rule: ArchiveRule) {
  assertSafeArchiveTable(rule.sourceTable);
  assertSafeArchiveTable(rule.archiveTable);
  assertSafeWhereClause(rule.whereClause, rule.sourceTable);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - rule.thresholdDays);

  await ensureMonthlyPartitions(rule.archiveTable);

  const archived = await prisma.$executeRawUnsafe(`
    WITH moved AS (
      DELETE FROM "${rule.sourceTable}"
      WHERE ${rule.whereClause}
      RETURNING *
    )
    INSERT INTO "${rule.archiveTable}"
    SELECT * FROM moved;
  `);

  return archived;
}

export async function archiveColdData() {
  const start = performance.now();
  let totalArchived = 0;

  for (const rule of ARCHIVE_RULES) {
    const archived = await archiveTableRows(rule);
    totalArchived += Number(archived ?? 0);
  }

  recordBullMQJob("maintenance", "archive-cold-data", "completed", (performance.now() - start) / 1000);
  return totalArchived;
}

export async function warmDashboardSummaries() {
  const start = performance.now();
  const warmed = await dashboardService.warmAllSummaries();
  recordBullMQJob("maintenance", "warm-dashboard-summaries", "completed", (performance.now() - start) / 1000);
  return warmed;
}

/**
 * Flip live proposals (SENT/VIEWED) whose expiresAt has passed to EXPIRED, so the displayed
 * status is correct even when no one tries to accept them. The acceptance path also guards
 * against expiry at the moment of acceptance (PROPOSAL_EXPIRED).
 */
export async function expireProposals() {
  const start = performance.now();

  const now = new Date();
  const expiring = await prisma.$transaction(async (tx) => {
    // First, update the proposals atomically to EXPIRED, and return the ones that were updated
    // This avoids race conditions where a proposal could be accepted between find and update
    await tx.proposal.updateMany({
      where: { status: { in: ["SENT", "VIEWED"] }, expiresAt: { not: null, lt: now } },
      data: { status: "EXPIRED" },
    });
    // Now return the updated proposals for notifications
    return tx.proposal.findMany({
      where: { status: "EXPIRED", updatedAt: { gte: new Date(now.getTime() - 1000) } },
      select: { id: true, title: true, clientId: true, client: { select: { name: true } } },
    });
  });

  if (expiring.length === 0) {
    recordBullMQJob("maintenance", "expire-proposals", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const [admins, ...clientUserGroups] = await Promise.all([
    userRepository.findAdmins(),
    ...expiring.map((p) => userRepository.findByClientId(p.clientId)),
  ]);

  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  for (let i = 0; i < expiring.length; i++) {
    const proposal = expiring[i];
    const clientUsers = clientUserGroups[i];
    const clientLink = `${env.FRONTEND_URL}/client/proposals/${proposal.id}`;
    const adminLink = `${env.FRONTEND_URL}/app/proposals/${proposal.id}`;
    for (const user of clientUsers) {
      notifications.push({ userId: user.id, title: "Proposition expirée", message: `La proposition "${proposal.title}" a expiré.`, type: "PROPOSAL_EXPIRED" as const, entityId: proposal.id, link: clientLink });
    }
    for (const admin of admins) {
      notifications.push({ userId: admin.id, title: "Proposition expirée", message: `La proposition "${proposal.title}" a expiré sans réponse du client.`, type: "PROPOSAL_EXPIRED" as const, entityId: proposal.id, link: adminLink });
    }
  }
  await enqueueNotifications(notifications);

  void notifyN8n("proposal.expired", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    proposals: expiring.map((p) => ({
      proposalId: p.id,
      title: p.title,
      clientId: p.clientId,
      clientName: p.client?.name,
      adminUrl: `${env.FRONTEND_URL}/app/proposals/${p.id}`,
    })),
  });

  recordBullMQJob("maintenance", "expire-proposals", "completed", (performance.now() - start) / 1000);
  return expiring.length;
}

/**
 * Flip sent/partially-paid invoices past their due date to OVERDUE and notify the company's
 * admins about each newly-overdue invoice so collection can be chased. Only invoices currently
 * in SENT/PARTIAL are affected (DRAFT not yet billed, PAID/CANCELLED are terminal).
 */
export async function markOverdueInvoices() {
  const start = performance.now();

  const newlyOverdue = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "PARTIAL"] },
      dueDate: { not: null, lt: new Date() },
    },
    select: { id: true, number: true, clientId: true, amount: true, currency: true, client: { select: { name: true } } },
  });

  if (newlyOverdue.length === 0) {
    recordBullMQJob("maintenance", "mark-overdue-invoices", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  await prisma.invoice.updateMany({
    where: { id: { in: newlyOverdue.map((i) => i.id) }, status: { in: ["SENT", "PARTIAL"] } },
    data: { status: "OVERDUE" },
  });

  // SEC-186: send/addPayment/cancel all record an AuditLog entry for their status transition —
  // this cron-driven transition was the only one of the 4 that didn't. actorId/actorRole are
  // null (system-triggered, not a user action), which AuditLog already supports as nullable.
  await Promise.all(newlyOverdue.map((inv) =>
    auditLogService.record({
      actorId: null,
      actorRole: null,
      action: "invoice.markOverdue",
      entityType: "Invoice",
      entityId: inv.id,
      after: { status: "OVERDUE" },
    })
  ));

  const [admins, ...clientUserGroups] = await Promise.all([
    userRepository.findAdmins(),
    ...newlyOverdue.map((inv) => userRepository.findByClientId(inv.clientId)),
  ]);

  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  for (let i = 0; i < newlyOverdue.length; i++) {
    const invoice = newlyOverdue[i];
    const clientUsers = clientUserGroups[i];
    const clientLink = `${env.FRONTEND_URL}/client/invoices/${invoice.id}`;
    const adminLink = `${env.FRONTEND_URL}/app/invoices/${invoice.id}`;
    for (const user of clientUsers) {
      notifications.push({
        userId: user.id,
        title: "Facture en retard",
        message: `La facture ${invoice.number} est désormais en retard de paiement.`,
        type: "INVOICE_OVERDUE" as const,
        entityId: invoice.id,
        link: clientLink,
      });
    }
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: "Facture en retard",
        message: `La facture ${invoice.number} est désormais en retard de paiement.`,
        type: "INVOICE_OVERDUE" as const,
        entityId: invoice.id,
        link: adminLink,
      });
    }
  }
  await enqueueNotifications(notifications);

  void notifyN8n("invoice.overdue", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    invoices: newlyOverdue.map((inv) => ({
      invoiceId: inv.id,
      number: inv.number,
      amount: Number(inv.amount),
      currency: inv.currency ?? "TND",
      clientName: inv.client?.name,
      adminUrl: `${env.FRONTEND_URL}/app/invoices/${inv.id}`,
    })),
  });

  recordBullMQJob("maintenance", "mark-overdue-invoices", "completed", (performance.now() - start) / 1000);
  return newlyOverdue.length;
}

// A client crossing at-or-below this score (0-100 scale, see clientSuccessService.calculateScore)
// is considered newly at-risk. No existing threshold for this score in the codebase (the
// red/orange/green scoring in healthBoard.repository.ts is a different, project-level metric) —
// chosen as the midpoint of the 0-100 scale; revisit once there's a track record of real scores.
const CLIENT_SUCCESS_AT_RISK_THRESHOLD = 50;

export async function recalculateClientScores() {
  const start = performance.now();

  const records = await prisma.clientSuccess.findMany({ select: { clientId: true, score: true, client: { select: { name: true } } } });

  let updated = 0;
  const dropped: Array<{ clientId: string; clientName?: string; previousScore: number; newScore: number }> = [];

  for (const record of records) {
    try {
      const newScore = await clientSuccessService.calculateScore(record.clientId);
      await clientSuccessService.updateScore(record.clientId, newScore);
      updated++;

      // Only fire on the transition into the at-risk zone, not on every run for clients
      // already below the threshold — avoids paging the agency daily for the same client.
      if (record.score > CLIENT_SUCCESS_AT_RISK_THRESHOLD && newScore <= CLIENT_SUCCESS_AT_RISK_THRESHOLD) {
        dropped.push({ clientId: record.clientId, clientName: record.client?.name, previousScore: record.score, newScore });
      }
    } catch {
      // Non-fatal: skip individual failures so one bad record doesn't abort the batch
    }
  }

  if (dropped.length > 0) {
    void notifyN8n("clientSuccess.score_dropped", {
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      clients: dropped.map((d) => ({
        clientId: d.clientId,
        clientName: d.clientName,
        previousScore: d.previousScore,
        newScore: d.newScore,
        adminUrl: `${env.FRONTEND_URL}/app/clients/${d.clientId}`,
      })),
    });
  }

  recordBullMQJob("maintenance", "recalculate-client-scores", "completed", (performance.now() - start) / 1000);
  return updated;
}

export async function syncSearchConsole() {
  const start = performance.now();
  const { syncAllConnectedClients } = await import("../../services/searchConsole.service.js");
  const result = await syncAllConnectedClients();
  recordBullMQJob("maintenance", "sync-search-console", "completed", (performance.now() - start) / 1000);
  return result;
}

export async function pruneAnalyticsEvents() {
  const start = performance.now();
  const count = await analyticsEventService.pruneOldEvents(13);
  recordBullMQJob("maintenance", "prune-analytics-events", "completed", (performance.now() - start) / 1000);
  return count;
}

export async function closeStaleUserSessions() {
  const start = performance.now();
  const count = await userSessionRepository.closeStaleSessions();
  recordBullMQJob("maintenance", "close-stale-user-sessions", "completed", (performance.now() - start) / 1000);
  return count;
}
