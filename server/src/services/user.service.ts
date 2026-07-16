import { userRepository } from "../repositories/user.repository.js";
import { userSessionRepository } from "../repositories/userSession.repository.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { HttpError } from "../utils/httpError.js";
import { enqueueEmail } from "../jobs/queues.js";
import { communicationQueue } from "../jobs/queues.js";
import { userInvitationTemplate, emailChangeConfirmationTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { Role, Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auditLogService } from "./auditLog.service.js";
import logger from "../utils/logger.js";

const authRepository = new AuthRepository(prisma);

type Actor = { id?: string; role?: string; ip?: string };

function generateRandomPassword() {
  return crypto.randomBytes(16).toString("base64url").slice(0, 16);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Average connected-time per user over three trailing windows, in seconds:
// today (since midnight), the last 7 days, and the last 30 days. "Average" divides
// by the number of days elapsed so far in each window, not the window length —
// otherwise a user invited yesterday would show a misleadingly low 30-day average.
async function computeConnectedTimeAverages(userIds: string[], createdAtByUser: Map<string, Date>) {
  if (userIds.length === 0) return new Map<string, { today: number; weekly: number; monthly: number }>();

  const since = new Date(Date.now() - 30 * DAY_MS);
  const dailyRows = await userSessionRepository.findDailyConnectedSeconds(userIds, since);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = new Map<string, { today: number; weekly: number; monthly: number }>();

  for (const userId of userIds) {
    const userRows = dailyRows.filter((r) => r.userId === userId);
    const todaySeconds = userRows
      .filter((r) => r.day >= todayStart)
      .reduce((sum, r) => sum + r.seconds, 0);
    const last7Total = userRows
      .filter((r) => r.day >= new Date(now.getTime() - 7 * DAY_MS))
      .reduce((sum, r) => sum + r.seconds, 0);
    const last30Total = userRows.reduce((sum, r) => sum + r.seconds, 0);

    const createdAt = createdAtByUser.get(userId) ?? since;
    const daysSinceCreation = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / DAY_MS));
    const weeklyDays = Math.min(7, daysSinceCreation);
    const monthlyDays = Math.min(30, daysSinceCreation);

    result.set(userId, {
      today: Math.round(todaySeconds),
      weekly: Math.round(last7Total / weeklyDays),
      monthly: Math.round(last30Total / monthlyDays),
    });
  }

  return result;
}

export const userService = {
  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");
    return user;
  },

  async updateMe(userId: string, data: Prisma.UserUncheckedUpdateInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");

    // Email changes are never applied immediately — see requestEmailChange/confirmEmailChange.
    // Silently dropping it here (rather than erroring) keeps this endpoint usable for
    // name/phone-only updates without the caller needing special-case logic.
    const { email: _ignoredEmail, ...rest } = data;
    return userRepository.updateMe(userId, rest);
  },

  async requestEmailChange(userId: string, newEmail: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");
    if (newEmail === user.email) throw new HttpError(409, "This is already your current email");

    const conflict = await userRepository.findByEmailExcluding(newEmail, userId);
    if (conflict) throw new HttpError(409, "Email is already in use");

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await userRepository.stageEmailChange(userId, newEmail, tokenHash, expiry);

    try {
      const { subject, html } = emailChangeConfirmationTemplate(
        user.name,
        `${env.FRONTEND_URL}/confirm-email-change?token=${token}`
      );
      void enqueueEmail({ to: newEmail, subject, html });
    } catch (err) {
      logger.error({ err }, "[user] Failed to enqueue email-change confirmation");
    }
  },

  async confirmEmailChange(token: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const staged = await userRepository.findByEmailChangeTokenHash(tokenHash);
    if (!staged || !staged.pendingEmail) throw new HttpError(400, "Invalid or expired confirmation token");

    return userRepository.confirmEmailChange(staged.id, staged.pendingEmail);
  },

  async getUsersByCompany(options: ListQueryOptions) {
    const result = await userRepository.findAll(options);
    const createdAtByUser = new Map(result.data.map((u) => [u.id, u.createdAt]));
    const averages = await computeConnectedTimeAverages(
      result.data.map((u) => u.id),
      createdAtByUser
    );
    return {
      ...result,
      data: result.data.map((u) => ({
        ...u,
        connectedTimeAverages: averages.get(u.id) ?? { today: 0, weekly: 0, monthly: 0 },
      })),
    };
  },

  async recordHeartbeat(userId: string) {
    await userSessionRepository.recordHeartbeat(userId);
  },

  async inviteUser(email: string, name: string, role: Role) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new HttpError(409, "User with that email already exists");

    const tempPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await userRepository.create({ name, email, passwordHash: hashedPassword, role, mustChangePassword: true });

    const loginUrl = `${env.FRONTEND_URL}/login`;
    const { subject, html } = userInvitationTemplate(name, email, tempPassword, loginUrl);
    void enqueueEmail({ to: email, subject, html });

    return user;
  },

  async updateUser(id: string, name?: string, role?: Role, actor?: Actor) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.role === "ADMIN" && role && role !== "ADMIN") {
      const adminCount = await userRepository.countByRole("ADMIN");
      if (adminCount <= 1) throw new HttpError(409, "Cannot remove the last remaining admin", "LAST_ADMIN");
    }
    const updated = await userRepository.update(id, { name, role });
    // A role change must not leave the old permissions valid on an already-issued access
    // token: force re-authentication so the new role takes effect immediately.
    if (role && role !== user.role) {
      await authRepository.revokeAllSessionsForUser(id);
      void auditLogService.record({
        actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
        action: "USER_ROLE_CHANGED", entityType: "User", entityId: id,
        before: { role: user.role }, after: { role },
      });
    }
    return updated;
  },

  async deleteUser(id: string, actor?: Actor) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.role === "ADMIN") {
      const adminCount = await userRepository.countByRole("ADMIN");
      if (adminCount <= 1) throw new HttpError(409, "Cannot delete the last remaining admin", "LAST_ADMIN");
    }
    const deleted = await userRepository.delete(id);

    // Best-effort: remove waiting notification jobs addressed to this user so they
    // don't clutter the queue and produce spurious "user not found" failures.
    try {
      const waitingJobs = await communicationQueue.getWaiting();
      const userJobs = waitingJobs.filter((j) => (j.data as { userId?: string })?.userId === id);
      await Promise.all(userJobs.map((j) => j.remove()));
    } catch (err) {
      logger.warn({ err, userId: id }, "[userService] Failed to clean up queued notification jobs");
    }

    void auditLogService.record({
      actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
      action: "USER_DELETED", entityType: "User", entityId: id,
      before: { name: user.name, email: user.email, role: user.role },
    });
    return deleted;
  },
};

export const permissionsMatrix = {
  ADMIN: [
    "manage_users", "manage_companies", "manage_clients", "manage_leads",
    "manage_projects", "manage_tasks", "view_analytics",
    "view_documents", "view_settings",
  ],
  MANAGER: [
    "manage_projects", "manage_tasks", "view_clients", "view_leads",
    "view_analytics", "view_documents",
  ],
  FREELANCER: [
    "view_projects", "update_my_tasks", "manage_my_profile",
  ],
  CLIENT: [
    "view_my_projects", "view_my_service_requests", "view_my_documents",
  ],
};
