import { prismaRead } from "../../config/prisma.js";
import { userRepository } from "../../repositories/user.repository.js";
import { projectMeetingRepository } from "../../repositories/projectMeeting.repository.js";
import { enqueueNotifications } from "../queues.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import { env } from "../../config/env.js";
import { invoiceService } from "../../services/invoice.service.js";
import { notifyN8n } from "../../utils/webhook.js";
import { healthBoardService } from "../../services/healthBoard.service.js";
import { healthBoardRepository } from "../../repositories/healthBoard.repository.js";

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── check-stale-projects ─────────────────────────────────────────────────────
// Daily 08:00 — projects IN_PROGRESS with no task activity for > 7 days
export async function checkStaleProjects() {
  const start = performance.now();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);

  // `tasks: { every: ... }` is vacuously true for a project with zero tasks (Prisma/SQL
  // "every" on an empty set), which would flag a brand-new IN_PROGRESS project as stale the
  // day after creation. Require at least one task before applying the "all tasks stale"
  // check, matching healthBoardRepository's isStale (which requires lastActivityAt !== null).
  const staleProjects = await prismaRead.project.findMany({
    where: {
      archivedAt: null,
      status: "IN_PROGRESS",
      tasks: {
        some: {},
        every: { updatedAt: { lt: cutoff } },
      },
    },
    select: {
      id: true,
      name: true,
      tasks: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  if (staleProjects.length === 0) {
    recordBullMQJob("maintenance", "check-stale-projects", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const project of staleProjects) {
    const lastTask = project.tasks[0];
    const daysSince = lastTask ? diffDays(lastTask.updatedAt, now) : null;
    const projectUrl = `${env.FRONTEND_URL}/app/projects/${project.id}`;

    // Email is sent by the n8n workflow (see notifyN8n below) — only the in-app notification
    // is created directly here.
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: "Projet inactif",
        message: `Le projet « ${project.name} » n'a pas eu d'activité${daysSince !== null ? ` depuis ${daysSince} jours` : ""}.`,
        type: "PROJECT_STALE" as const,
        entityId: project.id,
        link: projectUrl,
      });
    }
  }

  await enqueueNotifications(notifications);

  void notifyN8n("project.stale", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    projects: staleProjects.map((project) => {
      const lastTask = project.tasks[0];
      return {
        projectId: project.id,
        name: project.name,
        daysSince: lastTask ? diffDays(lastTask.updatedAt, now) : null,
        adminUrl: `${env.FRONTEND_URL}/app/projects/${project.id}`,
      };
    }),
  });

  recordBullMQJob("maintenance", "check-stale-projects", "completed", (performance.now() - start) / 1000);
  return staleProjects.length;
}

// ── check-overdue-deadlines ──────────────────────────────────────────────────
// Daily 08:30 — projects with deadline < today+3 days and not completed.
// Reuses healthBoardRepository's isOverdue/daysUntilDeadline (same source as the live admin
// Health Board and weeklyHealthBoardDigest) instead of recomputing "overdue" independently,
// so this alert and the Health Board screen never disagree about which projects are urgent.
export async function checkOverdueDeadlines() {
  const start = performance.now();

  const allActive = await healthBoardRepository.getActiveProjectsHealth();
  const urgentProjects = allActive.filter(
    (p) => p.deadline !== null && (p.isOverdue || (p.daysUntilDeadline !== null && p.daysUntilDeadline <= 3))
  );

  if (urgentProjects.length === 0) {
    recordBullMQJob("maintenance", "check-overdue-deadlines", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const project of urgentProjects) {
    const daysLeft = project.daysUntilDeadline!;
    const projectUrl = `${env.FRONTEND_URL}/app/projects/${project.id}`;

    const title = project.isOverdue ? "🔴 Projet en retard" : "⏰ Délai imminent";
    const message = project.isOverdue
      ? `Le projet « ${project.name} » est en retard de ${Math.abs(daysLeft)} jour(s).`
      : `Le délai du projet « ${project.name} » est dans ${daysLeft} jour(s).`;

    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title,
        message,
        type: "PROJECT_DEADLINE_SOON" as const,
        entityId: project.id,
        link: projectUrl,
      });
    }
  }

  await enqueueNotifications(notifications);

  void notifyN8n("project.deadline_soon", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    projects: urgentProjects.map((project) => ({
      projectId: project.id,
      name: project.name,
      clientName: project.clientName,
      deadline: project.deadline,
      isOverdue: project.isOverdue,
      adminUrl: `${env.FRONTEND_URL}/app/projects/${project.id}`,
    })),
  });

  recordBullMQJob("maintenance", "check-overdue-deadlines", "completed", (performance.now() - start) / 1000);
  return urgentProjects.length;
}

