import { prisma } from "../../config/prisma.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import { dashboardService } from "../../services/dashboard.service.js";

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
  const start = new Date(Date.UTC(2020, 0, 1));
  const end = addMonths(buildMonthStart(new Date()), 1);

  for (let current = start; current < end; current = addMonths(current, 1)) {
    const { start: rangeStart, next, suffix } = partitionParts(current);
    const partitionName = `${archiveTable}_${suffix}`;
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${partitionName}"
      PARTITION OF "${archiveTable}"
      FOR VALUES FROM ('${rangeStart}') TO ('${next}');
    `);
  }
}

async function archiveTableRows(rule: ArchiveRule) {
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
