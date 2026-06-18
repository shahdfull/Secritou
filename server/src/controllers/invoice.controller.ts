import type { Request, Response } from "express";
import { invoiceService } from "../services/invoice.service.js";
import { parseListQuery } from "../utils/listQuery.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getInvoices = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId!,
    clientId: textQuery(req.query.clientId),
    status: textQuery(req.query.status) as never,
    search: textQuery(req.query.search),
  };
  const result = await invoiceService.getAll(options);
  res.json({ data: result });
};

export const getInvoiceById = async (req: Request, res: Response) => {
  const invoice = await invoiceService.getById(req.params.id, req.user!.companyId!);
  res.json({ data: invoice });
};

export const createInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.create(
    req.body,
    req.user!.companyId!
  );
  res.json({ data: invoice });
};

export const updateInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.update(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: invoice });
};

export const deleteInvoice = async (req: Request, res: Response) => {
  await invoiceService.delete(req.params.id, req.user!.companyId!);
  res.json({ data: { success: true } });
};

export const sendInvoice = async (req: Request, res: Response) => {
  const invoice = await invoiceService.send(req.params.id, req.user!.companyId!);
  res.json({ data: invoice });
};

export const addInvoicePayment = async (req: Request, res: Response) => {
  const payment = await invoiceService.addPayment(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: payment });
};

export const addInvoiceReminder = async (req: Request, res: Response) => {
  const reminder = await invoiceService.addReminder(
    req.params.id,
    req.user!.companyId!,
    req.body.type
  );
  res.json({ data: reminder });
};

export const addInvoiceItem = async (req: Request, res: Response) => {
  const item = await invoiceService.addItem(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: item });
};

export const updateInvoiceItem = async (req: Request, res: Response) => {
  const item = await invoiceService.updateItem(
    req.params.itemId,
    req.user!.companyId!,
    req.body
  );
  res.json({ data: item });
};

export const deleteInvoiceItem = async (req: Request, res: Response) => {
  await invoiceService.deleteItem(req.params.itemId, req.user!.companyId!);
  res.json({ data: { success: true } });
};
