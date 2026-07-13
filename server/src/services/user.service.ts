import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/httpError.js";
import { enqueueEmail } from "../jobs/queues.js";
import { communicationQueue } from "../jobs/queues.js";
import { userInvitationTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auditLogService } from "./auditLog.service.js";
import logger from "../utils/logger.js";

type Actor = { id?: string; role?: string; ip?: string };

function generateRandomPassword() {
  return crypto.randomBytes(16).toString("base64url").slice(0, 16);
}

export const userService = {
  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");
    return user;
  },

  async updateMe(userId: string, data: { name?: string; email?: string; phone?: string }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");

    if (data.email && data.email !== user.email) {
      const conflict = await userRepository.findByEmailExcluding(data.email, userId);
      if (conflict) throw new HttpError(409, "Email is already in use");
    }

    return userRepository.updateMe(userId, data);
  },

  async getUsersByCompany(options: ListQueryOptions) {
    return userRepository.findAll(options);
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
      await userRepository.revokeSessions(id);
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
