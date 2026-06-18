import { freelancerApplicationRepository } from "../repositories/freelancerApplication.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import {
  applicationReceivedTemplate,
  applicationAcceptedTemplate,
  applicationRejectedTemplate,
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
    return freelancerApplicationRepository.findAll(options);
  },

  async getApplicationById(id: string) {
    return freelancerApplicationRepository.findById(id);
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
    // Upload CV to MinIO
    const cvUpload = await uploadService.upload(
      cvFile.buffer,
      cvFile.originalname,
      cvFile.mimetype,
      cvFile.size,
      "cv"
    );

    // Upload Portfolio to MinIO
    const portfolioUpload = await uploadService.upload(
      portfolioFile.buffer,
      portfolioFile.originalname,
      portfolioFile.mimetype,
      portfolioFile.size,
      "portfolio"
    );

    // Create application with uploaded file URLs
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

    return application;
  },

  async rejectApplication(id: string, rejectionReason?: string) {
    const application = await freelancerApplicationRepository.update(id, {
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
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await userRepository.create({
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
      passwordHash,
      role: data.role,
      mustChangePassword: true,
    });

    // If freelancer, create profile
    if (data.role === "FREELANCER") {
      await freelancerRepository.create({
        userId: user.id,
      });
    }

    // Update application
    const application = await freelancerApplicationRepository.update(id, {
      status: "ACCEPTED",
      userId: user.id,
      accountCreatedAt: new Date(),
    });

    const loginUrl = `${env.CLIENT_ORIGIN}/login`;
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
