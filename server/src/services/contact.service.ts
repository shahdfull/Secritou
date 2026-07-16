import { env } from "../config/env.js";
import logger from "../utils/logger.js";
import { prisma } from "../config/prisma.js";
import { serviceService } from "./service.service.js";
import { enqueueEmail } from "../jobs/queues.js";
import type { ContactRequestInput } from "../validators/contact.validator.js";
import type { ContactStatus } from "@prisma/client";
import { notifyN8n } from "../utils/webhook.js";

export class ContactService {
  async sendContactMessage(input: ContactRequestInput) {
    // First: save to DB (critical operation). ContactRequest + Lead created in one transaction.
    // Re-submissions by the same email upsert the existing lead instead of failing on email unique constraint.
    const { contactRequest } = await prisma.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.create({
        data: { name: input.name, email: input.email, phone: input.phone, serviceType: input.serviceType, budget: input.budget, company: input.company, message: input.message },
      });

      const notes = [`Service: ${input.serviceType}`, input.budget ? `Budget: ${input.budget}` : null, `Company: ${input.company}`, "", input.message].filter((line) => line !== null).join("\n");

      const serviceId = await serviceService.resolveServiceIdForType(input.serviceType, tx as any);

      // Lead.email is not a unique column, so upsert-by-email is not available.
      // Emulate find-or-create: re-submissions by the same email update the
      // existing lead instead of creating a duplicate.
      const existingLead = await tx.lead.findFirst({ where: { email: input.email } });
      if (existingLead) {
        await tx.lead.update({
          where: { id: existingLead.id },
          data: { name: input.name, phone: input.phone, notes, serviceId, archivedAt: null },
        });
      } else {
        await tx.lead.create({
          data: { name: input.name, email: input.email, phone: input.phone, source: "Website contact form", notes, serviceId },
        });
      }

      return { contactRequest };
    });
    logger.info({ id: contactRequest.id }, "Contact request saved to DB");

    // Second: enqueue the notification email (off the request path) — best effort.
    // The communication worker handles SMTP delivery + retries; we never block the
    // HTTP response on it, and the DB write above is the source of truth.
    try {
      await enqueueEmail({
        to: env.CONTACT_RECEIVER_EMAIL,
        replyTo: input.email,
        subject: `New consultation request - ${input.company}`,
        text: [`Name: ${input.name}`, `Email: ${input.email}`, `Phone: ${input.phone || "N/A"}`, `Service Type: ${input.serviceType}`, `Budget: ${input.budget || "N/A"}`, `Company: ${input.company}`, "", input.message].join("\n"),
        html: `<h2>New consultation request</h2><p><strong>Name:</strong> ${this.escapeHtml(input.name)}</p><p><strong>Email:</strong> ${this.escapeHtml(input.email)}</p><p><strong>Phone:</strong> ${this.escapeHtml(input.phone || "N/A")}</p><p><strong>Service Type:</strong> ${this.escapeHtml(input.serviceType)}</p><p><strong>Budget:</strong> ${this.escapeHtml(input.budget || "N/A")}</p><p><strong>Company:</strong> ${this.escapeHtml(input.company)}</p><p><strong>Message:</strong></p><p>${this.escapeHtml(input.message).replace(/\n/g, "<br />")}</p>`,
      });
      logger.info({ id: contactRequest.id }, "Contact request email enqueued");
    } catch (error) {
      logger.warn({ err: error, id: contactRequest.id }, "Failed to enqueue contact email, but request was saved to DB");
    }

    // Additional external channel (e.g. instant Slack/WhatsApp alert to sales) — the
    // transactional email above already covers the agency inbox, this is not a duplicate.
    void notifyN8n("contact.hot_lead", {
      contactRequestId: contactRequest.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      adminUrl: `${env.FRONTEND_URL}/app/leads`,
      agencyEmail: env.CONTACT_RECEIVER_EMAIL,
    });
  }

  async getContactRequests(status?: ContactStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [requests, total] = await Promise.all([
      prisma.contactRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { convertedLead: true } }),
      prisma.contactRequest.count({ where }),
    ]);
    return { data: requests, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateContactRequestStatus(id: string, status: ContactStatus) {
    return prisma.contactRequest.update({ where: { id }, data: { status } });
  }

  async convertToLead(contactRequestId: string, assignedManagerId?: string, department?: string) {
    return prisma.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.findUnique({ where: { id: contactRequestId } });
      if (!contactRequest) throw new Error("Contact request not found");
      if (contactRequest.convertedAt) throw new Error("Contact request already converted");

      const lead = await tx.lead.create({
        data: {
          name: contactRequest.name,
          email: contactRequest.email,
          phone: contactRequest.phone,
          source: "Contact form",
          status: "NEW",
          notes: [`Service: ${contactRequest.serviceType}`, contactRequest.budget ? `Budget: ${contactRequest.budget}` : null, `Company: ${contactRequest.company}`, "", contactRequest.message].filter((line) => line !== null).join("\n"),
          sourceContactId: contactRequestId,
          assignedManagerId,
          department,
        },
      });

      await tx.contactRequest.update({ where: { id: contactRequestId }, data: { convertedAt: new Date() } });

      return lead;
    });
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}
