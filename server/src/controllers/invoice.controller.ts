import type { Request, Response } from "express";
import { invoiceService } from "../services/invoice.service.js";
import { creditNoteService } from "../services/creditNote.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { InvoiceStatus } from "@prisma/client";
import { buildServiceScope } from "../utils/serviceScope.js";
import { HttpError } from "../utils/httpError.js";

const REPORTS_MAX_PAGE_SIZE = 500;

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getManagerInvoices = async (req: Request, res: Response) => {
  const scope = await buildServiceScope(req);
  if (!scope.userServiceId) throw new HttpError(403, "Manager has no service assigned");
  const options = { ...parseListQuery(req.query as Record<string, unknown>, REPORTS_MAX_PAGE_SIZE), status: textQuery(req.query.status) as InvoiceStatus | undefined, search: textQuery(req.query.search) };
  const result = await invoiceService.getAllByServiceId(scope.userServiceId, options);
  res.json(result);
};

export const getMyInvoices = async (req: Request, res: Response) => {
  const clientId = req.user!.clientId!;
  const options = { ...parseListQuery(req.query as Record<string, unknown>, REPORTS_MAX_PAGE_SIZE), clientId, status: textQuery(req.query.status) as InvoiceStatus | undefined };
  const result = await invoiceService.getAllByClientId(clientId, options);
  res.json(result);
};

export const getInvoices = async (req: Request, res: Response) => {
  const scope = await buildServiceScope(req);
  if (scope.userRole === "MANAGER") {
    if (!scope.userServiceId) throw new HttpError(403, "Manager has no service assigned");
    const options = { ...parseListQuery(req.query as Record<string, unknown>, REPORTS_MAX_PAGE_SIZE), status: textQuery(req.query.status) as InvoiceStatus | undefined, search: textQuery(req.query.search) };
    const result = await invoiceService.getAllByServiceId(scope.userServiceId, options);
    return res.json(result);
  }
  const options = { ...parseListQuery(req.query as Record<string, unknown>, REPORTS_MAX_PAGE_SIZE), clientId: textQuery(req.query.clientId), status: textQuery(req.query.status) as InvoiceStatus | undefined, search: textQuery(req.query.search) };
  const result = await invoiceService.getAll(options);
  res.json(result);
};

export const getDeletedInvoices = async (req: Request, res: Response) => {
  const options = { ...parseListQuery(req.query as Record<string, unknown>, REPORTS_MAX_PAGE_SIZE), clientId: textQuery(req.query.clientId), status: textQuery(req.query.status) as InvoiceStatus | undefined, search: textQuery(req.query.search) };
  const result = await invoiceService.getDeleted(options);
  res.json(result);
};

export const getInvoiceById = async (req: Request, res: Response) => {
  const invoice = await invoiceService.getById(req.params.id as string, await buildServiceScope(req));
  res.json({ data: invoice });
};

export const createInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.create(req.body, req.user?.sub, req.user?.role);
  res.status(201).json({ data: invoice });
};

export const updateInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.update(req.params.id as string, req.body, await buildServiceScope(req));
  res.json({ data: invoice });
};

export const setInvoiceReminderPaused = async (req: Request, res: Response) => {
  const invoice = await invoiceService.setReminderPaused(req.params.id as string, req.body.reminderPaused, await buildServiceScope(req));
  res.json({ data: invoice });
};

export const sendInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.send(req.params.id as string, await buildServiceScope(req), req.user?.sub, req.user?.role);
  res.json({ data: invoice });
};

export const addPayment = async (req: Request, res: Response) => {
  const { payment, creditNote, portalInviteFailed } = await invoiceService.addPayment(req.params.id as string, req.body, req.user!.id, await buildServiceScope(req));
  res.status(201).json({ data: payment, ...(creditNote ? { creditNote } : {}), ...(portalInviteFailed ? { portalInviteFailed: true } : {}) });
};

export const addInvoiceReminder = async (req: Request, res: Response) => {
  const reminder = await invoiceService.addReminder(req.params.id as string, req.body.type, await buildServiceScope(req));
  res.status(201).json({ data: reminder });
};

export const addInvoiceItem = async (req: Request, res: Response) => {
  const item = await invoiceService.addItem(req.params.id as string, req.body, await buildServiceScope(req));
  res.status(201).json({ data: item });
};

export const updateInvoiceItem = async (req: Request, res: Response) => {
  const item = await invoiceService.updateItem(req.params.itemId as string, req.body, await buildServiceScope(req));
  res.json({ data: item });
};

export const deleteInvoiceItem = async (req: Request, res: Response) => {
  await invoiceService.deleteItem(req.params.itemId as string, await buildServiceScope(req));
  res.status(204).send();
};

export const cancelInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.cancel(req.params.id as string, req.user?.sub, req.user?.role);
  res.json({ data: invoice });
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.delete(req.params.id as string, req.user?.sub, req.user?.role);
  res.json({ data: invoice });
};

export const restoreInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.restore(req.params.id as string, req.user?.sub, req.user?.role);
  res.json({ data: invoice });
};

export const createInvoiceFromProposal = async (req: Request, res: Response) => {
  const invoice = await invoiceService.createFromProposal(req.params.id as string);
  res.status(201).json({ data: invoice });
};

export const createCreditNote = async (req: Request, res: Response) => {
  const creditNote = await creditNoteService.create(req.params.id as string, { amount: req.body.amount, reason: req.body.reason }, req.user?.sub, req.user?.role);
  res.status(201).json({ data: creditNote });
};

export const getInvoiceCreditNotes = async (req: Request, res: Response) => {
  const creditNotes = await creditNoteService.listByInvoice(req.params.id as string);
  res.json({ data: creditNotes });
};

export const applyCreditToInvoice = async (req: Request, res: Response) => {
  const result = await creditNoteService.applyCredit(req.body.creditNoteId as string, req.params.id as string, req.user?.sub, req.user?.role);
  res.json({
    data: {
      creditNote: result.creditNote,
      appliedAmount: result.appliedAmount,
      invoiceStatus: result.invoiceStatus,
    },
  });
};

export const getAllCreditNotes = async (req: Request, res: Response) => {
  const creditNotes = await creditNoteService.getAll();
  res.json({ data: creditNotes });
};

export const addItemsFromTimeEntries = async (req: Request, res: Response) => {
  const { projectId, defaultHourlyRate } = req.body as { projectId: string; defaultHourlyRate: number };
  const result = await invoiceService.addItemsFromTimeEntries(req.params.id as string, projectId, defaultHourlyRate, await buildServiceScope(req));
  res.status(201).json({ data: result });
};
