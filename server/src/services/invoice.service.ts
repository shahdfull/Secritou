import { invoiceRepository } from "../repositories/invoice.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmail, enqueueNotifications } from "../jobs/queues.js";
import { invoiceSentTemplate, invoiceReminderTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { clientSuccessService } from "./clientSuccess.service.js";
import { creditNoteService } from "./creditNote.service.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { computeVat, roundMoney } from "../utils/vat.js";
import { commissionService } from "./commission.service.js";
import { notifyN8n } from "../utils/webhook.js";
import { clientService } from "./client.service.js";

// Invoice mutations change dashboard / executive KPIs (overdue, cash, forecast).
async function invalidateFinanceCaches() {
  await invalidateTags([cacheTags.dashboard(), cacheTags.company()]);
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// A MANAGER may only act on invoices whose project belongs to their service.
// Invoices without a project are service-neutral and visible to every manager
// (same rule as invoiceRepository.findAllByServiceId).
// Throws 404 (not 403) to avoid leaking existence of out-of-scope invoices.
async function assertInvoiceInScope(
  invoice: { projectId?: string | null } | null,
  scope?: ServiceScope
) {
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (!scope || scope.userRole !== "MANAGER") return;
  if (!invoice.projectId) return;
  const { prismaRead } = await import("../config/prisma.js");
  const project = await prismaRead.project.findFirst({
    where: { id: invoice.projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Invoice not found");
}

/**
 * Line items may only be added/changed/removed while the invoice is a DRAFT.
 */
function assertInvoiceDraft(status: InvoiceStatus) {
  if (status !== "DRAFT") throw new HttpError(409, "Cannot modify items on a non-draft invoice", "INVOICE_NOT_DRAFT");
}

/**
 * Once the invoice PDF has been generated (Document.invoiceId set — see
 * documentGenerator.service.ts), the amount/items are already baked into a file that may be
 * visible to the client (Document.accessLevel is CLIENT_ADMIN from the moment it's created, not
 * gated by the invoice's own SENT status). Further edits would silently desync the PDF from the
 * invoice, so block them instead of producing a stale document.
 */
async function assertInvoicePdfNotGenerated(invoiceId: string) {
  const existing = await prisma.document.findFirst({ where: { invoiceId }, select: { id: true } });
  if (existing) throw new HttpError(409, "This invoice's PDF has already been generated and sent — cannot modify it further", "INVOICE_PDF_ALREADY_GENERATED");
}

function currentInvoicePrefix(): string {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Atomically allocates the next sequential invoice number for the given month prefix
 * (INV-YYYYMM-NNNN) via the InvoiceCounter table. Must run inside the same transaction
 * that creates the Invoice row so numbers are never allocated without a corresponding
 * invoice — this, together with disallowing invoice deletion, keeps the sequence gapless.
 */
async function nextInvoiceNumber(tx: TxClient, prefix: string): Promise<string> {
  const counter = await tx.invoiceCounter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(4, "0")}`;
}

async function createInvoiceWithGeneratedNumber(data: Omit<Parameters<typeof invoiceRepository.create>[0], "number">) {
  const prefix = currentInvoicePrefix();
  return prisma.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, prefix);
    return tx.invoice.create({ data: { ...data, number } });
  });
}

async function recomputeInvoiceAmount(tx: TxClient, invoiceId: string) {
  const agg = await tx.invoiceItem.aggregate({ where: { invoiceId }, _sum: { total: true } });
  const amount = Number(agg._sum.total ?? 0);
  await tx.invoice.update({ where: { id: invoiceId }, data: { amount } });
}

export const invoiceService = {
  async getAllByClientId(clientId: string, options: { page: number; pageSize: number; status?: InvoiceStatus }) {
    return invoiceRepository.findAllByClientId(clientId, options);
  },

  async getAllByServiceId(serviceId: string, options: ListQueryOptions & { status?: InvoiceStatus; search?: string }) {
    return invoiceRepository.findAllByServiceId(serviceId, options);
  },

  async getAll(options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }) {
    return invoiceRepository.findAll(options);
  },

  async getDeleted(options: ListQueryOptions & { clientId?: string; status?: InvoiceStatus; search?: string }) {
    return invoiceRepository.findDeleted(options);
  },

  async getById(id: string, scope?: ServiceScope) {
    const invoice = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoice, scope);
    return invoice;
  },

  async create(data: { number?: string; title: string; description?: string; amount: number; currency?: string; dueDate?: Date; pdfUrl?: string; clientId: string; projectId?: string; proposalId?: string }) {
    let created;
    if (!data.number) {
      const { number, ...rest } = data;
      created = await createInvoiceWithGeneratedNumber(rest);
    } else {
      created = await invoiceRepository.create(data as any);
    }
    await invalidateFinanceCaches();
    return created;
  },

  async update(id: string, data: Prisma.InvoiceUncheckedUpdateInput, scope?: ServiceScope) {
    const invoice = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoice, scope);
    assertInvoiceDraft(invoice!.status);
    if (data.amount !== undefined || data.title !== undefined) {
      await assertInvoicePdfNotGenerated(id);
    }
    if (data.amount !== undefined) {
      const itemCount = await prisma.invoiceItem.count({ where: { invoiceId: id } });
      if (itemCount > 0) throw new HttpError(409, "This invoice's amount is derived from its line items and cannot be edited directly", "INVOICE_AMOUNT_DERIVED");
    }
    const updated = await invoiceRepository.update(id, data);
    await invalidateFinanceCaches();
    return updated;
  },

  async setReminderPaused(id: string, reminderPaused: boolean, scope?: ServiceScope) {
    const invoice = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoice, scope);
    const updated = await invoiceRepository.update(id, { reminderPaused });
    await invalidateFinanceCaches();
    return updated;
  },

  // Invoices are never hard-deleted: numbering must stay gapless (Tunisian tax
  // requirement). A wrongly created DRAFT invoice should be cancelled instead.
  async cancel(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") throw new HttpError(409, `Cannot cancel a ${invoice.status} invoice`, "INVOICE_NOT_CANCELLABLE");
    const cancelled = await invoiceRepository.update(id, { status: "CANCELLED" });
    await invalidateFinanceCaches();
    return cancelled;
  },

  async delete(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    const deleted = await invoiceRepository.delete(id);
    await invalidateFinanceCaches();
    return deleted;
  },

  async restore(id: string) {
    const restored = await invoiceRepository.restore(id);
    await invalidateFinanceCaches();
    return restored;
  },

  async send(id: string, scope?: ServiceScope) {
    const invoice = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoice, scope);
    const updated = await invoiceRepository.update(id, { status: "SENT", sentAt: new Date() });
    await invalidateFinanceCaches();

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-FR") : ":";
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;
      void Promise.all([
        ...clientUsers.map((user) => {
          const { subject, html } = invoiceSentTemplate(user.name ?? invoice.clientId, invoice.number, Number(invoice.amount), invoice.currency ?? "TND", dueDate, invoiceUrl);
          return enqueueEmail({ to: user.email, subject, html });
        }),
        enqueueNotifications(clientUsers.map((user) => ({
          userId: user.id,
          title: "Nouvelle facture",
          message: `La facture ${invoice.number} de ${Number(invoice.amount).toFixed(3)} ${invoice.currency ?? "TND"} est disponible.`,
          type: "INVOICE_SENT" as const,
          entityId: id,
          link: invoiceUrl,
        }))),
      ]);
    }

    return updated;
  },

  async addPayment(id: string, data: { amount: number; method?: string; reference?: string; paidAt?: Date; idempotencyKey?: string }, recordedById?: string, scope?: ServiceScope) {
    const invoiceForScope = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoiceForScope, scope);
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, select: { id: true, clientId: true, projectId: true, amount: true, amountPaid: true, status: true, currency: true, invoiceType: true } });
      if (!invoice) throw new HttpError(404, "Invoice not found");
      if (!["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status)) throw new HttpError(409, "Cannot add payment to this invoice", "INVOICE_NOT_ACCEPTING_PAYMENTS");

      // Check for idempotency key first (preferred)
      if (data.idempotencyKey) {
        const existingPayment = await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (existingPayment && existingPayment.invoiceId === id) {
          return { payment: existingPayment, creditNote: null, overpaidBy: 0, clientId: invoice.clientId, deduplicated: true };
        }
      } else {
        // Fallback to 10-second window for backward compatibility
        const tenSecondsAgo = new Date(Date.now() - 10_000);
        const duplicate = await tx.payment.findFirst({ where: { invoiceId: id, amount: data.amount, recordedById: recordedById ?? null, createdAt: { gte: tenSecondsAgo } }, orderBy: { createdAt: "desc" } });
        if (duplicate) return { payment: duplicate, creditNote: null, overpaidBy: 0, clientId: invoice.clientId, deduplicated: true };
      }

      const payment = await tx.payment.create({ data: { invoiceId: id, amount: data.amount, method: data.method, reference: data.reference, idempotencyKey: data.idempotencyKey, recordedById, paidAt: data.paidAt ?? new Date() } });

      const rawAmountPaid = roundMoney(Number(invoice.amountPaid) + data.amount);
      const invoiceAmount = Number(invoice.amount);
      const newAmountPaid = Math.min(rawAmountPaid, invoiceAmount);
      const overpaidBy = roundMoney(rawAmountPaid - invoiceAmount);
      // Commissions are computed on the portion actually applied to the invoice,
      // excluding any overpayment that gets refunded back as a credit note.
      const appliedAmount = newAmountPaid - Number(invoice.amountPaid);

      const newStatus: InvoiceStatus = newAmountPaid >= invoiceAmount ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : invoice.status as InvoiceStatus;

      await tx.invoice.update({ where: { id }, data: { amountPaid: newAmountPaid, status: newStatus, paidAt: newStatus === "PAID" ? new Date() : undefined } });

      // Cadrage §6 / RG-018 (SEC-002): the client portal opens — and the client's portal
      // account is created/invited — only once the first-tranche deposit is actually paid,
      // not at proposal acceptance. `count > 0` means this call is the one that just flipped
      // portalActivatedAt from null (not a later payment on an already-activated client), so
      // it's also the signal to invite the client below, post-commit.
      let justActivatedPortal = false;
      if (newStatus === "PAID" && invoice.invoiceType === "DEPOSIT") {
        const activation = await tx.client.updateMany({
          where: { id: invoice.clientId, portalActivatedAt: null },
          data: { portalActivatedAt: new Date() },
        });
        justActivatedPortal = activation.count > 0;
      }

      let creditNote = null;
      if (overpaidBy > 0) {
        creditNote = await creditNoteService.createCreditNoteTx(tx, { invoiceId: invoice.id, clientId: invoice.clientId, amount: overpaidBy, reason: `Overpayment on invoice (paid ${rawAmountPaid.toFixed(3)} vs billed ${invoiceAmount.toFixed(3)} ${invoice.currency ?? "TND"})` });
      }

      let commissions: Awaited<ReturnType<typeof commissionService.computeForPaymentTx>> = [];
      if (appliedAmount > 0) {
        commissions = await commissionService.computeForPaymentTx(tx, {
          paymentId: payment.id,
          invoiceId: invoice.id,
          projectId: invoice.projectId,
          amountReceived: appliedAmount,
        });
      }

      return { payment, creditNote, overpaidBy, clientId: invoice.clientId, deduplicated: false, commissions, justActivatedPortal };
    });

    if (result.deduplicated) return result;

    await invalidateFinanceCaches();

    const invoiceMeta = await invoiceRepository.findById(id);
    if (invoiceMeta) {
      // RG-018 / SEC-002: invite the client (create their portal account) the moment their
      // deposit invoice actually reaches PAID — moved here from proposal.service.ts's
      // acceptWithCascade, which used to invite immediately at proposal acceptance, before
      // any payment. 409 (account already exists — e.g. re-invoked, or an Admin already
      // invited manually) is swallowed, same as the original call site.
      if (result.justActivatedPortal && invoiceMeta.client?.email && invoiceMeta.client?.name) {
        try {
          await clientService.inviteClientUser(invoiceMeta.clientId, invoiceMeta.client.email, invoiceMeta.client.name);
        } catch (err) {
          if (!(err instanceof HttpError && err.statusCode === 409)) throw err;
        }
      }

      const admins = await userRepository.findAdmins();
      await enqueueNotifications(admins.map((admin) => ({ userId: admin.id, title: "Paiement reçu", message: `Un paiement de ${Number(data.amount).toFixed(3)} ${invoiceMeta.currency ?? "TND"} a été enregistré pour la facture ${invoiceMeta.number}.` })));

      if (result.creditNote) {
        const clientUsers = await userRepository.findByClientId(invoiceMeta.clientId);
        await enqueueNotifications(clientUsers.map((user) => ({ userId: user.id, title: "Avoir disponible", message: `Un avoir de ${result.overpaidBy.toFixed(3)} ${invoiceMeta.currency ?? "TND"} a été crédité sur votre compte suite à un trop-perçu sur la facture ${invoiceMeta.number}.` })));
      }

      // Send COMMISSION_EARNED notifications
      if (result.commissions && result.commissions.length > 0) {
        const commissionUrl = `${env.FRONTEND_URL}/admin/commissions`;
        await enqueueNotifications(result.commissions.map((commission: any) => ({
          userId: commission.partnerId,
          title: "Commission gagnée",
          message: `Vous avez gagné une commission de ${Number(commission.amount).toFixed(3)} sur la facture ${commission.invoice?.number}.`,
          type: "COMMISSION_EARNED" as const,
          entityId: commission.id,
          link: commissionUrl,
        })));
      }

      void clientSuccessService.recalcAndPersist(invoiceMeta.clientId);

      if (result.payment && !result.deduplicated) {
        const justPaid = Number(invoiceMeta.amountPaid) >= Number(invoiceMeta.amount);
        void notifyN8n("invoice.paid", {
          invoiceId: invoiceMeta.id,
          number: invoiceMeta.number,
          amountPaid: Number(data.amount),
          totalAmount: Number(invoiceMeta.amount),
          currency: invoiceMeta.currency ?? "TND",
          fullyPaid: justPaid,
          clientId: invoiceMeta.clientId,
          clientName: invoiceMeta.client?.name,
          adminUrl: `${env.FRONTEND_URL}/app/commercial?tab=invoices`,
          agencyEmail: env.CONTACT_RECEIVER_EMAIL,
        });
      }
    }

    return result;
  },

  async addReminder(id: string, type: string, scope?: ServiceScope) {
    const invoice = await invoiceRepository.findById(id);
    await assertInvoiceInScope(invoice, scope);
    const reminder = await invoiceRepository.addReminder(id, { type, sentAt: new Date() });

    if (invoice) {
      const clientUsers = await userRepository.findByClientId(invoice.clientId);
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-FR") : ":";
      const now = new Date();
      const daysOverdue = invoice.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const invoiceUrl = `${env.FRONTEND_URL}/client/invoices`;
      for (const user of clientUsers) {
        const { subject, html } = invoiceReminderTemplate(user.name ?? invoice.clientId, invoice.number, Number(invoice.amount), invoice.currency ?? "TND", dueDate, daysOverdue, invoiceUrl);
        void enqueueEmail({ to: user.email, subject, html });
      }
    }

    return reminder;
  },

  async addItem(invoiceId: string, data: { description: string; quantity: number; unitPrice: number }, scope?: ServiceScope) {
    const invoiceForScope = await invoiceRepository.findById(invoiceId);
    await assertInvoiceInScope(invoiceForScope, scope);
    const total = roundMoney(data.quantity * data.unitPrice);
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } });
      assertInvoiceDraft(invoice.status);
      await assertInvoicePdfNotGenerated(invoiceId);
      const item = await tx.invoiceItem.create({ data: { ...data, total, invoiceId } });
      await recomputeInvoiceAmount(tx, invoiceId);
      return item;
    });
  },

  async updateItem(id: string, data: { description?: string; quantity?: number; unitPrice?: number }, scope?: ServiceScope) {
    return prisma.$transaction(async (tx) => {
      const invoiceItem = await tx.invoiceItem.findUnique({ where: { id }, include: { invoice: { select: { status: true, projectId: true } } } });
      if (invoiceItem) await assertInvoiceInScope(invoiceItem.invoice, scope);
      if (!invoiceItem) throw new Error("Item not found");
      assertInvoiceDraft(invoiceItem.invoice.status);
      await assertInvoicePdfNotGenerated(invoiceItem.invoiceId);
      const updatedQuantity = data.quantity ?? invoiceItem.quantity;
      const updatedUnitPrice = data.unitPrice ?? Number(invoiceItem.unitPrice);
      const total = roundMoney(updatedQuantity * updatedUnitPrice);
      const item = await tx.invoiceItem.update({ where: { id }, data: { ...data, total } });
      await recomputeInvoiceAmount(tx, invoiceItem.invoiceId);
      return item;
    });
  },

  async deleteItem(id: string, scope?: ServiceScope) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.invoiceItem.findUnique({ where: { id }, include: { invoice: { select: { status: true, projectId: true } } } });
      if (existing) await assertInvoiceInScope(existing.invoice, scope);
      if (!existing) throw new HttpError(404, "Item not found");
      assertInvoiceDraft(existing.invoice.status);
      await assertInvoicePdfNotGenerated(existing.invoiceId);
      const item = await tx.invoiceItem.delete({ where: { id } });
      await recomputeInvoiceAmount(tx, item.invoiceId);
      return item;
    });
  },

  async addItemsFromTimeEntries(
    invoiceId: string,
    projectId: string,
    defaultHourlyRate: number,
    scope?: ServiceScope
  ) {
    const invoice = await invoiceRepository.findById(invoiceId);
    await assertInvoiceInScope(invoice, scope);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    assertInvoiceDraft(invoice.status);
    await assertInvoicePdfNotGenerated(invoiceId);
    if (invoice.projectId !== projectId) throw new HttpError(422, "Invoice does not belong to the specified project", "INVOICE_PROJECT_MISMATCH");

    const entries = await prisma.timeEntry.findMany({
      where: { projectId, billed: false },
      include: { user: { include: { freelancerProfile: { select: { hourlyRate: true } } } } },
    });

    if (entries.length === 0) throw new HttpError(422, "No unbilled time entries found for this project", "NO_UNBILLED_ENTRIES");

    return prisma.$transaction(async (tx) => {
      const invoiceItemData = entries.map((entry) => {
        const rate = entry.user.freelancerProfile?.hourlyRate
          ? Number(entry.user.freelancerProfile.hourlyRate)
          : defaultHourlyRate;
        const hours = entry.minutes / 60;
        const total = roundMoney(hours * rate);
        const description = entry.description
          ? `${entry.user.name ?? entry.userId} – ${entry.description} (${entry.minutes} min)`
          : `${entry.user.name ?? entry.userId} – ${entry.minutes} min @ ${rate}/h`;
        
        return { invoiceId, description, quantity: 1, unitPrice: total, total };
      });

      await tx.invoiceItem.createMany({ data: invoiceItemData });

      await tx.timeEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { billed: true, billedInvoiceId: invoiceId },
      });

      await recomputeInvoiceAmount(tx, invoiceId);
      
      // Fetch the created items to maintain API contract
      const createdItems = await tx.invoiceItem.findMany({
        where: { invoiceId, id: { not: undefined } },
        orderBy: { createdAt: 'desc' },
        take: entries.length
      });
      
      return { items: createdItems, billedCount: entries.length };
    });
  },

  async createFromProposal(proposalId: string) {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, include: { invoice: { select: { id: true } } } });
    if (!proposal) throw Object.assign(new Error("Proposal not found"), { statusCode: 404 });
    if (proposal.status !== "ACCEPTED") throw Object.assign(new Error("Only ACCEPTED proposals can be converted to an invoice"), { statusCode: 422 });
    if (proposal.invoice) throw Object.assign(new Error("An invoice already exists for this proposal"), { statusCode: 409 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const vat = computeVat(Number(proposal.amount ?? 0));

    return createInvoiceWithGeneratedNumber({
      title: `Facture : ${proposal.title}`,
      description: proposal.description ?? undefined,
      amount: vat.amountTTC,
      amountHT: vat.amountHT,
      tvaRate: vat.tvaRate,
      tvaAmount: vat.tvaAmount,
      currency: proposal.currency,
      clientId: proposal.clientId,
      projectId: proposal.projectId ?? undefined,
      proposalId: proposal.id,
      dueDate,
    });
  },

  // `amountHT` is the deposit/balance HT slice (already fraction-of-proposal, e.g. proposal.amount * 0.3).
  // VAT is computed on that slice; `amount` stores the TTC total actually due.
  async createDepositInvoiceTx(
    tx: TxClient,
    args: { title: string; description?: string; amountHT: number; currency: string; clientId: string; projectId?: string; proposalId: string; dueInDays?: number }
  ) {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (args.dueInDays ?? 14));
    const vat = computeVat(args.amountHT);
    const number = await nextInvoiceNumber(tx, currentInvoicePrefix());

    return tx.invoice.create({ data: { number, title: args.title, description: args.description, amount: vat.amountTTC, amountHT: vat.amountHT, tvaRate: vat.tvaRate, tvaAmount: vat.tvaAmount, currency: args.currency, status: "DRAFT", invoiceType: "DEPOSIT", dueDate, clientId: args.clientId, projectId: args.projectId, proposalId: args.proposalId } });
  },

  async createBalanceInvoiceTx(
    tx: TxClient,
    args: { title: string; description?: string; amountHT: number; currency: string; clientId: string; projectId: string; proposalId?: string; dueInDays?: number }
  ) {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (args.dueInDays ?? 30));
    const vat = computeVat(args.amountHT);
    const number = await nextInvoiceNumber(tx, currentInvoicePrefix());

    return tx.invoice.create({ data: { number, title: args.title, description: args.description, amount: vat.amountTTC, amountHT: vat.amountHT, tvaRate: vat.tvaRate, tvaAmount: vat.tvaAmount, currency: args.currency, status: "DRAFT", invoiceType: "BALANCE", dueDate, clientId: args.clientId, projectId: args.projectId, proposalId: args.proposalId ?? undefined } });
  },
};
