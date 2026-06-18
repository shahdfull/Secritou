import { invoiceRepository } from "../repositories/invoice.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import { invoiceSentTemplate, invoiceReminderTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { InvoiceStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { prisma } from "../config/prisma.js";

export const invoiceService = {
  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      status?: InvoiceStatus;
      search?: string;
    }
  ) {
    return invoiceRepository.findAll(options);
  },

  async getById(id: string, companyId: string) {
    return invoiceRepository.findById(id, companyId);
  },

  async create(
    data: {
      number: string;
      title: string;
      description?: string;
      amount: number;
      currency?: string;
      dueDate?: Date;
      pdfUrl?: string;
      clientId: string;
      projectId?: string;
    },
    companyId: string
  ) {
    await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return invoiceRepository.create({ ...data, companyId });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      number: string;
      title: string;
      description: string;
      amount: number;
      currency: string;
      dueDate: Date;
      pdfUrl: string;
    }>
  ) {
    return invoiceRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return invoiceRepository.delete(id, companyId);
  },

  async send(id: string, companyId: string) {
    const invoice = await invoiceRepository.findById(id, companyId);
    const updated = await invoiceRepository.update(id, companyId, {
      status: "SENT",
      sentAt: new Date(),
    });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("fr-FR")
        : "—";
      const invoiceUrl = `${env.CLIENT_ORIGIN}/client/invoices`;

      for (const user of clientUsers) {
        const { subject, html } = invoiceSentTemplate(
          user.name ?? invoice.clientId,
          invoice.number,
          Number(invoice.amount),
          invoice.currency ?? "EUR",
          dueDate,
          invoiceUrl
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return updated;
  },

  async addPayment(
    id: string,
    companyId: string,
    data: { amount: number; method?: string; reference?: string; paidAt?: Date }
  ) {
    const invoice = await invoiceRepository.findById(id, companyId);
    if (!invoice) throw new Error("Invoice not found");

    const payment = await invoiceRepository.addPayment(id, companyId, {
      ...data,
      paidAt: data.paidAt || new Date(),
    });

    const newAmountPaid = Number(invoice.amountPaid) + data.amount;
    const newStatus =
      newAmountPaid >= Number(invoice.amount)
        ? "PAID"
        : newAmountPaid > 0
        ? "PARTIAL"
        : invoice.status;

    await invoiceRepository.update(id, companyId, {
      amountPaid: newAmountPaid,
      status: newStatus,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
    });

    return payment;
  },

  async addReminder(id: string, companyId: string, type: string) {
    const invoice = await invoiceRepository.findById(id, companyId);
    const reminder = await invoiceRepository.addReminder(id, companyId, {
      type,
      sentAt: new Date(),
    });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("fr-FR")
        : "—";
      const now = new Date();
      const daysOverdue = invoice.dueDate
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0;
      const invoiceUrl = `${env.CLIENT_ORIGIN}/client/invoices`;

      for (const user of clientUsers) {
        const { subject, html } = invoiceReminderTemplate(
          user.name ?? invoice.clientId,
          invoice.number,
          Number(invoice.amount),
          invoice.currency ?? "EUR",
          dueDate,
          daysOverdue,
          invoiceUrl
        );
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return reminder;
  },

  async addItem(
    invoiceId: string,
    companyId: string,
    data: { description: string; quantity: number; unitPrice: number }
  ) {
    const total = data.quantity * data.unitPrice;
    return invoiceRepository.addItem(invoiceId, companyId, { ...data, total });
  },

  async updateItem(
    id: string,
    companyId: string,
    data: { description?: string; quantity?: number; unitPrice?: number }
  ) {
    const invoiceItem = await prisma.invoiceItem.findUnique({
      where: { id, invoice: { companyId } }
    });
    if (!invoiceItem) throw new Error("Item not found");

    const updatedQuantity = data.quantity ?? invoiceItem.quantity;
    const updatedUnitPrice = data.unitPrice ?? Number(invoiceItem.unitPrice);
    const total = updatedQuantity * updatedUnitPrice;

    return invoiceRepository.updateItem(id, companyId, { ...data, total });
  },

  async deleteItem(id: string, companyId: string) {
    return invoiceRepository.deleteItem(id, companyId);
  },
};