// ── check-invoice-followup ───────────────────────────────────────────────────
// Every Monday 09:00 — SENT/PARTIAL/OVERDUE invoices past their dueDate for > 7 days.
// Auto-sends a tiered client reminder (FIRST/SECOND/FINAL at 7/14/30 days overdue,
// measured from dueDate — not createdAt, see SEC-014), deduplicated against
// InvoiceReminder so each tier is only ever sent once per invoice. Includes OVERDUE
// invoices (SEC-015): markOverdueInvoices (maintenance.processor.ts) only fires a
// single transition notification when SENT/PARTIAL → OVERDUE — without this filter
// covering OVERDUE too, an invoice that crosses that line stops receiving any further
// reminder forever, no matter how many additional days of retard accumulate.
function reminderTierForDaysOverdue(daysOverdue: number): "FIRST" | "SECOND" | "FINAL" | null {
  if (daysOverdue >= 30) return "FINAL";
  if (daysOverdue >= 14) return "SECOND";
  if (daysOverdue >= 7) return "FIRST";
  return null;
}

export async function checkInvoiceFollowup() {
  const start = performance.now();
  const cutoff = new Date(Date.now() - 7 * 86_400_000);

  const invoices = await prismaRead.invoice.findMany({
    where: {
      status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      dueDate: { lt: cutoff },
      reminderPaused: false,
    },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      dueDate: true,
      client: { select: { name: true } },
      reminders: { select: { type: true } },
    },
  });

  if (invoices.length === 0) {
    recordBullMQJob("maintenance", "check-invoice-followup", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  const finalNoticeInvoices: typeof invoices = [];

  for (const inv of invoices) {
    // dueDate is guaranteed non-null here (query filters on `dueDate: { lt: cutoff }`,
    // which never matches null) — the type stays nullable because Prisma can't encode
    // that filter->non-null relationship, so this is a defensive skip, not an expected path.
    if (!inv.dueDate) continue;
    const daysOverdue = diffDays(inv.dueDate, new Date());
    const tier = reminderTierForDaysOverdue(daysOverdue);
    const alreadySent = tier ? inv.reminders.some((r) => r.type === tier) : true;
    if (tier && !alreadySent) {
      await invoiceService.addReminder(inv.id, tier);
      if (tier === "FINAL") finalNoticeInvoices.push(inv);
    }

    const invoiceUrl = `${env.FRONTEND_URL}/app/commercial?tab=invoices`;
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: "Relance facture requise",
        message: `Relance requise : ${inv.client?.name ?? "Client"} – ${inv.amount} ${inv.currency ?? "TND"} (${inv.number})`,
        type: "INVOICE_FOLLOWUP" as const,
        entityId: inv.id,
        link: invoiceUrl,
      });
    }
  }

  await enqueueNotifications(notifications);

  void notifyN8n("invoice.followup", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    invoices: invoices
      .filter((inv) => inv.dueDate)
      .map((inv) => ({
        invoiceId: inv.id,
        number: inv.number,
        amount: Number(inv.amount),
        currency: inv.currency ?? "TND",
        clientName: inv.client?.name,
        daysOverdue: diffDays(inv.dueDate!, new Date()),
        adminUrl: `${env.FRONTEND_URL}/app/commercial?tab=invoices`,
      })),
  });

  // Escalation distinct from invoice.followup — fires only for invoices newly crossing the
  // FINAL reminder tier (30+ days overdue), so a workflow can trigger a stronger action
  // (e.g. collections escalation) without re-triggering on every weekly followup run.
  if (finalNoticeInvoices.length > 0) {
    void notifyN8n("invoice.final_notice", {
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      invoices: finalNoticeInvoices.map((inv) => ({
        invoiceId: inv.id,
        number: inv.number,
        amount: Number(inv.amount),
        currency: inv.currency ?? "TND",
        clientName: inv.client?.name,
        // Non-null: finalNoticeInvoices is only ever populated after the loop's
        // `if (!inv.dueDate) continue` guard above.
        daysOverdue: diffDays(inv.dueDate!, new Date()),
        adminUrl: `${env.FRONTEND_URL}/app/commercial?tab=invoices`,
      })),
    });
  }

  recordBullMQJob("maintenance", "check-invoice-followup", "completed", (performance.now() - start) / 1000);
  return invoices.length;
}

