import express from "express";
import {
  getProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal,
  sendProposal,
  acceptProposal,
  rejectProposal,
  addProposalSection,
  updateProposalSection,
  deleteProposalSection,
  getMyProposals,
  respondToProposal,
} from "../controllers/proposal.controller.js";
import { createInvoiceFromProposal } from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createProposalSchema,
  updateProposalSchema,
  proposalIdParamSchema,
  rejectProposalSchema,
  respondToProposalSchema,
  addSectionSchema,
  updateSectionSchema,
  sectionParamSchema,
} from "../validators/proposal.validator.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProposalSection:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         proposalId: { type: string, format: uuid }
 *         title: { type: string }
 *         content: { type: string, nullable: true }
 *         orderIndex: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, proposalId, title, orderIndex, createdAt, updatedAt]
 *     Proposal:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED]
 *         version: { type: integer }
 *         amount: { type: number, nullable: true }
 *         currency: { type: string, example: TND }
 *         expiresAt: { type: string, format: date-time, nullable: true }
 *         viewedAt: { type: string, format: date-time, nullable: true }
 *         acceptedAt: { type: string, format: date-time, nullable: true }
 *         rejectedAt: { type: string, format: date-time, nullable: true }
 *         pdfUrl: { type: string, nullable: true }
 *         clientName: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         clientId: { type: string, format: uuid }
 *         projectId: { type: string, format: uuid, nullable: true }
 *         serviceRequestId: { type: string, format: uuid, nullable: true }
 *         leadId: { type: string, format: uuid, nullable: true }
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProposalSection'
 *       required: [id, title, status, version, currency, clientId]
 */

/**
 * @swagger
 * /proposals/my:
 *   get:
 *     summary: List the current client's own proposals
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     description: CLIENT only — scoped to req.user.clientId, never another client's proposals.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED] }
 *     responses:
 *       200:
 *         description: Paginated list of the client's proposals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Proposal'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// CLIENT routes
router.get("/my", authenticate, authorize("CLIENT"), getMyProposals);

/**
 * @swagger
 * /proposals/{id}/respond:
 *   post:
 *     summary: Client accepts or rejects a proposal
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, and only on a proposal belonging to the caller's own clientId (403
 *       otherwise). `action: accept` triggers the full acceptance cascade (creates the Project
 *       and the deposit Invoice) — the response `meta` carries the created
 *       `projectId`/`invoiceId`/`clientInvited`, not just the updated proposal in `data`.
 *       Client portal invitation itself no longer happens here (moved to payment time,
 *       RG-018/SEC-002) — `clientInvited` is always false on this route.
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *               expectedVersion:
 *                 type: integer
 *                 description: >
 *                   Optimistic-concurrency token — the proposal `version` the client last
 *                   reviewed. Used only when action is accept.
 *     responses:
 *       200:
 *         description: Proposal accepted or rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *                 meta:
 *                   type: object
 *                   description: Present only when action is accept.
 *                   properties:
 *                     projectId: { type: string, format: uuid }
 *                     invoiceId: { type: string, format: uuid }
 *                     clientInvited:
 *                       type: boolean
 *                       description: >
 *                         Always false — client portal invitation was moved to payment time
 *                         (RG-018/SEC-002) and no longer happens as part of this cascade.
 *       400:
 *         description: Invalid action (Zod validation failure on the request body itself).
 *       409:
 *         description: >
 *           PROPOSAL_VERSION_MISMATCH (expectedVersion is stale), INVALID_PROPOSAL_TRANSITION
 *           (the proposal is not in a status this action can apply to), or PROPOSAL_EXPIRED.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/respond", authenticate, authorize("CLIENT"), sensitiveWriteRateLimit, validate(respondToProposalSchema), respondToProposal);

// Apply base middleware to all admin/manager routes
router.use(authenticate);

/**
 * @swagger
 * /proposals:
 *   get:
 *     summary: List proposals (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scoped to proposals whose linked project/client falls in their pôle.
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
 *         schema: { type: string, enum: [DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of proposals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Proposal'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("proposals", "read"), getProposals);

/**
 * @swagger
 * /proposals/{id}:
 *   get:
 *     summary: Get proposal by ID (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Proposal details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("proposals", "read"), validate(proposalIdParamSchema), getProposalById);

/**
 * @swagger
 * /proposals:
 *   post:
 *     summary: Create a proposal (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, clientId]
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 5000 }
 *               amount: { type: number, minimum: 0 }
 *               currency:
 *                 type: string
 *                 enum: [TND]
 *                 default: TND
 *                 description: Only TND is accepted (RG-001).
 *               clientId: { type: string, format: uuid }
 *               clientName: { type: string, maxLength: 255 }
 *               email: { type: string, format: email }
 *               projectId: { type: string, format: uuid }
 *               serviceRequestId: { type: string, format: uuid }
 *               leadId: { type: string, format: uuid }
 *               expiresAt: { type: string, format: date-time }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string, maxLength: 255 }
 *                     content: { type: string, maxLength: 10000 }
 *                     orderIndex: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Proposal created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: >
 *           Lead not found (leadId's own serviceId is outside a MANAGER's pôle) or Client not
 *           found (the client already has projects, all in a different pôle than the calling
 *           MANAGER) — a MANAGER creating a proposal scoped outside their pôle gets a 404, not a
 *           403, so the existence of an out-of-scope lead/client is not leaked.
 */
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("proposals", "create"), validate(createProposalSchema), createProposal);

