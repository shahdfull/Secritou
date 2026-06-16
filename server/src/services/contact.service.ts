import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { ContactRequestInput } from "../validators/contact.validator.js";
import type { ContactStatus } from "@prisma/client";

export class ContactService {
  async sendContactMessage(input: ContactRequestInput) {
    // First: save to DB (critical operation)
    const contactRequest = await prisma.contactRequest.create({
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
