import express from "express";
import {
  getApprovals,
  getApprovalById,
  createApproval,
  updateApproval,
  deleteApproval,
  approveApproval,
  rejectApproval,
  commentApproval,
  addApprovalAttachment,
  deleteApprovalAttachment,
  getMyApprovals,
  respondToApproval,
} from "../controllers/approval.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createApprovalSchema,
  updateApprovalSchema,
  approvalActionSchema,
  respondToApprovalSchema,
  addAttachmentSchema,
  approvalIdParamSchema,
  attachmentParamSchema,
} from "../validators/approval.validator.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ApprovalAttachment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         approvalId: { type: string, format: uuid }
 *         name: { type: string }
 *         url: { type: string }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, approvalId, name, url, createdAt]
 *     Approval:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         dueDate: { type: string, format: date-time, nullable: true }
 *         clientId: { type: string, format: uuid }
 *         projectId: { type: string, format: uuid, nullable: true }
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ApprovalAttachment'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, title, status, clientId, createdAt, updatedAt]
 */

/**
 * @swagger
 * /approvals/my:
 *   get:
 *     summary: List the current client's own approvals
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, scoped to req.user.clientId, and requires an activated client portal
 *       (403 otherwise, requireActivatedPortal). Note the response nests the paginated result
 *       one level deeper than most list endpoints — `data` itself carries
 *       `{ data, total, page, pageSize }`, not the array directly.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: Paginated list of the client's approvals, double-nested under data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Approval'
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — wrong role or portal not yet activated
 */
// CLIENT routes
router.get("/my", authenticate, authorize("CLIENT"), requireActivatedPortal, getMyApprovals);

/**
 * @swagger
 * /approvals/{id}/respond:
 *   post:
 *     summary: Client approves, rejects, or comments on an approval request
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, and only on an approval belonging to the caller's own clientId (403
 *       otherwise). Requires an activated client portal.
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
 *                 enum: [approve, reject, comment]
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Approval updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       400:
 *         description: Invalid action
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — wrong role, portal not activated, or approval belongs to another client
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/respond", authenticate, authorize("CLIENT"), requireActivatedPortal, sensitiveWriteRateLimit, validate(respondToApprovalSchema), respondToApproval);

// Apply base middleware to all admin/manager routes
router.use(authenticate);

/**
 * @swagger
 * /approvals:
 *   get:
 *     summary: List approvals (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       MANAGER is scoped to their pôle via the linked project's serviceId. Note the response
 *       nests the paginated result one level deeper than most list endpoints — `data` itself
 *       carries `{ data, total, page, pageSize }`.
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
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of approvals, double-nested under data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Approval'
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "read"), getApprovals);

/**
 * @swagger
 * /approvals/{id}:
 *   get:
 *     summary: Get approval by ID (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Approval details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "read"), validate(approvalIdParamSchema), getApprovalById);

/**
 * @swagger
 * /approvals:
 *   post:
 *     summary: Create an approval request (ADMIN/MANAGER)
 *     tags: [Approvals]
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
 *               clientId: { type: string, format: uuid }
 *               projectId: { type: string, format: uuid }
 *               dueDate: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Approval created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "create"), validate(createApprovalSchema), createApproval);

/**
 * @swagger
 * /approvals/{id}:
 *   put:
 *     summary: Update an approval request (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scope-checked against the approval's pôle before the update.
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
 *               dueDate: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Approval updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(updateApprovalSchema), updateApproval);

/**
 * @swagger
 * /approvals/{id}:
 *   delete:
 *     summary: Delete an approval request (ADMIN only)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Approval deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", authorize("ADMIN"), validate(approvalIdParamSchema), deleteApproval);

/**
 * @swagger
 * /approvals/{id}/approve:
 *   post:
 *     summary: Approve an approval request on the client's behalf (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scope-checked against the approval's pôle.
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
 *         description: Approval marked as approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/approve", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), approveApproval);

/**
 * @swagger
 * /approvals/{id}/reject:
 *   post:
 *     summary: Reject an approval request on the client's behalf (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scope-checked against the approval's pôle.
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
 *         description: Approval marked as rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/reject", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), rejectApproval);

/**
 * @swagger
 * /approvals/{id}/comment:
 *   post:
 *     summary: Add a staff comment to an approval request (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scope-checked against the approval's pôle. Does not change status.
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
 *         description: Comment recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Approval'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/comment", authorize("ADMIN", "MANAGER"), requirePermission("approvals", "update"), validate(approvalActionSchema), commentApproval);

/**
 * @swagger
 * /approvals/{id}/attachments:
 *   post:
 *     summary: Add an attachment to an approval request (ADMIN/MANAGER)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scope-checked against the approval's pôle.
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
 *             required: [name, url]
 *             properties:
 *               name: { type: string, maxLength: 255 }
 *               url: { type: string, format: uri, maxLength: 500 }
 *     responses:
 *       201:
 *         description: Attachment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ApprovalAttachment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Attachments
router.post(
  "/:id/attachments",
  authorize("ADMIN", "MANAGER"),
  requirePermission("approvals", "update"),
  validate(addAttachmentSchema),
  addApprovalAttachment
);

/**
 * @swagger
 * /approvals/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete an approval attachment (ADMIN only)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Attachment deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id/attachments/:attachmentId",
  authorize("ADMIN"),
  validate(attachmentParamSchema),
  deleteApprovalAttachment
);

export default router;