/**
 * @swagger
 * /proposals/{id}:
 *   put:
 *     summary: Update a proposal (ADMIN/MANAGER)
 *     tags: [Proposals]
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
 *               amount: { type: number, minimum: 0 }
 *               currency: { type: string, enum: [TND] }
 *               expiresAt: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200:
 *         description: Proposal updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", authorize("ADMIN", "MANAGER"), requirePermission("proposals", "update"), validate(updateProposalSchema), updateProposal);

/**
 * @swagger
 * /proposals/{id}:
 *   delete:
 *     summary: Delete a proposal (ADMIN only)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Proposal deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(proposalIdParamSchema), deleteProposal);

/**
 * @swagger
 * /proposals/{id}/send:
 *   post:
 *     summary: Send a proposal to the client (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Proposal marked as sent (status → SENT)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/send", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("proposals", "update"), validate(proposalIdParamSchema), sendProposal);

/**
 * @swagger
 * /proposals/{id}/accept:
 *   post:
 *     summary: Accept a proposal on the client's behalf (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Staff-side equivalent of POST /proposals/{id}/respond with action=accept — same
 *       acceptance cascade (creates Project + deposit Invoice). MANAGER is scope-checked
 *       against the proposal's pôle before the cascade runs. Client portal invitation no
 *       longer happens here (moved to payment time, RG-018/SEC-002) — `clientInvited` in the
 *       response is always false.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expectedVersion:
 *                 type: integer
 *                 description: Optimistic-concurrency token — the proposal `version` last read.
 *     responses:
 *       200:
 *         description: Proposal accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     projectId: { type: string, format: uuid }
 *                     invoiceId: { type: string, format: uuid }
 *                     clientInvited: { type: boolean, description: "Always false — see description above." }
 *       409:
 *         description: >
 *           PROPOSAL_VERSION_MISMATCH (expectedVersion is stale), INVALID_PROPOSAL_TRANSITION,
 *           or PROPOSAL_EXPIRED.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/accept", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("proposals", "update"), validate(proposalIdParamSchema), acceptProposal);

/**
 * @swagger
 * /proposals/{id}/reject:
 *   post:
 *     summary: Reject a proposal on the client's behalf (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Proposal rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Proposal'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/reject", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("proposals", "update"), validate(rejectProposalSchema), rejectProposal);

/**
 * @swagger
 * /proposals/{id}/create-invoice:
 *   post:
 *     summary: Manually create an invoice from a proposal (ADMIN only)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Financial action, ADMIN only — same restriction as the invoice routes. Distinct from
 *       the automatic deposit invoice created by the accept cascade.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Invoice created from the proposal
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
// Creating an invoice is a financial action : ADMIN only, like the invoice routes.
router.post("/:id/create-invoice", sensitiveWriteRateLimit, authorize("ADMIN"), validate(proposalIdParamSchema), createInvoiceFromProposal);

/**
 * @swagger
 * /proposals/{id}/sections:
 *   post:
 *     summary: Add a section to a proposal (ADMIN/MANAGER)
 *     tags: [Proposals]
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
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               content: { type: string, maxLength: 10000 }
 *               orderIndex: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: Section created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ProposalSection'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Sections
router.post(
  "/:id/sections",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("proposals", "update"),
  validate(addSectionSchema),
  addProposalSection
);

/**
 * @swagger
 * /proposals/{id}/sections/{sectionId}:
 *   put:
 *     summary: Update a proposal section (ADMIN/MANAGER)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: sectionId
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
 *               content: { type: string, maxLength: 10000 }
 *               orderIndex: { type: integer }
 *     responses:
 *       200:
 *         description: Section updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ProposalSection'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  "/:id/sections/:sectionId",
  authorize("ADMIN", "MANAGER"),
  requirePermission("proposals", "update"),
  validate(updateSectionSchema),
  updateProposalSection
);

/**
 * @swagger
 * /proposals/{id}/sections/{sectionId}:
 *   delete:
 *     summary: Delete a proposal section (ADMIN only)
 *     tags: [Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Section deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id/sections/:sectionId",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(sectionParamSchema),
  deleteProposalSection
);

export default router;
