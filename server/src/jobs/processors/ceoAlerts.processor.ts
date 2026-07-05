import { prismaRead } from "../../config/prisma.js";
import { userRepository } from "../../repositories/user.repository.js";
import { enqueueNotifications, enqueueEmail } from "../queues.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import { env } from "../../config/env.js";

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── check-stale-projects ─────────────────────────────────────────────────────
// Daily 08:00 — projects IN_PROGRESS with no task activity for > 7 days
export async function checkStaleProjects() {
  const start = performance.now();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);

  const staleProjects = await prismaRead.project.findMany({
    where: {
      archivedAt: null,
      status: "IN_PROGRESS",
      tasks: {
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

    const html = `<p>⚠️ Le projet <strong>${project.name}</strong> n'a pas eu d'activité${daysSince !== null ? ` depuis ${daysSince} jours` : ""}.</p><p><a href="${projectUrl}">Voir le projet →</a></p>`;
    for (const admin of admins) {
      await enqueueEmail({ to: admin.email, subject: `⚠️ Projet inactif : ${project.name}`, html });
    }
  }

  await enqueueNotifications(notifications);
  recordBullMQJob("maintenance", "check-stale-projects", "completed", (performance.now() - start) / 1000);
  return staleProjects.length;
}

// ── check-overdue-deadlines ──────────────────────────────────────────────────
// Daily 08:30 — projects with deadline < today+3 days and not completed
export async function checkOverdueDeadlines() {
  const start = performance.now();
  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 86_400_000);

  const urgentProjects = await prismaRead.project.findMany({
    where: {
      archivedAt: null,
      status: { notIn: ["COMPLETED"] },
      deadline: { not: null, lte: in3days },
    },
    select: { id: true, name: true, deadline: true },
  });

  if (urgentProjects.length === 0) {
    recordBullMQJob("maintenance", "check-overdue-deadlines", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const project of urgentProjects) {
    const deadline = project.deadline!;
    const daysLeft = diffDays(now, deadline);
    const isOverdue = daysLeft < 0;
    const projectUrl = `${env.FRONTEND_URL}/app/projects/${project.id}`;

    const title = isOverdue ? "🔴 Projet en retard" : "⏰ Délai imminent";
    const message = isOverdue
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
  recordBullMQJob("maintenance", "check-overdue-deadlines", "completed", (performance.now() - start) / 1000);
  return urgentProjects.length;
}

// ── check-invoice-followup ───────────────────────────────────────────────────
// Every Monday 09:00 — SENT invoices without payment for > 14 days
export async function checkInvoiceFollowup() {
  const start = performance.now();
  const cutoff = new Date(Date.now() - 14 * 86_400_000);

  const invoices = await prismaRead.invoice.findMany({
    where: {
      status: "SENT",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      client: { select: { name: true } },
    },
  });

  if (invoices.length === 0) {
    recordBullMQJob("maintenance", "check-invoice-followup", "completed", (performance.now() - start) / 1000);
    return 0;
  }

  const admins = await userRepository.findAdmins();
  const notifications: Parameters<typeof enqueueNotifications>[0] = [];

  for (const inv of invoices) {
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
  const html = `
<h2>📊 Rapport hebdomadaire Secritou</h2>
<p>Semaine du ${weekAgo.toLocaleDateString("fr-FR")} au ${now.toLocaleDateString("fr-FR")}</p>
<ul>
  <li>🆕 Nouveaux leads : <strong>${newLeads}</strong></li>
  <li>✅ Projets complétés : <strong>${completedProjects}</strong></li>
  <li>💰 Revenus encaissés : <strong>${totalRevenue.toLocaleString("fr-FR")} TND</strong></li>
  <li>📋 Tâches complétées : <strong>${doneTasks} / ${totalTasks} (${taskCompletionPct}%)</strong></li>
</ul>
<p><a href="${dashboardUrl}">Voir le dashboard →</a></p>
  `.trim();

  const admins = await userRepository.findAdmins();
  for (const admin of admins) {
    await enqueueEmail({
      to: admin.email,
      subject: `📊 Rapport hebdomadaire – ${now.toLocaleDateString("fr-FR")}`,
      html,
    });
  }

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
  }

  if (notifications.length > 0) await enqueueNotifications(notifications);
  recordBullMQJob("maintenance", "check-task-deadlines", "completed", (performance.now() - start) / 1000);
  return notifications.length;
}