// ── weekly-ceo-report ────────────────────────────────────────────────────────
// Every Monday 07:30 — weekly recap email
export async function weeklyCeoReport() {
  const start = performance.now();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [newLeads, completedProjects, payments, taskStats] = await Promise.all([
    prismaRead.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prismaRead.project.count({ where: { status: "COMPLETED", clientApprovedAt: { gte: weekAgo } } }),
    prismaRead.payment.findMany({
      where: { paidAt: { gte: weekAgo } },
      select: { amount: true },
    }),
    prismaRead.task.groupBy({
      by: ["status"],
      where: { updatedAt: { gte: weekAgo } },
      _count: { status: true },
    }),
  ]);

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const doneTasks = taskStats.find((t) => t.status === "DONE")?._count.status ?? 0;
  const totalTasks = taskStats.reduce((s, t) => s + t._count.status, 0);
  const taskCompletionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const dashboardUrl = `${env.FRONTEND_URL}/app`;

  // The email itself is sent by the n8n workflow (Mistral-enriched narrative summary +
  // these same figures) — see notifyN8n below. Only the recipient count is still needed here.
  const admins = await userRepository.findAdmins();

  void notifyN8n("ceo.weekly_report", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    weekStart: weekAgo.toLocaleDateString("fr-FR"),
    weekEnd: now.toLocaleDateString("fr-FR"),
    newLeads,
    completedProjects,
    totalRevenue,
    currency: "TND",
    doneTasks,
    totalTasks,
    taskCompletionPct,
    dashboardUrl,
  });

  recordBullMQJob("maintenance", "weekly-ceo-report", "completed", (performance.now() - start) / 1000);
  return admins.length;
}

