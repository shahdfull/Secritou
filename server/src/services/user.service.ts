import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/httpError.js";
import { enqueueEmail } from "../jobs/queues.js";
import { userInvitationTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { COMPANY_ID } from "../config/constants.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateRandomPassword() {
  return crypto.randomBytes(16).toString("base64url").slice(0, 16);
}

export const userService = {
  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");
    return user;
  },

  async updateMe(
    userId: string,
    data: { name?: string; email?: string; phone?: string }
  ) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, "User not found");

    if (data.email && data.email !== user.email) {
      const conflict = await userRepository.findByEmailExcluding(data.email, userId);
      if (conflict) throw new HttpError(409, "Email is already in use");
    }

    return userRepository.updateMe(userId, data);
  },


  async getUsersByCompany(options: ListQueryOptions) {
    return userRepository.findByCompanyId(COMPANY_ID, options);
  },

  async inviteUser(email: string, name: string, role: Role) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new HttpError(409, "User with that email already exists");

    const tempPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await userRepository.create({
      name,
      email,
      passwordHash: hashedPassword,
      role,
      companyId: COMPANY_ID,
      mustChangePassword: true,
    });

    const loginUrl = `${env.FRONTEND_URL}/login`;
    const { subject, html } = userInvitationTemplate(name, email, tempPassword, loginUrl);
    void enqueueEmail({ to: email, subject, html });

    return user;
  },

  async updateUser(id: string, name?: string, role?: Role) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.companyId !== COMPANY_ID) throw new HttpError(403, "You cannot update this user");

    return userRepository.update(id, { name, role });
  },

  async deleteUser(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.companyId !== COMPANY_ID) throw new HttpError(403, "You cannot delete this user");

    return userRepository.delete(id);
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
