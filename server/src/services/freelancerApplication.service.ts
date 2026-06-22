import { freelancerApplicationRepository } from "../repositories/freelancerApplication.repository.js";
import { COMPANY_ID } from "../config/constants.js";
import { userRepository } from "../repositories/user.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { enqueueEmail, enqueueEmails } from "../jobs/queues.js";
import {
  applicationReceivedTemplate,
  applicationAcceptedTemplate,
  applicationRejectedTemplate,
  newApplicationAdminTemplate,
} from "./emailTemplates/index.js";
import { uploadService } from "./upload.service.js";
import { env } from "../config/env.js";
import bcrypt from "bcryptjs";
import type { ApplicationStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const freelancerApplicationService = {
  async getAllApplications(
    options: ListQueryOptions & { search?: string; status?: ApplicationStatus }
  ) {
    return freelancerApplicationRepository.findAll(COMPANY_ID, options);
  },

  async getApplicationById(id: string) {
    return freelancerApplicationRepository.findById(id, COMPANY_ID);
  },

  async createApplication(
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      position: string;
      bio: string;
      role: string;
    },
    cvFile: Express.Multer.File,
    portfolioFile: Express.Multer.File
  ) {
    const cvUpload = await uploadService.upload(
      cvFile.buffer,
      cvFile.originalname,
      cvFile.mimetype,
      cvFile.size,
      "cv"
    );

    const portfolioUpload = await uploadService.upload(
      portfolioFile.buffer,
      portfolioFile.originalname,
      portfolioFile.mimetype,
      portfolioFile.size,
      "portfolio"
    );

    const application = await freelancerApplicationRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      position: data.position,
      cvUrl: cvUpload.url,
      portfolioUrl: portfolioUpload.url,
    });

    const { subject, html } = applicationReceivedTemplate(data.firstName);
    void enqueueEmail({ to: data.email, subject, html });

    const platformAdmins = await userRepository.findByRole("ADMIN");
    if (platformAdmins.length > 0) {
      void enqueueEmails(
        platformAdmins.map((admin) => ({
          to: admin.email,
          subject: `Nouvelle candidature — ${data.firstName} ${data.lastName}`,
          html: newApplicationAdminTemplate({
            adminName: admin.name,
            applicantName: `${data.firstName} ${data.lastName}`,
            applicantEmail: data.email,
            position: data.position ?? "Non spécifié",
            dashboardUrl: `${env.FRONTEND_URL}/app/talent`,
          }),
        }))
      );
    }

    return application;
  },

  async getPendingApplications() {
    return freelancerApplicationRepository.findPending();
  },

  async assignApplicationToCompany(id: string) {
    return freelancerApplicationRepository.assignToCompany(id, COMPANY_ID);
  },

  async rejectApplication(id: string, rejectionReason?: string) {
    const application = await freelancerApplicationRepository.update(id, COMPANY_ID, {
      status: "REJECTED",
      rejectionReason,
    });

    const { subject, html } = applicationRejectedTemplate(
      application.firstName,
      rejectionReason
    );
    void enqueueEmail({ to: application.email, subject, html });

    return application;
  },

  async acceptApplication(
    id: string,
    data: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      role: "FREELANCER" | "MANAGER";
    }
  ) {
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user linked to the admin's company
    const user = await userRepository.create({
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
      passwordHash,
      role: data.role,
      companyId: COMPANY_ID,
      mustChangePassword: true,
    });

    if (data.role === "FREELANCER") {
      await freelancerRepository.create({ userId: user.id });
    }

    // Mark application as accepted and link it to the company
    const application = await freelancerApplicationRepository.update(id, COMPANY_ID, {
      status: "ACCEPTED",
      userId: user.id,
      companyId: COMPANY_ID,
      accountCreatedAt: new Date(),
    });

    const loginUrl = `${env.FRONTEND_URL}/login`;
    const { subject, html } = applicationAcceptedTemplate(
      data.firstName,
      data.username,
      data.password,
      loginUrl
    );
    void enqueueEmail({ to: data.email, subject, html });

    return { user, application };
  },
};
