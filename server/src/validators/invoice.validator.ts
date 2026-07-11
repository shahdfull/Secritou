import { z } from "zod";

const uuidParam = z.string().uuid();
const positiveDecimal = z.number().positive();
const currencyCode = z.string().length(3).toUpperCase();

export const createInvoiceSchema = z.object({
  body: z.object({
    number: z.string().min(1).max(100).optional(),
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    amount: positiveDecimal,
    currency: currencyCode.default("TND"),
    clientId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
    items: z.array(z.object({
      description: z.string().min(1).max(500),
      quantity: z.number().int().positive().default(1),
      unitPrice: positiveDecimal,
      total: positiveDecimal,
    })).optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    amount: positiveDecimal.optional(),
    currency: currencyCode.optional(),
    dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const invoiceIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});

export const setReminderPausedSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    reminderPaused: z.boolean(),
  }),
});

export const addPaymentSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    amount: positiveDecimal,
    method: z.string().max(100).optional(),
    reference: z.string().max(255).optional(),
    paidAt: z.string().datetime({ offset: true }).optional(),
    idempotencyKey: z.string().max(255).optional(),
  }),
});

export const addReminderSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    type: z.string().min(1).max(100),
  }),
});

export const addInvoiceItemSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().int().positive().default(1),
    unitPrice: positiveDecimal,
    total: positiveDecimal,
  }),
});

export const updateInvoiceItemSchema = z.object({
  params: z.object({ id: uuidParam, itemId: uuidParam }),
  body: z.object({
    description: z.string().min(1).max(500).optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: positiveDecimal.optional(),
    total: positiveDecimal.optional(),
  }),
});

export const invoiceItemParamSchema = z.object({
  params: z.object({ id: uuidParam, itemId: uuidParam }),
});

export const createCreditNoteSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    amount: positiveDecimal,
    reason: z.string().min(1).max(2000),
  }),
});

export const applyCreditSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    creditNoteId: z.string().uuid(),
  }),
});

export const fromTimeEntriesSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    projectId: z.string().uuid(),
    defaultHourlyRate: z.number().positive().default(50),
  }),
});
