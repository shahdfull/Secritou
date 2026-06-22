import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { serviceService } from "./service.service.js";
import type { ContactRequestInput } from "../validators/contact.validator.js";
import type { ContactStatus } from "@prisma/client";

export class ContactService {
  async sendContactMessage(input: ContactRequestInput) {
    // First: save to DB (critical operation). The contact form has two outcomes that must
    // stay consistent: a ContactRequest record (admin inbox) AND a Lead in the internal
    // agency company's CRM/Kanban. We create both in one transaction so a website submission
    // always surfaces as a lead. Re-submissions by the same email upsert the existing lead
    // instead of failing on the (companyId, email) unique constraint.
    const { contactRequest } = await prisma.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          serviceType: input.serviceType,
          budget: input.budget,
          company: input.company,
          message: input.message,
        },
      });

      const notes = [
        `Service: ${input.serviceType}`,
        input.budget ? `Budget: ${input.budget}` : null,
        `Company: ${input.company}`,
        "",
        input.message,
      ]
        .filter((line) => line !== null)
        .join("\n");

      // Attach the lead to the pole derived from the chosen serviceType (null for "Other" or
      // an un-seeded service → unassigned, ADMIN triage). This is what lets a MANAGER later
      // see only their pole's leads.
      const serviceId = await serviceService.resolveServiceIdForType(
        input.serviceType,
        env.INTERNAL_COMPANY_ID,
        tx
      );

      await tx.lead.upsert({
        where: {
          companyId_email: { companyId: env.INTERNAL_COMPANY_ID, email: input.email },
        },
        update: {
          // Refresh contact details and re-surface the lead if it had been archived.
          name: input.name,
          phone: input.phone,
          notes,
          serviceId,
          archivedAt: null,
        },
        create: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          source: "Website contact form",
          notes,
          serviceId,
          companyId: env.INTERNAL_COMPANY_ID,
        },
      });

      return { contactRequest };
    });
    console.info("Contact request saved to DB", { id: contactRequest.id });

    // Second: try to send email (best effort)
    try {
      if (!this.isSmtpConfigured()) {
        console.warn("SMTP is not configured; contact request was saved to DB but no email was sent.");
        return;
      }

      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"Secritou Website" <${env.SMTP_USER}>`,
        to: env.CONTACT_RECEIVER_EMAIL,
        replyTo: input.email,
        subject: `New consultation request - ${input.company}`,
        text: [
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Phone: ${input.phone || "N/A"}`,
          `Service Type: ${input.serviceType}`,
          `Budget: ${input.budget || "N/A"}`,
          `Company: ${input.company}`,
          "",
          input.message,
        ].join("\n"),
        html: `
          <h2>New consultation request</h2>
          <p><strong>Name:</strong> ${this.escapeHtml(input.name)}</p>
          <p><strong>Email:</strong> ${this.escapeHtml(input.email)}</p>
          <p><strong>Phone:</strong> ${this.escapeHtml(input.phone || "N/A")}</p>
          <p><strong>Service Type:</strong> ${this.escapeHtml(input.serviceType)}</p>
          <p><strong>Budget:</strong> ${this.escapeHtml(input.budget || "N/A")}</p>
          <p><strong>Company:</strong> ${this.escapeHtml(input.company)}</p>
          <p><strong>Message:</strong></p>
          <p>${this.escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
        `,
      });
      console.info("Contact request email sent successfully", { id: contactRequest.id });
    } catch (error) {
      console.warn("Failed to send contact email, but request was saved to DB", { id: contactRequest.id, error });
    }
  }

  async getContactRequests(status?: ContactStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
      prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { convertedLead: true },
      }),
      prisma.contactRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateContactRequestStatus(id: string, status: ContactStatus) {
    return prisma.contactRequest.update({
      where: { id },
      data: { status },
    });
  }

  async convertToLead(
    contactRequestId: string,
    companyId: string,
    assignedManagerId?: string,
    department?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.findUnique({
        where: { id: contactRequestId },
      });

      if (!contactRequest) {
        throw new Error("Contact request not found");
      }

      if (contactRequest.convertedAt) {
        throw new Error("Contact request already converted");
      }

      const lead = await tx.lead.create({
        data: {
          name: contactRequest.name,
          email: contactRequest.email,
          phone: contactRequest.phone,
          source: "Contact form",
          status: "NEW",
          notes: [
            `Service: ${contactRequest.serviceType}`,
            contactRequest.budget ? `Budget: ${contactRequest.budget}` : null,
            `Company: ${contactRequest.company}`,
            "",
            contactRequest.message,
          ]
            .filter((line) => line !== null)
            .join("\n"),
          companyId,
          sourceContactId: contactRequestId,
          assignedManagerId,
          department,
        },
      });

      await tx.contactRequest.update({
        where: { id: contactRequestId },
        data: {
          convertedAt: new Date(),
        },
      });

      return lead;
    });
  }

  private isSmtpConfigured() {
    return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
