import express from "express";
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  addInvoicePayment,
  addInvoiceReminder,
  addInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
  getMyInvoices,
  cancelInvoice,
  createCreditNote,
  getInvoiceCreditNotes,
} from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceIdParamSchema,
  addPaymentSchema,
  addReminderSchema,
  addInvoiceItemSchema,
  updateInvoiceItemSchema,
  invoiceItemParamSchema,
  createCreditNoteSchema,
} from "../validators/invoice.validator.js";

const router = express.Router();

// CLIENT routes — before requireCompanyTenant
router.get("/my", authenticate, authorize("CLIENT"), getMyInvoices);

// Apply base middleware to all admin/manager routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getInvoices);
router.get("/:id", authorize("ADMIN", "MANAGER"), validate(invoiceIdParamSchema), getInvoiceById);
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(createInvoiceSchema), createInvoice);
router.put("/:id", authorize("ADMIN", "MANAGER"), validate(updateInvoiceSchema), updateInvoice);
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), deleteInvoice);
router.post("/:id/send", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(invoiceIdParamSchema), sendInvoice);
router.post("/:id/cancel", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(invoiceIdParamSchema), cancelInvoice);

// Payments & Reminders
router.post(
  "/:id/payments",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  validate(addPaymentSchema),
  addInvoicePayment
);
router.post(
  "/:id/reminders",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  validate(addReminderSchema),
  addInvoiceReminder
);

// Items
router.post(
  "/:id/items",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  validate(addInvoiceItemSchema),
  addInvoiceItem
);
router.put(
  "/:id/items/:itemId",
  authorize("ADMIN", "MANAGER"),
  validate(updateInvoiceItemSchema),
  updateInvoiceItem
);
router.delete(
  "/:id/items/:itemId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(invoiceItemParamSchema),
  deleteInvoiceItem
);

// Credit notes
router.get(
  "/:id/credit-notes",
  authorize("ADMIN", "MANAGER"),
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

export default router;
