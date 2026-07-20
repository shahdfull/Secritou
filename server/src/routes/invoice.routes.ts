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

/**
 * @swagger
 * components:
 *   schemas:
 *     InvoiceItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceId: { type: string, format: uuid }
 *         description: { type: string }
 *         quantity: { type: integer }
 *         unitPrice: { type: number }
 *         total: { type: number }
 *       required: [id, invoiceId, description, quantity, unitPrice, total]
 *     Payment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceId: { type: string, format: uuid }
 *         amount: { type: number }
 *         method: { type: string, nullable: true }
 *         reference: { type: string, nullable: true }
 *         paidAt: { type: string, format: date-time }
 *       required: [id, invoiceId, amount, paidAt]
 *     CreditNote:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         invoiceId: { type: string, format: uuid }
 *         amount: { type: number }
 *         reason: { type: string }
 *         creditBalance: { type: number }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, invoiceId, amount, reason, createdAt]
 */

/**
 * @swagger
 * /invoices/my:
 *   get:
 *     summary: List the current client's own invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: CLIENT only — scoped to req.user.clientId.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED] }
 *     responses:
 *       200:
 *         description: Paginated list of the client's invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// CLIENT routes
router.get("/my", authenticate, authorize("CLIENT"), getMyInvoices);

/**
 * @swagger
 * /invoices/my-service:
 *   get:
 *     summary: List invoices scoped to the current manager's pôle
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       MANAGER only — scoped via each invoice's linked project.serviceId. 403 if the manager
 *       has no service assigned.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of invoices in the manager's pôle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden, including a manager with no service assigned
 */
// MANAGER route — invoices scoped to the manager's own service via project.serviceId
router.get("/my-service", authenticate, authorize("MANAGER"), requirePermission("invoices", "read"), getManagerInvoices);

// Apply base middleware to all admin/manager routes
router.use(authenticate);