// ── check-task-deadlines ─────────────────────────────────────────────────────
// Every hour — tasks due within 24h or 2h, notifies the assigned freelancer.
// Sends at most once per window per task (tracks by task + window label in
// notification message to avoid querying a separate "sent" table).
export async function checkTaskDeadlines() {
  const start = performance.now();
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 3_600_000);
  const in24h = new Date(now.getTime() + 24 * 3_600_000);

  // Tasks not yet done, assigned to a FREELANCER, due within 24 h
  const tasks = await prismaRead.task.findMany({
    where: {
      status: { notIn: ["DONE"] },
      dueDate: { gt: now, lte: in24h },
      assignee: { role: "FREELANCER" },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      projectId: true,
    },
  });

  if (tasks.length === 0) {
    recordBullMQJob("maintenance", "check-task-deadlines", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  // To avoid double-notification, check which (taskId, window) pairs were
  // already notified in the last 6 h (well within the hourly cron cadence).
  const taskIds = tasks.map((t) => t.id);
  const since6h = new Date(now.getTime() - 6 * 3_600_000);

  const alreadySent = await prismaRead.notification.findMany({
    where: {
      type: "TASK_DEADLINE_SOON",
      entityId: { in: taskIds },
      createdAt: { gte: since6h },
    },
    select: { entityId: true, message: true },
  });

  type WindowKey = "2h" | "24h";
  const sentSet = new Set(
    alreadySent.map((n) => {
      const window: WindowKey = n.message.includes("2h") ? "2h" : "24h";
      return `${n.entityId}:${window}`;
    })
  );

  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  // Batched separately from `notifications`: notifyN8n is fired once per run with only the
  // tasks that actually pass the same dedup gate below, so n8n is never spammed on hourly
  // reruns while a task sits in the same alert window.
  const newlyAlerted: Array<{ taskId: string; title: string; projectId: string; dueDate: Date; assigneeId: string }> = [];

  for (const task of tasks) {
    if (!task.assigneeId || !task.dueDate) continue;
    const dueDate = new Date(task.dueDate);
    const taskUrl = `${env.FRONTEND_URL}/app/tasks`;

    const is2h = dueDate <= in2h;
    const window: WindowKey = is2h ? "2h" : "24h";
    const dedupeKey = `${task.id}:${window}`;

    if (sentSet.has(dedupeKey)) continue;

    const label = is2h ? "2 heures" : "24 heures";
    notifications.push({
      userId: task.assigneeId,
      title: is2h ? "⚠️ Tâche urgente" : "⏰ Tâche bientôt due",
      message: `La tâche « ${task.title} » est due dans ${label}.`,
      type: "TASK_DEADLINE_SOON" as const,
      entityId: task.id,
      link: taskUrl,
    });
    newlyAlerted.push({ taskId: task.id, title: task.title, projectId: task.projectId, dueDate, assigneeId: task.assigneeId });
  }

  if (notifications.length > 0) await enqueueNotifications(notifications);

  if (newlyAlerted.length > 0) {
    void notifyN8n("task.deadline_soon", {
      tasks: newlyAlerted.map((t) => ({
        taskId: t.taskId,
        title: t.title,
        projectId: t.projectId,
        dueDate: t.dueDate,
        assigneeId: t.assigneeId,
        adminUrl: `${env.FRONTEND_URL}/app/tasks`,
      })),
    });
  }

  recordBullMQJob("maintenance", "check-task-deadlines", "completed", (performance.now() - start) / 1000);
  return notifications.length;
}

// ── check-overdue-tasks ──────────────────────────────────────────────────────
// Daily 09:00 — tasks whose dueDate has already passed and are still not DONE.
// checkTaskDeadlines (above) only warns *before* the deadline for freelancers; once a
// task is actually late, nobody was being notified at all until this job. Notifies the
// assignee (any role) plus admins and the manager(s) of the task's own pole — not every
// manager in the company. Deduplicated so each task alerts at most once per calendar day.
export async function checkOverdueTasks() {
  const start = performance.now();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const tasks = await prismaRead.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { lt: now },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      projectId: true,
      project: { select: { serviceId: true } },
    },
  });

  if (tasks.length === 0) {
    recordBullMQJob("maintenance", "check-overdue-tasks", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const taskIds = tasks.map((t) => t.id);
  const alreadySentToday = await prismaRead.notification.findMany({
    where: {
      type: "TASK_OVERDUE",
      entityId: { in: taskIds },
      createdAt: { gte: todayStart },
    },
    select: { entityId: true },
  });
  const sentTaskIds = new Set(alreadySentToday.map((n) => n.entityId));

  // Cache pole staff per serviceId so each pole is only queried once, not once per task.
  const poleStaffCache = new Map<string, string[]>();
  async function poleStaffIds(serviceId: string | null): Promise<string[]> {
    const cacheKey = serviceId ?? "__none__";
    const cached = poleStaffCache.get(cacheKey);
    if (cached) return cached;
    const staff = await userRepository.findAdminsAndPoleManagers(serviceId);
    const ids = staff.map((u) => u.id);
    poleStaffCache.set(cacheKey, ids);
    return ids;
  }

  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  const taskUrl = `${env.FRONTEND_URL}/app/tasks`;

  const newlyOverdue: Array<{ taskId: string; title: string; projectId: string; assigneeId: string | null; daysOverdue: number; dueDate: Date }> = [];

  for (const task of tasks) {
    if (sentTaskIds.has(task.id)) continue;
    const dueDate = new Date(task.dueDate!);
    const daysOverdue = diffDays(dueDate, now);
    const message = `La tâche « ${task.title} » est en retard de ${daysOverdue} jour(s).`;

    const recipientIds = new Set<string>();
    if (task.assigneeId) recipientIds.add(task.assigneeId);
    for (const userId of await poleStaffIds(task.project?.serviceId ?? null)) recipientIds.add(userId);

    for (const userId of recipientIds) {
      notifications.push({
        userId,
        title: "🔴 Tâche en retard",
        message,
        type: "TASK_OVERDUE" as const,
        entityId: task.id,
        link: taskUrl,
      });
    }
    newlyOverdue.push({ taskId: task.id, title: task.title, projectId: task.projectId, assigneeId: task.assigneeId, daysOverdue, dueDate });
  }

  if (notifications.length > 0) await enqueueNotifications(notifications);

  if (newlyOverdue.length > 0) {
    void notifyN8n("task.overdue", {
      tasks: newlyOverdue.map((t) => ({
        taskId: t.taskId,
        title: t.title,
        projectId: t.projectId,
        assigneeId: t.assigneeId,
        daysOverdue: t.daysOverdue,
        dueDate: t.dueDate,
        adminUrl: taskUrl,
      })),
    });
  }

  recordBullMQJob("maintenance", "check-overdue-tasks", "completed", (performance.now() - start) / 1000);
  return notifications.length;
}

// ── check-meeting-reminders ──────────────────────────────────────────────────
// Daily — projects with a recurring meeting cadence (Project.meetingFrequency != NONE)
// whose nextMeetingDate falls within the reminder window get a one-time notification
// to the client's users and the pole's ADMIN/MANAGER staff, then nextMeetingDate is
// advanced to the following cadence-aligned occurrence so the same meeting isn't
// reminded twice and the schedule keeps rolling forward automatically.
export async function checkMeetingReminders() {
  const start = performance.now();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + env.MEETING_REMINDER_DAYS * 86_400_000);

  const dueProjects = await projectMeetingRepository.findDueForReminder(now, windowEnd);

  if (dueProjects.length === 0) {
    recordBullMQJob("maintenance", "check-meeting-reminders", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const project of dueProjects) {
    const recipientIds = new Set<string>();
    if (project.clientId) {
      const clientUsers = await userRepository.findByClientId(project.clientId);
      for (const user of clientUsers) recipientIds.add(user.id);
    }
    for (const user of await userRepository.findAdminsAndPoleManagers(project.serviceId ?? null)) {
      recipientIds.add(user.id);
    }

    const dateLabel = project.nextMeetingDate!.toLocaleDateString("fr-FR");
    const link = `${env.FRONTEND_URL}/app/projects/${project.id}`;
    for (const userId of recipientIds) {
      notifications.push({
        userId,
        title: "📅 Réunion à venir",
        message: `Le prochain point du projet « ${project.name} » est prévu le ${dateLabel}.`,
        type: "MEETING_REMINDER" as const,
        entityId: project.id,
        link,
      });
    }

    await projectMeetingRepository.advanceToNextOccurrence(project.id, project.nextMeetingDate!);

    void notifyN8n("meeting.reminder_due", {
      projectId: project.id,
      projectName: project.name,
      clientName: (project as any).client?.name,
      nextMeetingDate: project.nextMeetingDate,
      adminUrl: link,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });
  }

  if (notifications.length > 0) await enqueueNotifications(notifications);
  recordBullMQJob("maintenance", "check-meeting-reminders", "completed", (performance.now() - start) / 1000);
  return notifications.length;
}

// ── check-stale-leads ───────────────────────────────────────────────────────
// Daily 08:15 — leads NEW/CONTACTED/QUALIFIED/PROPOSAL with no activity for > 14 days
export async function checkStaleLeads() {
  const start = performance.now();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 86_400_000);

  const staleLeads = await prismaRead.lead.findMany({
    where: {
      archivedAt: null,
      status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, name: true, status: true, updatedAt: true },
  });

  if (staleLeads.length === 0) {
    recordBullMQJob("maintenance", "check-stale-leads", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const lead of staleLeads) {
    const daysSince = diffDays(lead.updatedAt, now);
    const leadUrl = `${env.FRONTEND_URL}/app/leads`;
    const statusLabels = {
      NEW: "nouveau",
      CONTACTED: "contacté",
      QUALIFIED: "qualifié",
      PROPOSAL: "proposition envoyée",
    } as const;
    const statusLabel = statusLabels[lead.status as keyof typeof statusLabels];

    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: "Lead inactif",
        message: `Le lead « ${lead.name} » (${statusLabel}) n'a pas eu d'activité depuis ${daysSince} jours.`,
        type: "GENERAL" as const,
        entityId: lead.id,
        link: leadUrl,
      });
    }
  }

  await enqueueNotifications(notifications);

  void notifyN8n("lead.stale", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    leads: staleLeads.map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      daysSinceLastActivity: diffDays(lead.updatedAt, now),
      adminUrl: `${env.FRONTEND_URL}/app/leads`,
    })),
  });

  recordBullMQJob("maintenance", "check-stale-leads", "completed", (performance.now() - start) / 1000);
  return staleLeads.length;
}

