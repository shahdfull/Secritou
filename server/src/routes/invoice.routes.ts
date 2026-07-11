import express from "express";
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  sendInvoice,
  addPayment,
  addInvoiceReminder,
  addInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
  getMyInvoices,
  getManagerInvoices,
  cancelInvoice,
  createCreditNote,
  getInvoiceCreditNotes,
  applyCreditToInvoice,
  getAllCreditNotes,
  addItemsFromTimeEntries,
  getDeletedInvoices,
  deleteInvoice,
  restoreInvoice,
  setInvoiceReminderPaused,
} from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceIdParamSchema,
  setReminderPausedSchema,
  addPaymentSchema,
  addReminderSchema,
  addInvoiceItemSchema,
  updateInvoiceItemSchema,
  invoiceItemParamSchema,
  createCreditNoteSchema,
  applyCreditSchema,
  fromTimeEntriesSchema,
} from "../validators/invoice.validator.js";

const router = express.Router();

// CLIENT routes
router.get("/my", authenticate, authorize("CLIENT"), getMyInvoices);

// MANAGER route — invoices scoped to the manager's own service via project.serviceId
router.get("/my-service", authenticate, authorize("MANAGER"), requirePermission("invoices", "read"), getManagerInvoices);

// Apply base middleware to all admin/manager routes
router.use(authenticate);

// Protected routes
router.get("/credit-notes/all", authorize("ADMIN"), getAllCreditNotes);
router.get("/trash", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), getDeletedInvoices);
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), getInvoices);
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), validate(invoiceIdParamSchema), getInvoiceById);
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN"), validate(createInvoiceSchema), createInvoice);
router.put("/:id", authorize("ADMIN"), validate(updateInvoiceSchema), updateInvoice);
// Invoices are never hard-deleted (gapless numbering requirement) — use POST /:id/cancel instead.
router.post("/:id/send", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("invoices", "update"), validate(invoiceIdParamSchema), sendInvoice);
router.post("/:id/cancel", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), cancelInvoice);
router.put(
  "/:id/reminder-paused",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(setReminderPausedSchema),
  setInvoiceReminderPaused
);
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), deleteInvoice);
router.post("/:id/restore", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), restoreInvoice);

// Payments & Reminders
router.post(
  "/:id/payments",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addPaymentSchema),
  addPayment
);
router.post(
  "/:id/reminders",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addReminderSchema),
  addInvoiceReminder
);

// Items
router.post(
  "/:id/items/from-time-entries",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(fromTimeEntriesSchema),
  addItemsFromTimeEntries
);
router.post(
  "/:id/items",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addInvoiceItemSchema),
  addInvoiceItem
);
router.put(
  "/:id/items/:itemId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(updateInvoiceItemSchema),
  updateInvoiceItem
);
router.delete(
  "/:id/items/:itemId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(invoiceItemParamSchema),
  deleteInvoiceItem
);

// Credit notes
router.get(
  "/:id/credit-notes",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "read"),
  validate(invoiceIdParamSchema),
  getInvoiceCreditNotes
);
router.post(
  "/:id/credit-note",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(createCreditNoteSchema),
  createCreditNote
);

// Apply credit note to invoice (consumes creditBalance)
router.post(
  "/:id/apply-credit",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(applyCreditSchema),
  applyCreditToInvoice
);

export default router;