/**
 * @swagger
 * /invoices/credit-notes/all:
 *   get:
 *     summary: List all credit notes (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All credit notes, unpaginated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CreditNote'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/credit-notes/all", authorize("ADMIN"), getAllCreditNotes);

/**
 * @swagger
 * /invoices/trash:
 *   get:
 *     summary: List soft-deleted invoices (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: clientId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of soft-deleted invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/trash", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), getDeletedInvoices);

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: List invoices (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scoped to their pôle (403 if no service assigned); ADMIN sees all.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: clientId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), getInvoices);

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice by ID (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("invoices", "read"), validate(invoiceIdParamSchema), getInvoiceById);

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       The invoice `number` is never accepted from the client — it is always generated
 *       server-side (sequential, gapless per month, RG-012).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, amount, clientId]
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 5000 }
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               currency:
 *                 type: string
 *                 enum: [TND]
 *                 default: TND
 *                 description: Only TND is accepted (RG-001).
 *               clientId: { type: string, format: uuid }
 *               projectId: { type: string, format: uuid }
 *               dueDate: { type: string, format: date-time }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, unitPrice, total]
 *                   properties:
 *                     description: { type: string, maxLength: 500 }
 *                     quantity: { type: integer, default: 1 }
 *                     unitPrice: { type: number, exclusiveMinimum: 0 }
 *                     total: { type: number, exclusiveMinimum: 0 }
 *     responses:
 *       201:
 *         description: Invoice created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN"), validate(createInvoiceSchema), createInvoice);

/**
 * @swagger
 * /invoices/{id}:
 *   put:
 *     summary: Update an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 5000 }
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               currency: { type: string, enum: [TND] }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200:
 *         description: Invoice updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", authorize("ADMIN"), validate(updateInvoiceSchema), updateInvoice);

/**
 * @swagger
 * /invoices/{id}/send:
 *   post:
 *     summary: Mark an invoice as sent (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice marked as sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Invoices are never hard-deleted (gapless numbering requirement) — use POST /:id/cancel instead.
router.post("/:id/send", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("invoices", "update"), validate(invoiceIdParamSchema), sendInvoice);

/**
 * @swagger
 * /invoices/{id}/cancel:
 *   post:
 *     summary: Cancel an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Invoices are never hard-deleted to preserve gapless sequential numbering (RG-012) —
 *       cancellation is the terminal state for an invoice that must not be collected.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/cancel", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), cancelInvoice);

/**
 * @swagger
 * /invoices/{id}/reminder-paused:
 *   put:
 *     summary: Pause or resume automatic overdue reminders for an invoice (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reminderPaused]
 *             properties:
 *               reminderPaused: { type: boolean }
 *     responses:
 *       200:
 *         description: Invoice reminder-paused flag updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  "/:id/reminder-paused",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(setReminderPausedSchema),
  setInvoiceReminderPaused
);

/**
 * @swagger
 * /invoices/{id}:
 *   delete:
 *     summary: Soft-delete an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: Soft delete — see POST /invoices/{id}/restore to undo. Listed under GET /invoices/trash.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), deleteInvoice);

/**
 * @swagger
 * /invoices/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/restore", sensitiveWriteRateLimit, authorize("ADMIN"), validate(invoiceIdParamSchema), restoreInvoice);

/**
 * @swagger
 * /invoices/{id}/payments:
 *   post:
 *     summary: Record a payment against an invoice (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Supports an optional `idempotencyKey` — a retried call with the same key against the
 *       same invoice does not record a duplicate payment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               method: { type: string, maxLength: 100 }
 *               reference: { type: string, maxLength: 255 }
 *               paidAt: { type: string, format: date-time }
 *               idempotencyKey: { type: string, maxLength: 255 }
 *     responses:
 *       201:
 *         description: >
 *           Payment recorded. `creditNote` is present only when the payment amount exceeds the
 *           remaining balance and the surplus is converted into a credit note.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *                 creditNote:
 *                   $ref: '#/components/schemas/CreditNote'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Payments & Reminders
router.post(
  "/:id/payments",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addPaymentSchema),
  addPayment
);

/**
 * @swagger
 * /invoices/{id}/reminders:
 *   post:
 *     summary: Send a manual reminder for an invoice (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 maxLength: 100
 *                 description: Reminder tier/kind (e.g. FIRST, SECOND, FINAL).
 *     responses:
 *       201:
 *         description: Reminder recorded and dispatched
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/reminders",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addReminderSchema),
  addInvoiceReminder
);

/**
 * @swagger
 * /invoices/{id}/items/from-time-entries:
 *   post:
 *     summary: Bulk-add invoice items generated from a project's unbilled time entries (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId]
 *             properties:
 *               projectId: { type: string, format: uuid }
 *               defaultHourlyRate: { type: number, exclusiveMinimum: 0, default: 50 }
 *     responses:
 *       201:
 *         description: Invoice items created from time entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InvoiceItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Items
router.post(
  "/:id/items/from-time-entries",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(fromTimeEntriesSchema),
  addItemsFromTimeEntries
);

/**
 * @swagger
 * /invoices/{id}/items:
 *   post:
 *     summary: Add a line item to an invoice (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description, unitPrice, total]
 *             properties:
 *               description: { type: string, maxLength: 500 }
 *               quantity: { type: integer, default: 1 }
 *               unitPrice: { type: number, exclusiveMinimum: 0 }
 *               total: { type: number, exclusiveMinimum: 0 }
 *     responses:
 *       201:
 *         description: Item created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/InvoiceItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/items",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(addInvoiceItemSchema),
  addInvoiceItem
);

/**
 * @swagger
 * /invoices/{id}/items/{itemId}:
 *   put:
 *     summary: Update an invoice line item (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string, maxLength: 500 }
 *               quantity: { type: integer }
 *               unitPrice: { type: number, exclusiveMinimum: 0 }
 *               total: { type: number, exclusiveMinimum: 0 }
 *     responses:
 *       200:
 *         description: Item updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/InvoiceItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  "/:id/items/:itemId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(updateInvoiceItemSchema),
  updateInvoiceItem
);

/**
 * @swagger
 * /invoices/{id}/items/{itemId}:
 *   delete:
 *     summary: Delete an invoice line item (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Item deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id/items/:itemId",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "update"),
  validate(invoiceItemParamSchema),
  deleteInvoiceItem
);

/**
 * @swagger
 * /invoices/{id}/credit-notes:
 *   get:
 *     summary: List credit notes for an invoice (ADMIN/MANAGER)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Credit notes issued against this invoice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CreditNote'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Credit notes
router.get(
  "/:id/credit-notes",
  authorize("ADMIN", "MANAGER"),
  requirePermission("invoices", "read"),
  validate(invoiceIdParamSchema),
  getInvoiceCreditNotes
);

/**
 * @swagger
 * /invoices/{id}/credit-note:
 *   post:
 *     summary: Issue a credit note against an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, reason]
 *             properties:
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               reason: { type: string, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: Credit note created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/CreditNote'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/credit-note",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(createCreditNoteSchema),
  createCreditNote
);

/**
 * @swagger
 * /invoices/{id}/apply-credit:
 *   post:
 *     summary: Apply an existing credit note's balance to an invoice (ADMIN only)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     description: Consumes (partially or fully) the target credit note's remaining creditBalance.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [creditNoteId]
 *             properties:
 *               creditNoteId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Credit applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     creditNote:
 *                       $ref: '#/components/schemas/CreditNote'
 *                     appliedAmount: { type: number }
 *                     invoiceStatus: { type: string }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Apply credit note to invoice (consumes creditBalance)
router.post(
  "/:id/apply-credit",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(applyCreditSchema),
  applyCreditToInvoice
);

export default router;