// ── check-pending-commissions ─────────────────────────────────────────────────
// Daily 08:30 — commissions pending for > 14 days
export async function checkPendingCommissions() {
  const start = performance.now();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 86_400_000);

  const pendingCommissions = await prismaRead.commission.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      partnerId: true,
      amount: true,
      createdAt: true,
      invoice: { select: { number: true } },
      partner: { select: { name: true } },
    },
  });

  if (pendingCommissions.length === 0) {
    recordBullMQJob("maintenance", "check-pending-commissions", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];
  const commissionUrl = `${env.FRONTEND_URL}/admin/commissions`;

  for (const commission of pendingCommissions) {
    const daysSince = diffDays(new Date((commission as any).createdAt), now);
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: "Commission en attente",
        message: `La commission de ${Number(commission.amount).toFixed(3)} pour ${commission.partner?.name ?? "le partenaire"} (${commission.invoice?.number ?? ""}) est en attente depuis ${daysSince} jours.`,
        type: "GENERAL" as const,
        entityId: commission.id,
        link: commissionUrl,
      });
    }
  }

  await enqueueNotifications(notifications);

  void notifyN8n("commission.pending_approval", {
    agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    commissions: pendingCommissions.map((c) => ({
      commissionId: c.id,
      freelancerId: c.partnerId,
      amount: Number(c.amount),
      daysPending: diffDays(new Date((c as any).createdAt), now),
      adminUrl: commissionUrl,
    })),
  });

  recordBullMQJob("maintenance", "check-pending-commissions", "completed", (performance.now() - start) / 1000);
  return pendingCommissions.length;
}

