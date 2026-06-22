import { z } from "zod";
import { currencyCode, positiveDecimal } from "./common.schema.js";

export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitPrice: positiveDecimal,
  total: positiveDecimal,
});

export const invoiceBaseSchema = z.object({
  number: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  amount: positiveDecimal,
  currency: currencyCode.default("TND"),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  items: z.array(invoiceItemSchema).optional(),
});

export const createInvoiceSchema = invoiceBaseSchema;
export const updateInvoiceSchema = invoiceBaseSchema.partial();

export const addPaymentSchema = z.object({
  amount: positiveDecimal,
  method: z.string().max(100).optional(),
  reference: z.string().max(255).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
});

export const addInvoiceItemSchema = invoiceItemSchema;
export const updateInvoiceItemSchema = invoiceItemSchema.partial();

export const createCreditNoteSchema = z.object({
  amount: positiveDecimal,
  reason: z.string().min(1).max(2000),
});
