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
} from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = express.Router();

// Apply base middleware to all invoice routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getInvoices);
router.get("/:id", authorize("ADMIN", "MANAGER"), getInvoiceById);
router.post("/", authorize("ADMIN", "MANAGER"), createInvoice);
router.put("/:id", authorize("ADMIN", "MANAGER"), updateInvoice);
router.delete("/:id", authorize("ADMIN"), deleteInvoice);
router.post("/:id/send", authorize("ADMIN", "MANAGER"), sendInvoice);

// Payments & Reminders
router.post(
  "/:id/payments",
  authorize("ADMIN", "MANAGER"),
  addInvoicePayment
);
router.post(
  "/:id/reminders",
  authorize("ADMIN", "MANAGER"),
  addInvoiceReminder
);

// Items
router.post(
  "/:id/items",
  authorize("ADMIN", "MANAGER"),
  addInvoiceItem
);
router.put(
  "/:id/items/:itemId",
  authorize("ADMIN", "MANAGER"),
  updateInvoiceItem
);
router.delete(
  "/:id/items/:itemId",
  authorize("ADMIN"),
  deleteInvoiceItem
);

export default router;