// ── check-custom-question-sla ────────────────────────────────────────────────
// Daily — OPEN custom questions whose latest message is from the asker (not yet answered
// by staff) and older than CUSTOM_QUESTION_SLA_HOURS. This is an escalation signal for
// notifyN8n, not a replacement for the in-app "Nouvelle question" notification already
// created in customQuestion.service.ts createQuestion.
export async function checkCustomQuestionSla() {
  const start = performance.now();
  const cutoff = new Date(Date.now() - env.CUSTOM_QUESTION_SLA_HOURS * 3_600_000);

  const openQuestions = await prismaRead.customQuestion.findMany({
    where: { status: "OPEN", createdAt: { lt: cutoff } },
    select: {
      id: true,
      subject: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { authorRole: true } },
    },
  });

  const breaching = openQuestions.filter((q) => {
    const lastAuthorRole = q.messages[0]?.authorRole;
    return lastAuthorRole !== "ADMIN" && lastAuthorRole !== "MANAGER";
  });

  if (breaching.length > 0) {
    void notifyN8n("customQuestion.sla_breach", {
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      questions: breaching.map((q) => ({
        questionId: q.id,
        subject: q.subject,
        clientName: q.user?.name,
        hoursSinceAsked: Math.round((Date.now() - q.createdAt.getTime()) / 3_600_000),
        adminUrl: `${env.FRONTEND_URL}/app/questions/${q.id}`,
      })),
    });
  }

  recordBullMQJob("maintenance", "check-custom-question-sla", "completed", (performance.now() - start) / 1000);
  return breaching.length;
}

// ── check-approval-sla ───────────────────────────────────────────────────────
// Daily — Approval records still PENDING past APPROVAL_SLA_DAYS since creation. Escalation
// signal for notifyN8n; the in-app "nouvelle demande" flow (if any) is untouched.
export async function checkApprovalSla() {
  const start = performance.now();
  const cutoff = new Date(Date.now() - env.APPROVAL_SLA_DAYS * 86_400_000);

  const pendingApprovals = await prismaRead.approval.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, title: true, createdAt: true, client: { select: { name: true } } },
  });

  if (pendingApprovals.length > 0) {
    void notifyN8n("approval.sla_breach", {
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      approvals: pendingApprovals.map((a) => ({
        approvalId: a.id,
        title: a.title,
        clientName: a.client?.name,
        daysSinceRequested: diffDays(a.createdAt, new Date()),
        adminUrl: `${env.FRONTEND_URL}/app/approvals/${a.id}`,
      })),
    });
  }

  recordBullMQJob("maintenance", "check-approval-sla", "completed", (performance.now() - start) / 1000);
  return pendingApprovals.length;
}

// ── weekly-health-board-digest ───────────────────────────────────────────────
// Every Monday — reuses the same red/orange/green scoring already shown live on the admin
// Health Board screen (healthBoardService.getHealthBoard), so the n8n digest never drifts
// from what a manager sees when opening the dashboard.
export async function weeklyHealthBoardDigest() {
  const start = performance.now();

  const items = await healthBoardService.getHealthBoard();
  const atRisk = items.filter((p) => p.healthScore !== "green");

  if (items.length > 0) {
    void notifyN8n("healthBoard.weekly_digest", {
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
      totalProjects: items.length,
      atRiskCount: atRisk.length,
      projects: items.map((p) => ({
        projectId: p.id,
        name: p.name,
        clientName: p.clientName,
        healthScore: p.healthScore,
        progress: p.progress,
        isOverdue: p.isOverdue,
        isStale: p.isStale,
        adminUrl: `${env.FRONTEND_URL}/app/projects/${p.id}`,
      })),
      dashboardUrl: `${env.FRONTEND_URL}/app/health-board`,
    });
  }

  recordBullMQJob("maintenance", "weekly-health-board-digest", "completed", (performance.now() - start) / 1000);
  return items.length;
}
