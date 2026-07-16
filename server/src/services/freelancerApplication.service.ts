import { freelancerApplicationRepository } from "../repositories/freelancerApplication.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { enqueueEmail, enqueueEmails } from "../jobs/queues.js";
import { applicationReceivedTemplate, applicationRejectedTemplate, newApplicationAdminTemplate, passwordResetTemplate } from "./emailTemplates/index.js";
import { uploadService } from "./upload.service.js";
import { env } from "../config/env.js";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../config/prisma.js";
import type { ApplicationStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { notifyN8n } from "../utils/webhook.js";
import logger from "../utils/logger.js";
import { extractCvText } from "./cvExtraction.service.js";
import { HttpError } from "../utils/httpError.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const freelancerApplicationService = {
  async getAllApplications(options: ListQueryOptions & { search?: string; status?: ApplicationStatus }) {
    return freelancerApplicationRepository.findAll(options);
  },

  async getApplicationById(id: string) {
    return freelancerApplicationRepository.findById(id);
  },

  // Explicit admin action ("Proposer un entretien") rather than a new ApplicationStatus value
  // — ApplicationStatus only models the terminal PENDING/ACCEPTED/REJECTED outcome, an
  // interview invite is a side-channel action that doesn't change that outcome. The n8n
  // workflow (and its resulting email to the candidate, e.g. a Calendly link) is the only
  // record of this — nothing is persisted on the FreelancerApplication row itself.
  async requestInterview(id: string) {
    const application = await freelancerApplicationRepository.findById(id);
    if (!application) throw new HttpError(404, "Application not found");
    if (application.status !== "PENDING") {
      throw new HttpError(409, "Interview can only be requested for a pending application", "APPLICATION_NOT_PENDING");
    }

    void notifyN8n("freelancerApplication.interview_requested", {
      applicationId: application.id,
      candidateName: `${application.firstName} ${application.lastName}`,
      candidateEmail: application.email,
      position: application.position,
      adminUrl: `${env.FRONTEND_URL}/app/talent`,
    });

    return application;
  },

  async createApplication(data: { firstName: string; lastName: string; email: string; phone?: string; position: string; bio: string; role: string }, cvFile: Express.Multer.File, portfolioFile: Express.Multer.File) {
    const cvUpload = await uploadService.upload(cvFile.buffer, cvFile.originalname, cvFile.mimetype, cvFile.size, "cv");
    const portfolioUpload = await uploadService.upload(portfolioFile.buffer, portfolioFile.originalname, portfolioFile.mimetype, portfolioFile.size, "portfolio");

    const application = await freelancerApplicationRepository.create({ firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, position: data.position, cvUrl: cvUpload.url, cvKey: cvUpload.key, portfolioUrl: portfolioUpload.url, portfolioKey: portfolioUpload.key });

    const { subject, html } = applicationReceivedTemplate(data.firstName);
    void enqueueEmail({ to: data.email, subject, html });

    const platformAdmins = await userRepository.findByRole("ADMIN");
    if (platformAdmins.length > 0) {
      void enqueueEmails(
        platformAdmins.map((admin) => ({
          to: admin.email,
          subject: `Nouvelle candidature : ${data.firstName} ${data.lastName}`,
          html: newApplicationAdminTemplate({ adminName: admin.name, applicantName: `${data.firstName} ${data.lastName}`, applicantEmail: data.email, position: data.position ?? "Non spécifié", dashboardUrl: `${env.FRONTEND_URL}/app/talent` }),
        }))
      );
    }

    void (async () => {
      // Text-based PDF only (see cvExtraction.service.ts) — a scanned image CV yields null
      // and is skipped rather than sending an empty/garbage prompt to the LLM summary step.
      const cvText = await extractCvText(cvFile.buffer);
      if (!cvText) {
        logger.info({ applicationId: application.id }, "[createApplication] No extractable text in CV — skipping AI summary");
        return;
      }
      await notifyN8n("freelancer.applied", {
        applicationId: application.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        position: data.position,
        cvText,
        adminUrl: `${env.FRONTEND_URL}/app/talent`,
        agencyEmail: env.CONTACT_RECEIVER_EMAIL,
        callbackUrl: `${env.API_URL}/api/v1/freelancer-applications/${application.id}/ai-summary`,
      });
    })();

    return application;
  },

  async getPendingApplications() {
    return freelancerApplicationRepository.findPending();
  },

  // Called back by the n8n CV-extraction workflow once it has downloaded the CV, run OCR,
  // and summarized it — never by a human-facing route, hence no ADMIN auth check here (the
  // route itself is gated by verifyN8nSignature instead, see freelancerApplication.routes.ts).
  async setAiSummary(id: string, aiSummary: string) {
    return freelancerApplicationRepository.update(id, { aiSummary });
  },

  async rejectApplication(id: string, rejectionReason?: string) {
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      throw new HttpError(422, "Rejection reason is required and must be at least 10 characters", "REJECTION_REASON_TOO_SHORT");
    }
    const application = await freelancerApplicationRepository.update(id, { status: "REJECTED", rejectionReason });
    const { subject, html } = applicationRejectedTemplate(application.firstName, rejectionReason);
    void enqueueEmail({ to: application.email, subject, html });
    return application;
  },

  async acceptApplication(id: string, data: { firstName: string; lastName: string; email: string; phone?: string; role: "FREELANCER" | "MANAGER" }) {
    // Generate a random password, but we won't send it in clear
    const tempPassword = randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await userRepository.create({ email: data.email, name: `${data.firstName} ${data.lastName}`, passwordHash, role: data.role, mustChangePassword: true });

    if (data.role === "FREELANCER") {
      await freelancerRepository.create({ userId: user.id });
    }

    const application = await freelancerApplicationRepository.update(id, { status: "ACCEPTED", userId: user.id, accountCreatedAt: new Date() });

    // Now generate password reset token
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = hashToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 hours

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExpiry },
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const { subject, html } = passwordResetTemplate(data.firstName, resetUrl);
    void enqueueEmail({ to: data.email, subject, html });

    return { user, application };
  },
};
